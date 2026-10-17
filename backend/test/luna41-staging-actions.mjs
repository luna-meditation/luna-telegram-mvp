// Four separately approved provider requests at most, synthetic staging owner.
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {authorizeLuna32Smoke,luna32StagingSite} from '../dist/luna32-staging-guard.js';
import {luna41EvaluationModels,evaluationCeiling,boundedQaReservation,evaluationUsage} from '../dist/luna41-evaluation-policy.js';
const must=async q=>{const r=await q;assert.ifError(r.error);return r.data;};
export async function run(request,context,options){
 const luna42=options.release==='luna42',runName=luna42?'luna42-action-language-20261017-v1':'luna41-action-language-20261017-v1';
 if(!authorizeLuna32Smoke(request,context.site?.id,options)||Netlify.env.get('SUPABASE_URL')!=='https://funvzpmpbgazsisehiru.supabase.co')return new Response(null,{status:403});
 const {netlifyStagingHandler}=await import('../dist/netlify-staging-handler.js');await netlifyStagingHandler(new Request('https://luna-staging-itfl.netlify.app/health'),{site:{id:luna32StagingSite},ip:'127.0.0.1'});
 const {supabase:db}=await import('../dist/db.js'),{env}=await import('../dist/config.js');assert.ok(env.STAGING_MODE&&env.SUPABASE_URL==='https://funvzpmpbgazsisehiru.supabase.co'&&env.AI_CHAT_MODEL==='gpt-5-mini');
 const stored=await must(db.from('luna30_qa_report_runs').select('state,result').eq('run_name',runName).maybeSingle());
 if(options.readOnly)return Response.json(stored??{state:'not_started',result:null},{headers:{'Cache-Control':'private, no-store'}});
 if(stored)return new Response(null,{status:204});
 const result={status:'RUNNING',sourceCommit:options.sourceCommit,approvedCalls:4,approvedMicrousd:20000,providerCalls:0,spentMicrousd:0,heldMicrousd:0,cases:[],productionTouched:false,moonSeedsChanged:false,playerStarted:false};
 const claim=await db.from('luna30_qa_report_runs').insert({run_name:runName,state:'running',result});if(claim.error?.code==='23505')return new Response(null,{status:204});assert.ifError(claim.error);
 const owner=luna42?420042003:410041003;let created=false;const persist=()=>must(db.from('luna30_qa_report_runs').update({result}).eq('run_name',runName).eq('state','running').select('run_name').single());
 try{
  if(luna42){const otherRuns=await must(db.from('luna30_qa_report_runs').select('run_name,state,result').in('run_name',['luna42-model-evaluation-20261017-v1','luna42-synthetic-transcription-20261017-v1']));assert.equal(otherRuns.length,2);assert.ok(otherRuns.every(row=>row.state==='completed'));result.priorApprovedSpendMicrousd=otherRuns.reduce((sum,row)=>sum+row.result.spentMicrousd+row.result.heldMicrousd,0);assert.ok(Number.isSafeInteger(result.priorApprovedSpendMicrousd)&&result.priorApprovedSpendMicrousd+result.approvedMicrousd<=2030000,'combined_approval_budget_exhausted');}
  assert.equal((await must(db.from('users').select('telegram_id').eq('telegram_id',owner))).length,0);await must(db.from('users').insert({telegram_id:owner,first_name:'Synthetic action QA',language_code:'en'}));created=true;
  const {buildLunaOpenAiRequest,normalizeOpenAiModelResult,resolveMeditationAction}=await import('../dist/luna-ai.js'),{getMeditations}=await import('../dist/db.js'),{createLunaTools,runLunaToolTurn,lunaToolInstructions}=await import('../dist/luna32-tools.js'),{safeAssistantProse}=await import('../dist/luna31-consultation.js'),{readyMeditationCopy}=await import('../dist/luna41-conversation.js');
  const items=(await getMeditations(owner,false)).filter(m=>m.published!==false).slice(0,3);assert.ok(items.length);
  const key=Netlify.env.get('OPENAI_API_KEY');assert.ok(key);const model=luna41EvaluationModels.find(m=>m.id==='gpt-5-mini');
  for(const language of ['en','ru']){
   const catalog=items.map(m=>({id:m.id,catalogKey:m.title.toLowerCase().replace(/[^a-zа-я0-9]+/gi,'_').slice(0,80),title:m.translations?.[language]?.title??m.title,category:m.category,mood:m.mood,duration:m.duration,durationSeconds:m.duration,summary:(m.translations?.[language]?.description??m.description).slice(0,200),premium:m.premium,published:true,audioLanguage:language}));
   const tools=createLunaTools({db,owner,operationKey:randomUUID(),language,readingContext:null,catalog,personalContext:null,access:{hasPremium:false,hasPaidPremium:false},quota:async()=>({remaining:1}),astrologyEnabled:false});
   const text=language==='en'?'Please answer in English. You are an AI, right? Recommend one existing short meditation to focus.':'Подбери медитацыю для фокуса из настоящей библиотеки. Ответь по-русски.';
   const body=buildLunaOpenAiRequest({language,catalog,context:{personalContext:null,profile:null,memories:[]},recent:[{role:'user',content:language==='en'?'Раньше мы говорили по-русски.':'Earlier we spoke English.'},{role:'assistant',content:language==='en'?'Да, это прежний язык разговора.':'That was the earlier conversation language.'},{role:'user',content:text}],maxOutputTokens:1200});
   const invoke=async requestBody=>{
    const ceiling=evaluationCeiling(requestBody,model);assert.ok(boundedQaReservation(result,ceiling,{calls:4,microusd:20000}),'qa_action_budget_exhausted');if(luna42)assert.ok(result.priorApprovedSpendMicrousd+result.spentMicrousd+result.heldMicrousd+ceiling<=2030000,'combined_approval_budget_exhausted');result.providerCalls++;result.heldMicrousd+=ceiling;result.activeCall={language,ceiling};await persist();
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(requestBody),signal:AbortSignal.timeout(45000)});const payload=await response.json(),usage=evaluationUsage(payload,model);assert.ok(response.ok&&usage&&usage.costMicrousd<=ceiling,'provider_result_unverified');result.spentMicrousd+=usage.costMicrousd;result.heldMicrousd-=ceiling;delete result.activeCall;await persist();return payload;
   };
   const response=await runLunaToolTurn({...body,instructions:body.instructions+'\n'+lunaToolInstructions},tools,invoke);assert.equal(response.status,'completed');
   const raw=(response.output??[]).filter(o=>o.type==='message').flatMap(o=>o.content??[]).filter(o=>o.type==='output_text').map(o=>o.text).join('\n');assert.ok(raw);
   const parsed=normalizeOpenAiModelResult({text:raw,refusal:null,path:'qa.synthetic'},language),selected=tools.meditationSelection(),action=resolveMeditationAction(selected?{type:'meditation_card',meditationId:selected.id}:parsed.meditationAction,catalog);assert.ok(action,'no_verified_meditation_card');
   const message=readyMeditationCopy(safeAssistantProse(parsed.message,language),language,true);assert.ok(message);assert.ok(items.some(m=>m.id===action.meditationId));
   result.cases.push({language,status:'PASS',validatedMeditationId:action.meditationId,toolOutcomes:tools.outcomes().map(o=>({tool:o.toolName,status:o.status})),message,cardAvailable:true,playbackStarted:false});await persist();
  }
  if(luna42){
   const {createAstrologyService}=await import('../dist/luna30-astrology-service.js'),{createAstrologyWorkflowService}=await import('../dist/luna33-workflows.js'),{verifiedAstrologyChatContext}=await import('../dist/luna30-astrology-chat-context.js');
   const astro=createAstrologyService(db,()=>true),workflows=createAstrologyWorkflowService(db,()=>true),location=(await astro.locations('London')).locations[0];assert.ok(location);
   const input={subjectKind:'self',label:'Synthetic A',date:'2000-01-01',time:'12:00',placeId:location.placeId,consent:true},first=await astro.save(owner,input),second=await astro.save(owner,{...input,subjectKind:'other',label:'Synthetic B',date:'2001-08-20'}),requestId=randomUUID();
   const selection={requestId,kind:'compatibility',language:'en',relationship:'business',firstProfileId:first.profile.id,secondProfileId:second.profile.id},saved=await workflows.open(owner,selection),reopened=await workflows.open(owner,selection);
   const snapshot=saved.message.metadata.astrologyWorkflow.compatibilitySnapshot;assert.equal(snapshot.reflection.version,'luna42-symbolic-index-v2');assert.deepEqual(reopened.message.metadata.astrologyWorkflow.compatibilitySnapshot,snapshot);
   const attachment=reopened.message.metadata.astrology,verified=await verifiedAstrologyChatContext(db,owner,attachment);assert.deepEqual(verified.compatibilityReflection,snapshot.reflection);assert.equal(verified.comparisonId,requestId);
   await assert.rejects(workflows.open(owner,{...selection,relationship:'romantic'}));await assert.rejects(verifiedAstrologyChatContext(db,420042004,attachment));
   result.compatibilityPersistence={status:'PASS',algorithm:snapshot.reflection.version,relationship:verified.relationship,reopenedWithoutGeneration:true,retargetingRejected:true,otherOwnerRejected:true,providerCalls:0};await persist();
  }
  result.status='PASS';
 }catch(error){result.status='FAIL';result.failure=/^[a-z_]{3,80}$/.test(error.message)?error.message:'qa_action_validation_failed';}
 finally{if(created)try{await must(db.from('users').delete().eq('telegram_id',owner));result.syntheticUserCleaned=true;}catch{result.status='FAIL';result.cleanupFailure=true;}await must(db.from('luna30_qa_report_runs').update({state:result.status==='PASS'?'completed':'failed',result}).eq('run_name',runName));}
 return new Response(null,{status:204});
}
