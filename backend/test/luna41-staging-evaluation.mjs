// Expiring, authenticated QA worker. Only synthetic prompts are ever sent.
// The existing key is read inside Netlify; it never leaves server memory.
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {authorizeLuna32Smoke,luna32StagingSite} from '../dist/luna32-staging-guard.js';
import {luna41EvalCases} from './luna41-eval-cases.mjs';
import {luna41EvaluationModels as models,evaluationCanReserve,evaluationCeiling,evaluationUsage} from '../dist/luna41-evaluation-policy.js';
const runName='luna41-model-evaluation-20261017-v1';
const check=async q=>{const r=await q;assert.ifError(r.error);return r.data;};
export async function run(request,context,options){
 if(!authorizeLuna32Smoke(request,context.site?.id,options)||Netlify.env.get('SUPABASE_URL')!=='https://funvzpmpbgazsisehiru.supabase.co')return new Response(null,{status:403});
 const {netlifyStagingHandler}=await import('../dist/netlify-staging-handler.js');await netlifyStagingHandler(new Request('https://luna-staging-itfl.netlify.app/health'),{site:{id:luna32StagingSite},ip:'127.0.0.1'});
 const {supabase:db}=await import('../dist/db.js'),{env}=await import('../dist/config.js');assert.ok(env.STAGING_MODE&&env.STAGING_SUPABASE_PROJECT_REF==='funvzpmpbgazsisehiru');
 const headers={'Cache-Control':'private, no-store'},stored=await check(db.from('luna30_qa_report_runs').select('state,result').eq('run_name',runName).maybeSingle());
 if(options.readOnly){const foundation=await check(db.from('luna30_qa_report_runs').select('state,result').eq('run_name','luna41-foundation-20261017-v1').maybeSingle());return Response.json({...stored??{state:'not_started',result:null},foundation},{headers});}
 const command=await request.json();assert.ok(['inventory','batch','foundation'].includes(command.action));assert.match(command.batchId,/^[a-f0-9-]{36}$/);
 if(command.action==='foundation'){const {runFoundation}=await import('./luna41-staging-foundation.mjs');await runFoundation(db,env,options.sourceCommit);return new Response(null,{status:204});}
 if(!stored){const result={dataset:'luna41-paired-v1',sourceCommit:options.sourceCommit,datasetCases:100,approvedCalls:400,approvedMicrousd:2_000_000,providerCalls:0,spentMicrousd:0,heldMicrousd:0,status:'IN_PROGRESS',results:[],completedBatches:[],humanQualityScores:null,productionTouched:false,toolExecutionVerified:false};const created=await db.from('luna30_qa_report_runs').insert({run_name:runName,state:'paused',result});if(created.error?.code==='23505')return new Response(null,{status:204});assert.ifError(created.error);}
 const claim='running:'+randomUUID(),claimed=await check(db.from('luna30_qa_report_runs').update({state:claim}).eq('run_name',runName).eq('state','paused').select('result').maybeSingle());
 if(!claimed)return new Response(null,{status:204});
 const result=claimed.result;let finalState='paused';
 const persist=()=>check(db.from('luna30_qa_report_runs').update({result}).eq('run_name',runName).eq('state',claim).select('run_name').single());
 try{
  assert.equal(result.dataset,'luna41-paired-v1');assert.equal(result.sourceCommit,options.sourceCommit,'source_changed_requires_review');assert.ok(!result.activeCall,'unknown_call_requires_reconciliation');
  if(result.completedBatches.includes(command.batchId))return new Response(null,{status:204});
  const key=Netlify.env.get('OPENAI_API_KEY');assert.ok(key,'server_key_unavailable');const providerHeaders={Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
  if(!result.availability){const r=await fetch('https://api.openai.com/v1/models',{headers:providerHeaders,signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,'inventory_unavailable');const p=await r.json();result.availability=models.map(m=>({model:m.id,available:p.data?.some(v=>v.id===m.id)===true}));await persist();}
  if(command.action==='inventory'){result.completedBatches.push(command.batchId);return new Response(null,{status:204});}
  if(result.status!=='IN_PROGRESS'){finalState='completed';return new Response(null,{status:204});}
  const {buildLunaOpenAiRequest}=await import('../dist/luna-ai.js'),{createLunaTools,lunaToolInstructions}=await import('../dist/luna32-tools.js');
  const catalog=[{id:'00000000-0000-4000-8000-000000000001',title:'Synthetic Focus',duration:180,durationSeconds:180,published:true,premium:false,language:'en',summary:'Synthetic catalog fixture, not a live meditation.'}];
  const readingId='00000000-0000-4000-8000-000000000002',readingContext={id:readingId,kind:'three',cards:[{cardId:'the-star',orientation:'reversed',position:'Present'},{cardId:'the-hermit',orientation:'upright',position:'Challenge'},{cardId:'strength',orientation:'upright',position:'Next perspective'}],question:'Synthetic question: how can I approach a new project?',intention:'growth',savedInterpretation:null};
  const registry=createLunaTools({db:{},owner:40001,operationKey:'synthetic-benchmark',language:'en',readingId,readingContext,catalog,personalContext:null,access:{plan:'Lifetime',hasPremium:true},quota:async()=>({remaining:2}),astrologyEnabled:true,navigation:{personal_memory:true,tarot_daily:true},commerce:{read:async()=>({}),eligibility:async()=>({})}});
  const done=new Set(result.results.map(v=>v.caseId+':'+v.model)),tasks=luna41EvalCases.flatMap(item=>models.map(model=>({item,model}))).filter(({item,model})=>!done.has(item.id+':'+model.id)&&result.availability.some(v=>v.model===model.id&&v.available));
  // Ten serial requests fit below the function's 15 minute ceiling even if all
  // reach the 45s provider timeout. There are no automatic provider retries.
  for(const {item,model} of tasks.slice(0,10)){
   const context={profile:null,memories:[],personalContext:null,...(item.category==='tarot'?{modeContext:{mode:'tarot',personalContext:null,readingContext}}:{})};
   const base=buildLunaOpenAiRequest({language:item.language,catalog,context,recent:[{role:'user',content:item.message}],maxOutputTokens:1200}),body={...base,model:model.id,instructions:base.instructions+'\n'+lunaToolInstructions,tools:registry.definitions,tool_choice:'auto',parallel_tool_calls:false};if(model.reasoning)body.reasoning={effort:model.reasoning};else delete body.reasoning;
   const ceiling=evaluationCeiling(body,model);if(!evaluationCanReserve(result,ceiling)){result.status='BUDGET_LIMITED';finalState='completed';break;}
   result.providerCalls++;result.heldMicrousd+=ceiling;result.activeCall={model:model.id,caseId:item.id,ceiling};await persist();const start=Date.now();
   let response,payload;try{response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:providerHeaders,body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});payload=await response.json();}catch{result.status='UNKNOWN_COST';finalState='blocked';break;}
   const meter=evaluationUsage(payload,model);if(!response.ok||!meter){result.status='PROVIDER_ERROR';result.error={status:response.status,code:typeof payload.error?.code==='string'?payload.error.code:null};finalState='blocked';break;}
   result.heldMicrousd-=ceiling;result.spentMicrousd+=meter.costMicrousd;delete result.activeCall;
   const called=(payload.output??[]).filter(v=>v.type==='function_call').map(v=>({name:v.name,arguments:v.arguments})),answer=(payload.output??[]).filter(v=>v.type==='message').flatMap(v=>v.content??[]).filter(v=>v.type==='output_text').map(v=>v.text).join('\n');
   result.results.push({caseId:item.id,model:model.id,language:item.language,category:item.category,latencyMs:Date.now()-start,status:payload.status,...meter,calledTools:called,expectedTools:item.expectedTools,toolSelectionMatch:item.expectedTools.length?called.some(v=>item.expectedTools.includes(v.name)):called.length===0,answer:answer||null,proseQualityScore:null});await persist();
   if(meter.costMicrousd>ceiling){result.status='COST_OVERRUN';finalState='blocked';break;}
  }
  if(!result.activeCall&&result.results.length===400){result.status='PROVIDER_DATA_COLLECTED_AWAITING_REVIEW';finalState='completed';}
  else if(!result.activeCall&&tasks.length<=10&&result.status==='IN_PROGRESS'){result.status='INCOMPLETE_AVAILABILITY';finalState='completed';}
  result.completedBatches.push(command.batchId);
 }catch(error){result.status='STOPPED_SAFELY';result.failureCode=/^[a-z_]{3,80}$/.test(error.message)?error.message:'qa_assertion_failed';finalState='blocked';}
 finally{await check(db.from('luna30_qa_report_runs').update({state:finalState,result}).eq('run_name',runName).eq('state',claim));}
 return new Response(null,{status:204});
}
