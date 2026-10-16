// One signed deploy-event worker on the EXISTING staging site only.
// Owner approval: <=6 neutral provider requests, total <=$0.03. Never public HTTP.
import assert from 'node:assert/strict';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {netlifyStagingHandler} from '../dist/netlify-staging-handler.js';
export async function run(event){
 if(event.site?.id!=='a634a7fc-1ecb-47fa-8b43-edd81a7e3694'||Netlify.env.get('SUPABASE_URL')!=='https://funvzpmpbgazsisehiru.supabase.co'||Date.now()>Date.parse('2026-10-16T16:00:00Z'))return;
 const host='https://luna-staging-itfl.netlify.app',context={site:event.site,ip:'127.0.0.1'};
 await netlifyStagingHandler(new Request(host+'/health'),context);
 const {env}=await import('../dist/config.js'),{supabase}=await import('../dist/db.js');
 assert.ok(env.STAGING_MODE&&env.STAGING_TELEGRAM_IDS==='158467796'&&env.STAGING_SUPABASE_PROJECT_REF==='funvzpmpbgazsisehiru');
 const owner=158467796,runName='luna31-consultation-20261016-v3';
 const previous=await supabase.from('luna30_qa_report_runs').select('state,result').eq('run_name','luna31-consultation-20261016-v2').single();assert.ifError(previous.error);
 const prior=previous.data.result;assert.equal(previous.data.state,'failed');assert.equal(prior.providerAttempts,3);assert.equal(prior.calls.length,3);assert.ok(prior.calls.every(c=>c.providerStatus==='completed'));assert.ok(Math.abs(prior.unsettledCostUpperBoundUsd)<1e-12);assert.ok(prior.costUsd>0&&prior.costUsd<0.01);
 const claim=await supabase.from('luna30_qa_report_runs').insert({run_name:runName,state:'running',result:{maxProviderCalls:6,maxUsd:0.03}}).select('run_name');if(claim.error?.code==='23505')return;assert.ifError(claim.error);
 const result={status:'running',checks:[...prior.checks],calls:[...prior.calls],answers:[...prior.answers],productionWrites:0,syntheticDataOnly:true,physicalDevice:false,actualTelegramLogin:false,signedQaFixture:true,resumedFrom:'luna31-consultation-20261016-v2'};
 const check=(name,value)=>{assert.ok(value,name);result.checks.push({name,status:'PASS'});};
 const fingerprint=async()=>{const [user,garden]=await Promise.all([supabase.from('users').select('lifetime_access,active_until,free_used').eq('telegram_id',owner).single(),supabase.from('moon_gardens').select('*').eq('telegram_id',owner)]);assert.ifError(user.error);assert.ifError(garden.error);return createHash('sha256').update(JSON.stringify({user:user.data,garden:garden.data})).digest('hex');};
 const originalFetch=globalThis.fetch;let attempts=prior.providerAttempts,spent=prior.costUsd,held=0;
 try{
  const before=await fingerprint();
  const {stagingAiMeterRecord}=await import('../dist/staging-ai-meter.js');
  const availability=await originalFetch('https://api.openai.com/v1/models/gpt-5-mini',{headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`}});check('existing server key has access to the configured model',availability.ok&&(await availability.json()).id==='gpt-5-mini');
  // These overrides affect this isolated event process only, never the app
  // Function, dashboard configuration, entitlements or another account.
  env.FEATURE_PERSONALIZATION=false;env.AI_MAX_MESSAGES_PER_DAY=100;env.AI_PREMIUM_MAX_MESSAGES_PER_DAY=100;
  globalThis.fetch=async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
   if(url.hostname!=='api.openai.com')return originalFetch(input,init);
   assert.equal(url.pathname,'/v1/responses');assert.ok(attempts<6);
   const body=JSON.parse(init.body);assert.equal(body.model,'gpt-5-mini');assert.equal(body.store,false);body.service_tier='default';
   const inputBound=Buffer.byteLength(JSON.stringify(body))+512,ceiling=Math.min(0.007,0.03-spent-held);
   body.max_output_tokens=Math.min(body.max_output_tokens,Math.floor((ceiling-inputBound*.00000025)/.000002));
   assert.ok(body.max_output_tokens>=512,'Insufficient approved budget; do not start another request');
   const reserve=inputBound*.00000025+body.max_output_tokens*.000002;held+=reserve;const attempt=++attempts;
   assert.ok(spent+held<=0.03000000001);const response=await originalFetch(input,{...init,body:JSON.stringify(body)}),payload=await response.clone().json(),meter=stagingAiMeterRecord(payload);
   result.calls.push({attempt,httpStatus:response.status,...meter,providerStatus:payload.status,maxOutputTokens:body.max_output_tokens});
   assert.ok(meter&&meter.estimated_cost!==null,'Unpriced provider response cannot pass release');assert.ok(meter.estimated_cost<=reserve);held-=reserve;spent+=meter.estimated_cost;
   await supabase.from('luna30_qa_report_runs').update({result}).eq('run_name',runName);return response;
  };
  const signed=(id=owner)=>{const data=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Luna QA',language_code:'en'})}),checkString=[...data].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n'),key=createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest();data.set('hash',createHmac('sha256',key).update(checkString).digest('hex'));return data.toString();};
  const call=async(path,body,auth=signed())=>{const response=await netlifyStagingHandler(new Request(host+path,{method:body?'POST':'GET',headers:{'x-telegram-init-data':auth,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),context);return {status:response.status,data:await response.json()};};
  check('unsigned and non-QA requests fail before database/provider actions',(await call('/api/luna/conversations',undefined,'invalid')).status===401&&(await call('/api/luna/conversations',undefined,signed(880003199))).status===403);
  const oldAnswer=name=>{const answer=prior.answers.find(a=>a.name===name);assert.ok(answer?.metadata.readingId&&answer.requestId&&answer.conversationId);return answer;};
  const reading={reading:{id:oldAnswer('single EN').metadata.readingId}},three={reading:{id:oldAnswer('three RU').metadata.readingId}},five={reading:{id:oldAnswer('five EN').metadata.readingId}};
  const {createAstrologyService}=await import('../dist/luna30-astrology-service.js'),service=createAstrologyService(supabase,()=>true),births=['35769e29-7986-48af-afab-77e89d273f01','35769e29-7986-48af-afab-77e89d273f02'];
  const first=(await service.calculate(owner,births[0])).chart,second=(await service.calculate(owner,births[1])).chart;
  // Use the application cache key, including the current prompt version. Older
  // synthetic QA reports deliberately remain preserved, not deleted to fit QA.
  const {createAstrologyReportService}=await import('../dist/luna30-astrology-reports.js');
  const reports=createAstrologyReportService(supabase,{enabled:()=>true,personalProfile:async()=>null,dailyLimit:async()=>100,transport:async()=>{throw new Error('Saved-report lookup must never generate');}});
  const savedReport=await reports.open(owner,first.id,second.id,'ru');assert.ok(savedReport.report?.id);
  const cases=[
   {name:'single EN',mode:'tarot',readingId:reading.reading.id,language:'en',message:'Explore this exact card and its orientation in relation to my question. Ask one useful reflection question.'},
   {name:'three RU',mode:'tarot',readingId:three.reading.id,language:'ru',message:'Как связаны три карты именно этого расклада? Учитывай перевёрнутое положение и мой вопрос.'},
   {name:'five EN',mode:'tarot',readingId:five.reading.id,language:'en',message:'What single practical reflection links these five cards and their positions? Do not predict an outcome.'},
   {name:'natal EN',mode:'astrology',astrology:{chartId:first.id,planet:'moon'},language:'en',message:'Explain this calculated Moon placement as a symbolic reflection, without claiming it proves my personality.'},
   {name:'compatibility RU',mode:'astrology',astrology:{chartId:first.id,secondChartId:second.id,reportId:savedReport.report.id},language:'ru',message:'Объясни тему общения по этим двум конкретным картам и сохранённому отчёту. Можно ли по ним знать, что другой человек чувствует?'}
  ];
  const replayChecks=cases.slice(0,3).map(({name,...input})=>{const old=oldAnswer(name);return{name,input:{...input,requestId:old.requestId,conversationId:old.conversationId},message:{id:null,content:old.text}};});
  async function turn(test){const requestId='qa31_'+randomUUID(),{name,...input}=test,response=await call('/api/luna/chat',{...input,requestId});if(response.status!==200)result.failureResponse={name,status:response.status,code:response.data.code??response.data.error};check(name+' full authenticated chat request completes',response.status===200&&Boolean(response.data.message?.content));
   const message=response.data.message;check(name+' no serialized JSON, Korean or literal newline escapes',!/^\s*[{[]/.test(message.content)&&!/[\uac00-\ud7af]/u.test(message.content)&&!message.content.includes('\\n'));
   result.answers.push({name,text:message.content,metadata:message.metadata,requestId,conversationId:response.data.conversationId});
   replayChecks.push({name,input:{...input,requestId,conversationId:response.data.conversationId},message});
   return response.data;
  }
  async function batch(items){const settled=await Promise.allSettled(items.map(turn));const failure=settled.find(r=>r.status==='rejected');if(failure)throw failure.reason;return settled.map(r=>r.value);}
  await batch(cases.slice(3));
  // No reading ID or mode in this follow-up: the server must recover its own
  // latest attachment. The language switch must not lose that exact reading.
  const follow=await turn({name:'saved-context RU follow-up',conversationId:oldAnswer('three RU').conversationId,language:'ru',message:'Продолжим этот же расклад. Объясни каждую из трёх карт и её позицию в трёх коротких пунктах, затем предложи один небольшой шаг по моему вопросу. Не обещай будущее.'});
  check('follow-up retained exact saved three-card reading ID',follow.message.metadata.readingId===three.reading.id);
  check('structured RU reading is not clipped to an introductory paragraph',follow.message.content.length>400&&/Звезд|Звёзд/iu.test(follow.message.content)&&/Лун/iu.test(follow.message.content)&&/Солнц/iu.test(follow.message.content));
  for(const {name,input,message}of replayChecks){const count=attempts,replay=await call('/api/luna/chat',input),history=await call('/api/luna/conversations/'+input.conversationId);check(name+' replay and reopening reuse the stored response without generation',replay.status===200&&(!message.id||replay.data.message.id===message.id)&&replay.data.message.content===message.content&&history.status===200&&history.data.messages.some(m=>(!message.id||m.id===message.id)&&m.content===message.content)&&attempts===count);}
  const count=attempts;
  const missing=await call('/api/luna/chat',{requestId:'qa31_'+randomUUID(),mode:'astrology',chartId:randomUUID(),language:'en',message:'Discuss this chart.'});check('missing/foreign chart fails closed before provider call',missing.status===404&&attempts===count);
  const crisis=await call('/api/luna/chat',{requestId:'qa31_'+randomUUID(),mode:'companion',language:'en',message:'I want to harm myself.'});check('crisis response uses safe deterministic support, not Tarot or an extra provider request',crisis.status===200&&crisis.data.message.metadata.safetyState!=='none'&&attempts===count);
  check('Moon Seeds, garden and subscription fingerprint unchanged',await fingerprint()===before);
  check('six actual provider calls remain within explicit owner budget',attempts===6&&spent>0&&spent<=0.03&&result.calls.every(c=>c.httpStatus===200&&c.providerStatus==='completed'));
  result.status='PASS';
 }catch(error){result.status='FAIL';result.failure={code:error.code??error.name,message:String(error.message).slice(0,220)};}
 finally{globalThis.fetch=originalFetch;}
 result.providerAttempts=attempts;result.costUsd=spent;result.unsettledCostUpperBoundUsd=held;result.qaProcessOnlyLimitOverride=true;result.noProductionChanges=true;
 await supabase.from('luna30_qa_report_runs').update({state:result.status==='PASS'?'completed':'failed',result}).eq('run_name',runName);
 console.log(JSON.stringify({luna31Smoke:result.status,attempts,costUsd:spent,checks:result.checks.length}));
}
