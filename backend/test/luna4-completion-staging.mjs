// Bounded real-provider + Supabase projection test, never a production route.
// It does NOT claim to validate the normal chat quota/payment orchestration.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {authorizeLuna32Smoke,luna32StagingSite} from '../dist/luna32-staging-guard.js';
const runName='luna4-completion-20261019-v1',owner=510064001;
const approved={responses:60,transcriptions:4,microusd:500000};
const goal='I want to practise drawing for ten minutes each evening.';
const must=async query=>{const r=await query;assert.ifError(r.error);return r.data;};
export async function run(request,context,options){
 if(!authorizeLuna32Smoke(request,context.site?.id,options)||Netlify.env.get('SUPABASE_URL')!=='https://funvzpmpbgazsisehiru.supabase.co')return new Response(null,{status:403});
 const {netlifyStagingHandler}=await import('../dist/netlify-staging-handler.js');await netlifyStagingHandler(new Request('https://luna-staging-itfl.netlify.app/health'),{site:{id:luna32StagingSite},ip:'127.0.0.1'});
 const {supabase:db}=await import('../dist/db.js'),{env}=await import('../dist/config.js');assert.ok(env.STAGING_MODE&&env.STAGING_SUPABASE_PROJECT_REF==='funvzpmpbgazsisehiru');
 const headers={'Cache-Control':'private, no-store'},stored=await must(db.from('luna30_qa_report_runs').select('state,result').eq('run_name',runName).maybeSingle());
 if(options.readOnly)return Response.json(stored??{state:'not_started',result:null},{headers});
 const command=await request.json();assert.equal(command.action,'smoke');assert.match(command.batchId,/^[a-f0-9-]{36}$/);
 if(stored)return new Response(null,{status:204}); // No automatic retry of a paid or interrupted run.
 const result={status:'RUNNING',sourceCommit:options.sourceCommit,approved,owner,providerCalls:0,transcriptions:0,spentMicrousd:0,spentUsdExact:0,heldMicrousd:0,calls:[],checks:[],productionTouched:false,normalChatOrchestrationTested:false};
 const lease='running:'+randomUUID(),claim=await db.from('luna30_qa_report_runs').insert({run_name:runName,state:lease,result});if(claim.error?.code==='23505')return new Response(null,{status:204});assert.ifError(claim.error);
 const persist=()=>must(db.from('luna30_qa_report_runs').update({result}).eq('run_name',runName).eq('state',lease).select('run_name').single());
 const check=(name,value)=>{assert.ok(value,name);result.checks.push({name,status:'PASS'});};
 const oldEnv={...env};let finalState='failed';
 try{
  Object.assign(env,{AI_PROMPT_VERSION:'meet-luna4',AI_REASONING_EFFORT:'minimal',FEATURE_PERSONAL_MEMORY:true,FEATURE_PERSONALIZATION:true,AI_MEMORY_ENABLED:true,FEATURE_AI_MODES:true});
  const prior=await must(db.from('users').select('telegram_id').eq('telegram_id',owner).maybeSingle());assert.equal(prior,null,'Synthetic owner must not overwrite another account.');
  await must(db.from('users').insert({telegram_id:owner,first_name:'Synthetic Luna4 QA',language_code:'ru',ai_memory_enabled:true}));
  const {getUniverse,writePersonalMemory,removePersonalMemory,getAiPersonalProfile}=await import('../dist/personal-memory.js'),{savePersonalProfile}=await import('../dist/personalization.js'),{readPersonalPortrait,createPortraitDiscussion}=await import('../dist/personal-portrait.js'),{permittedPersonalContext}=await import('../dist/personalization-policy.js');
  const {buildLunaOpenAiRequest,extractOpenAiText,normalizeOpenAiModelResult,getLunaConversation}=await import('../dist/luna-ai.js');
  const profile={display_name:'Alex',interests:['meditation'],preferences:'Brief replies. Use Alex; no diminutives.',birth_date:'2000-01-01',birth_time:null,birth_place:null,ai_context_consent:true};await savePersonalProfile(owner,profile);
  const birth=(await import('../dist/birth-discovery.js')).createBirthDiscovery(db),preview=await birth.preview(owner,{date:'2000-01-01'});await birth.save(owner,{date:'2000-01-01',confirmed:true,expectedUpdatedAt:preview.expectedUpdatedAt});
  const confirmed=await writePersonalMemory(owner,{category:'goals',key:'drawing_goal',value:goal,confirmed:true,kind:'fact',sensitiveConsent:false});
  await writePersonalMemory(owner,{category:'goals',key:'unconfirmed_test',value:'UNCONFIRMED_LUNA4_MARKER',confirmed:false,kind:'fact',sensitiveConsent:false});
  const portrait=await readPersonalPortrait(db,owner,()=>getUniverse(owner)),reopened=await readPersonalPortrait(db,owner,()=>getUniverse(owner));
  check('real staging portrait saved and reopened with unchanged revision',portrait.persistence.state==='saved'&&reopened.persistence.state==='saved'&&portrait.persistence.revision===reopened.persistence.revision&&reopened.persistence.cached===true);
  check('date-only initial portrait uses real deterministic calculations',portrait.numerology.calculated&&portrait.dateOnlySun?.hasHouses===false&&portrait.chart===null);
  const engine=createPortraitDiscussion(db,getUniverse);env.AI_PROMPT_VERSION='meet-luna4';
  const cases=[{id:'ru_confirmed',language:'ru',consent:true,question:'Я хочу начать с одного небольшого наброска. Предложи один конкретный шаг к моей сохранённой цели и один вопрос, коротко.'},{id:'en_confirmed',language:'en',consent:true,question:'I would like to start with one small sketch. Suggest one practical step toward my saved goal and one thoughtful question, briefly.'},{id:'ru_deleted',language:'ru',consent:true,deleted:true,question:'Как можно начать исследовать мою текущую цель, если я ещё не объяснил, какую выбрал? Ответь коротко, не угадывай.'},{id:'en_no_consent',language:'en',consent:false,question:'What is one useful question to start understanding what matters to me? Keep it brief; do not assume personal facts.'}];
  for(const item of cases){
   if(item.deleted)await removePersonalMemory(owner,confirmed.id);
   if(!item.consent)await savePersonalProfile(owner,{...profile,ai_context_consent:false});
   const operationId=randomUUID(),opened=await engine.open(owner,{operationId,section:'direction',language:item.language}),again=await engine.open(owner,{operationId,section:'direction',language:item.language});
   check(item.id+': Explore persists one question and retry returns the same message',opened.message.id===again.message.id&&opened.conversationId===again.conversationId&&again.cached===true);
   const personal=permittedPersonalContext(await getAiPersonalProfile(owner,'goals current goal цель '+item.question));
   const body=buildLunaOpenAiRequest({language:item.language,catalog:[],context:{personalContext:personal},recent:[{role:'assistant',content:opened.message.content},{role:'user',content:item.question}],maxOutputTokens:1400,intelligence:true});
   assert.equal(body.model,'gpt-5-mini');assert.equal(body.store,false);assert.doesNotMatch(JSON.stringify(body),/UNCONFIRMED_LUNA4_MARKER|2000-01-01/);
   if(item.deleted||!item.consent)assert.ok(!JSON.stringify(body).includes(goal),'Deleted/unconsented goal must not reach the provider.');else assert.ok(JSON.stringify(body).includes(goal),'Confirmed relevant goal must reach the provider.');
   if(!item.consent)assert.equal(opened.message.metadata.portraitDiscussion.sources.length,0);
   await must(db.from('ai_messages').insert({telegram_id:owner,conversation_id:opened.conversationId,role:'user',content:item.question,metadata:{luna4QualityEvaluation:{caseId:item.id,sourceCommit:options.sourceCommit}}}));
   const ceiling=Math.ceil((Buffer.byteLength(JSON.stringify(body),'utf8')+2048)*.25+body.max_output_tokens*2);
   assert.ok(result.providerCalls<approved.responses&&result.spentMicrousd+result.heldMicrousd+ceiling<=approved.microusd);
   const call={index:++result.providerCalls,caseId:item.id,conversationId:opened.conversationId,model:body.model,startedAt:new Date().toISOString(),ceiling};result.calls.push(call);result.heldMicrousd+=ceiling;await persist();
   const start=Date.now(),response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+Netlify.env.get('OPENAI_API_KEY'),'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)}),payload=await response.json(),u=payload.usage,cached=u?.input_tokens_details?.cached_tokens??0;
   assert.ok(response.ok&&u&&Number.isSafeInteger(u.input_tokens)&&Number.isSafeInteger(u.output_tokens)&&cached<=u.input_tokens&&(payload.model==='gpt-5-mini'||payload.model?.startsWith('gpt-5-mini-20'))&&['auto','default'].includes(payload.service_tier??''),'Unknown cost: never retry automatically.');
   const exact=((u.input_tokens-cached)*.25+cached*.025+u.output_tokens*2)/1e6,cost=Math.ceil(exact*1e6);assert.ok(cost<=ceiling);result.spentMicrousd+=cost;result.spentUsdExact+=exact;result.heldMicrousd-=ceiling;Object.assign(call,{status:payload.status,inputTokens:u.input_tokens,outputTokens:u.output_tokens,cachedTokens:cached,costUsdExact:exact,latencyMs:Date.now()-start});await persist();
   assert.equal(payload.status,'completed');assert.ok(!(payload.output??[]).some(v=>v.type==='function_call'),'No unexecuted tool may be described as success.');
   const parsed=normalizeOpenAiModelResult(extractOpenAiText(payload),item.language);assert.ok(parsed?.message?.length>=30);const answer=parsed.message;
   check(item.id+': real AI answer is localized and nonempty',item.language==='ru'?/[а-яё]/iu.test(answer):!/[а-яё]/iu.test(answer));
   const saved=await must(db.from('ai_messages').insert({telegram_id:owner,conversation_id:opened.conversationId,role:'assistant',content:answer,metadata:{luna4QualityEvaluation:{caseId:item.id,sourceCommit:options.sourceCommit}}}).select('id').single());
   const count=result.providerCalls,history=await getLunaConversation(owner,opened.conversationId);check(item.id+': saved answer reopens exactly without provider use',history.messages.some(m=>m.id===saved.id&&m.content===answer)&&result.providerCalls===count);
   call.answer=answer;call.question=item.question;call.humanReviewRequired=true;await persist();
  }
  await assert.rejects(getLunaConversation(owner+1,result.calls[0]?.conversationId??'71000000-0000-4000-8000-000000000001'));
  const ledger=await must(db.from('luna_seed_ledger').select('id').eq('telegram_id',owner));check('zero Moon Seeds charges and zero Stars purchases',ledger.length===0&&(await must(db.from('payments').select('id').eq('telegram_id',owner))).length===0);
  check('normal staging generation never enabled',(await must(db.from('luna32_runtime_settings').select('generation_enabled').eq('id',true).single())).generation_enabled===false);
  check('budget settled with no unknown provider outcome',result.providerCalls<=approved.responses&&result.transcriptions===0&&result.heldMicrousd===0&&result.spentMicrousd<=approved.microusd);
  result.status='PASS_REPRESENTATIVE_PROJECTION_SMOKE';finalState='completed';
 }catch(error){result.status=result.heldMicrousd?'UNKNOWN_COST':'FAIL';result.failure=String(error?.message??'qa_failed').slice(0,200);}
 finally{Object.assign(env,oldEnv);await must(db.from('luna30_qa_report_runs').update({state:finalState,result}).eq('run_name',runName).eq('state',lease));}
 return new Response(null,{status:204});
}
