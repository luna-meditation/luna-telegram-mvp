// Existing private staging only. Neutral synthetic chart data, <=4 provider
// requests and <=$0.03, hard-enforced before each external call. Never production.
import assert from 'node:assert/strict';import {createHmac,randomUUID} from 'node:crypto';
import {authorizeLuna32Smoke,luna32StagingSite} from '../dist/luna32-staging-guard.js';
import {protectedStateFingerprint} from './luna31-financial-guard.mjs';
export async function run(request,context,options){
 if(!authorizeLuna32Smoke(request,context.site?.id,options)||Netlify.env.get('SUPABASE_URL')!=='https://funvzpmpbgazsisehiru.supabase.co')return new Response(null,{status:403});
 const {netlifyStagingHandler}=await import('../dist/netlify-staging-handler.js'),host='https://luna-staging-itfl.netlify.app',qaContext={site:{id:luna32StagingSite},ip:'127.0.0.1'};
 await netlifyStagingHandler(new Request(host+'/health'),qaContext);
 const {env}=await import('../dist/config.js'),{supabase}=await import('../dist/db.js');
 assert.ok(env.STAGING_MODE&&env.LUNA32_ENABLED&&env.STAGING_TELEGRAM_IDS==='158467796'&&env.STAGING_SUPABASE_PROJECT_REF==='funvzpmpbgazsisehiru');
 const owner=158467796,runName='luna33-intelligence-qa-20261016',maxCalls=4,maxUsd=.03;
 const result={status:'running',sourceCommit:options.sourceCommit,checks:[],calls:[],answers:[],productionWrites:0,physicalDevice:false,actualTelegramLogin:false,signedQaFixture:true,syntheticBirthData:true,maxCalls,maxUsd};
 const claim=await supabase.from('luna30_qa_report_runs').insert({run_name:runName,state:'running',result});if(claim.error?.code==='23505')return new Response(null,{status:204});assert.ifError(claim.error);
 const check=(name,ok)=>{assert.ok(ok,name);result.checks.push({name,status:'PASS'});};
 const must=async query=>{const r=await query;assert.ifError(r.error);return r.data;};
 const fingerprint=async()=>protectedStateFingerprint(await must(supabase.from('users').select('lifetime_access,active_until,free_used').eq('telegram_id',owner).single()),await must(supabase.from('moon_gardens').select('*').eq('telegram_id',owner)));
 const signed=(id=owner)=>{const d=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Luna QA',language_code:'en'})}),text=[...d].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n'),key=createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest();d.set('hash',createHmac('sha256',key).update(text).digest('hex'));return d.toString();};
 const toolTimes=[];
 const api=async(path,body,method=body?'POST':'GET',auth=signed())=>{
  if(path.startsWith('/api/luna/tools/')){while(toolTimes.length&&toolTimes[0]<=Date.now()-61000)toolTimes.shift();while(toolTimes.length>=8){await new Promise(r=>setTimeout(r,Math.min(50000,Math.max(1,61000-(Date.now()-toolTimes[0])))));while(toolTimes.length&&toolTimes[0]<=Date.now()-61000)toolTimes.shift();}toolTimes.push(Date.now());}
  const response=await netlifyStagingHandler(new Request(host+path,{method,headers:{'x-telegram-init-data':auth,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),qaContext),data=await response.json();if(response.status>=400)(result.apiFailures??=[]).push({path,status:response.status,code:data.code??null});return{status:response.status,data};
 };
 const originalFetch=globalThis.fetch,savedEnv={enabled:env.AI_CHAT_ENABLED,personal:env.FEATURE_PERSONALIZATION,free:env.AI_MAX_MESSAGES_PER_DAY,premium:env.AI_PREMIUM_MAX_MESSAGES_PER_DAY,ordinary:env.AI_MAX_OUTPUT_TOKENS,structured:env.AI_STRUCTURED_MAX_OUTPUT_TOKENS};
 let originalSettings,attempts=0,spent=0,held=0,armed=false,currentCase='';
 try{
  result.protectedBefore=await fingerprint();originalSettings=await must(supabase.from('luna32_runtime_settings').select('*').eq('id',true).single());
  check('staging generation disabled before finite smoke',!originalSettings.generation_enabled&&!originalSettings.public_beta);
  check('payments and automatic migrations remain disabled',!env.RUN_MIGRATIONS&&!env.FEATURE_MOON_SEEDS_PURCHASES&&!env.FEATURE_TAROT_PAID_READINGS&&!env.FEATURE_PREMIUM_V2&&!env.LUNA30_PREMIUM_ENABLED);
  const month=new Date().toISOString().slice(0,7)+'-01',totals=await must(supabase.from('luna32_ai_month_totals').select('spent_cost_microusd,held_cost_microusd').eq('month',month).maybeSingle());check('no unknown prior provider outcome',!totals?.held_cost_microusd);
  await must(supabase.from('luna32_runtime_settings').update({generation_enabled:true,public_beta:true,beta_starts_at:new Date(Date.now()-60000).toISOString(),beta_expires_at:new Date(Date.now()+30*60000).toISOString(),cost_baseline_verified:true,baseline_month:month,legacy_monthly_cost_microusd:0,monthly_cap_microusd:Number(totals?.spent_cost_microusd??0)+Math.floor(maxUsd*1e6),free_daily_limit:100,premium_daily_limit:100}).eq('id',true));
  env.AI_CHAT_ENABLED=true;env.FEATURE_PERSONALIZATION=false;env.AI_MAX_MESSAGES_PER_DAY=100;env.AI_PREMIUM_MAX_MESSAGES_PER_DAY=100;env.AI_MAX_OUTPUT_TOKENS=2600;env.AI_STRUCTURED_MAX_OUTPUT_TOKENS=2600;
  const model=await originalFetch('https://api.openai.com/v1/models/gpt-5-mini',{headers:{Authorization:'Bearer '+env.OPENAI_API_KEY}});check('configured server-only key can access gpt-5-mini',model.ok&&(await model.json()).id==='gpt-5-mini');
  const {providerCostCeiling}=await import('../dist/luna32-ai-accounting.js'),{stagingAiMeterRecord}=await import('../dist/staging-ai-meter.js');
  globalThis.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname!=='api.openai.com')return originalFetch(input,init);
   assert.ok(armed&&attempts<maxCalls,'Finite provider call limit');assert.equal(url.pathname,'/v1/responses');const body=JSON.parse(init.body),reserve=providerCostCeiling(body)/1e6;assert.ok(spent+held+reserve<=maxUsd+1e-10,'Finite worst-case budget');assert.equal(body.store,false);attempts++;held+=reserve;const entry={index:attempts,name:currentCase,reservedUsd:reserve};result.calls.push(entry);
   const response=await originalFetch(input,init),payload=await response.clone().json(),meter=stagingAiMeterRecord(payload);entry.httpStatus=response.status;entry.providerStatus=payload.status;entry.tools=(payload.output??[]).filter(v=>v.type==='function_call').map(v=>v.name);
   if(response.ok&&meter&&meter.estimated_cost!==null){assert.ok(meter.estimated_cost<=reserve);held-=reserve;spent+=meter.estimated_cost;Object.assign(entry,meter);}else entry.unknownCost=true;
   await must(supabase.from('luna30_qa_report_runs').update({result}).eq('run_name',runName));return response;
  };
  check('unsigned and non-QA accounts rejected',(await api('/api/luna/conversations',undefined,'GET','invalid')).status===401&&(await api('/api/luna/conversations',undefined,'GET',signed(880003399))).status===403);
  const places=await api('/api/astrology/locations?q=London'),placeId=places.data.locations.find(p=>p.label==='London')?.placeId??places.data.locations[0].placeId;
  const existing=(await api('/api/astrology/profiles')).data.profiles;
  const profiles=[];for(const [label,date,time]of [['Luna 3.3 QA Moon','1990-01-01',null],['Luna 3.3 QA Star','1991-02-01','12:00']]){const prior=existing.find(p=>p.display_label===label);if(prior){profiles.push(prior);continue;}const r=await api('/api/astrology/profiles',{subjectKind:'other',label,date,time,placeId,consent:true});check(label+' synthetic profile saved',r.status===201||r.status===200);profiles.push(r.data.profile);}
  const setupId=randomUUID(),setup=await api('/api/luna/chat',{requestId:setupId,language:'en',message:'Check my compatibility with Luna 3.3 QA Star.'});check('natural chat command opens a real inline selector without a provider call',setup.status===200&&setup.data.message.metadata.astrologyWorkflow.state==='selecting'&&attempts===0);
  const conversationId=setup.data.conversationId,workflowId=setup.data.message.id;
  const selected=await api('/api/luna/tools/astrology',{requestId:workflowId,conversationId,kind:'compatibility',language:'ru',firstProfileId:profiles[0].id,secondProfileId:profiles[1].id});check('two actual charts calculated and selection saved in chat',selected.status===200&&selected.data.message.metadata.astrologyWorkflow.state==='ready'&&attempts===0);
  const attachment=selected.data.message.metadata.astrology;result.context={conversationId,workflowId,...attachment};
  const charts=await Promise.all([attachment.chartId,attachment.secondChartId].map(async id=>(await api('/api/astrology/charts/'+id)).data.chart));
  const mercurySigns=charts.map(c=>Math.floor(((c.calculation.planets.find(p=>p.id==='mercury').longitude%360+360)%360)/30));
  result.expectedMercurySigns=mercurySigns;
  const duplicate=await api('/api/luna/tools/astrology',{requestId:workflowId,conversationId,kind:'compatibility',language:'ru',firstProfileId:profiles[0].id,secondProfileId:profiles[1].id}),history=await api('/api/luna/conversations/'+conversationId);check('duplicate selection and history reopen reuse exact charts without AI',duplicate.status===200&&history.status===200&&duplicate.data.message.id===workflowId&&attempts===0);
  const denied=await api('/api/luna/chat',{requestId:'qa33_permission_'+randomUUID(),conversationId,mode:'astrology',astrology:attachment,language:'en',message:'Explain these calculated Mercury positions.'});check('external processing requires explicit scoped consent before provider',denied.status===422&&denied.data.code==='astrology_consent_required'&&attempts===0);
  for(const [language,message,consent]of [['ru','В двух коротких абзацах назови знак Меркурия в каждой из этих двух рассчитанных карт и объясни символическую разницу в общении. Предложи один практический вопрос, не приписывая человеку реальные чувства.',true],['en','Continue with these same two calculated charts. Name the Mercury sign in each chart, then offer one small communication experiment. Do not infer private feelings or predict outcomes.',false]]){
   const requestId='qa33_'+randomUUID(),body={requestId,conversationId,mode:'astrology',language,message,...(consent?{astrology:attachment,astrologyConsent:true}:{})};currentCase='compatibility '+language;armed=true;let reply;try{reply=await api('/api/luna/chat',body);}finally{armed=false;}
   check(currentCase+' real authenticated answer completes',reply.status===200&&Boolean(reply.data.message?.content));const text=reply.data.message.content,metadata=reply.data.message.metadata;
   check(currentCase+' exact context and consent persisted',metadata.astrology?.chartId===attachment.chartId&&metadata.astrology?.secondChartId===attachment.secondChartId&&metadata.astrologyConsent?.version===1);
   check(currentCase+' readable localized prose, not serialized payload',!/^\s*[{[]/.test(text)&&!text.includes('\\n')&&(language==='ru'?/Меркур/iu.test(text):/Mercury/i.test(text))&&!/[\uac00-\ud7af]/u.test(text));
   const names=language==='ru'?['овн','тельц','близнец','рак','льв','дев','вес','скорпион','стрельц','козерог','водоле','рыб']:['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
   check(currentCase+' uses the actual engine-computed Mercury signs',mercurySigns.every(sign=>text.toLowerCase().includes(names[sign])));
   const before=attempts,replay=await api('/api/luna/chat',body),opened=await api('/api/luna/conversations/'+conversationId);check(currentCase+' duplicate and reopen are free',replay.status===200&&replay.data.message.content===text&&opened.data.messages.some(m=>m.content===text)&&attempts===before);
   result.answers.push({language,text,metadata,requestId,conversationId});
  }
  const before=attempts,practice=await api('/api/luna/chat',{requestId:'qa33_sleep_'+randomUUID(),conversationId,mode:'astrology',astrology:attachment,language:'ru',message:'Подбери медитацию для сна'});check('clear sleep request detaches old chart and opens actual meditation without another provider request',practice.status===200&&practice.data.message.metadata.contextReset===true&&Boolean(practice.data.message.metadata.recommendedMeditationId)&&attempts===before);
  const noConsent=await api('/api/luna/chat',{requestId:'qa33_revoked_'+randomUUID(),conversationId,mode:'astrology',astrology:attachment,language:'en',message:'Explain these calculated Mercury positions.'});check('context reset withdraws reuse of chart consent',noConsent.status===422&&noConsent.data.code==='astrology_consent_required'&&attempts===before);
  const readings=await api('/api/tarot/readings?offset=0');for(const kind of ['single','three','five']){const reading=readings.data.readings.find(r=>(r.reading_kind??'single')===kind&&r.status==='ready');check(kind+' saved real reading remains available',Boolean(reading));const r=await api('/api/tarot/readings/'+reading.id);check(kind+' reopening stored interpretation does not generate',r.status===200&&r.data.interpretation&&attempts===before);}
  check('all real calls within bounded approved infrastructure budget',attempts>0&&attempts<=maxCalls&&spent>0&&spent<=maxUsd&&held===0&&result.calls.every(c=>c.httpStatus===200&&c.providerStatus==='completed'));
  result.status='PASS';
 }catch(error){result.status='FAIL';result.failure={code:error.code??error.name,message:String(error.message).slice(0,220)};}
 finally{
  globalThis.fetch=originalFetch;Object.assign(env,{AI_CHAT_ENABLED:savedEnv.enabled,FEATURE_PERSONALIZATION:savedEnv.personal,AI_MAX_MESSAGES_PER_DAY:savedEnv.free,AI_PREMIUM_MAX_MESSAGES_PER_DAY:savedEnv.premium,AI_MAX_OUTPUT_TOKENS:savedEnv.ordinary,AI_STRUCTURED_MAX_OUTPUT_TOKENS:savedEnv.structured});
  if(originalSettings){try{const {id:_id,updated_at:_updated,...restore}=originalSettings;await must(supabase.from('luna32_runtime_settings').update(restore).eq('id',true));check('staging settings restored and generation disabled',!(await must(supabase.from('luna32_runtime_settings').select('generation_enabled').eq('id',true).single())).generation_enabled);}catch{result.status='FAIL';result.restoreFailure=true;}}
  try{result.protectedAfter=await fingerprint();check('Moon Seeds, garden and subscriber rights unchanged',result.protectedBefore===result.protectedAfter);}catch{result.status='FAIL';result.protectionFailure=true;}
 }
 result.providerCalls=attempts;result.actualCostUsd=spent;result.unknownCostUpperBoundUsd=held;await supabase.from('luna30_qa_report_runs').update({state:result.status==='PASS'?'completed':'failed',result}).eq('run_name',runName);
 console.log(JSON.stringify({luna33Smoke:result.status,providerCalls:attempts,costUsd:spent,unknownCostUpperBoundUsd:held}));return new Response(null,{status:204});
}
