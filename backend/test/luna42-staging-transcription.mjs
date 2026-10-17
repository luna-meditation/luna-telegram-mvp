// Fixed synthetic audio only. This private, expiring worker tests the actual
// transcription service with a separately approved durable QA budget. It does
// NOT turn on the application-wide generation guard or claim to test its RPCs.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {authorizeLuna32Smoke,luna32StagingSite} from '../dist/luna32-staging-guard.js';
const runName='luna42-synthetic-transcription-20261017-v1',approvedMicrousd=30000;
const must=async query=>{const r=await query;assert.ifError(r.error);return r.data;};

export async function run(request,context,options){
 if(!authorizeLuna32Smoke(request,context.site?.id,options)||Netlify.env.get('SUPABASE_URL')!=='https://funvzpmpbgazsisehiru.supabase.co')return new Response(null,{status:403});
 const {netlifyStagingHandler}=await import('../dist/netlify-staging-handler.js');
 await netlifyStagingHandler(new Request('https://luna-staging-itfl.netlify.app/health'),{site:{id:luna32StagingSite},ip:'127.0.0.1'});
 const {supabase:db}=await import('../dist/db.js'),{env}=await import('../dist/config.js');
 assert.ok(env.STAGING_MODE&&env.STAGING_SUPABASE_PROJECT_REF==='funvzpmpbgazsisehiru');
 let stored=await must(db.from('luna30_qa_report_runs').select('state,result').eq('run_name',runName).maybeSingle());
 if(options.readOnly)return Response.json(stored??{state:'not_started',result:null},{headers:{'Cache-Control':'private, no-store'}});
 if(!stored){
  const created=await db.from('luna30_qa_report_runs').insert({run_name:runName,state:'paused',result:{sourceCommit:options.sourceCommit,status:'IN_PROGRESS',approvedMicrousd,spentMicrousd:0,heldMicrousd:0,providerCalls:0,requests:[],results:[],productionTouched:false,personalAudioStored:false,budgetAdapter:'isolated-synthetic-run-ledger',applicationBudgetRpcVerified:false}});
  if(created.error?.code==='23505')return new Response(null,{status:204});assert.ifError(created.error);
 }
 const claim='running:'+randomUUID(),claimed=await must(db.from('luna30_qa_report_runs').update({state:claim}).eq('run_name',runName).eq('state','paused').select('result').maybeSingle());
 if(!claimed)return new Response(null,{status:204});
 const result=claimed.result;let finalState='paused';
 const persist=()=>must(db.from('luna30_qa_report_runs').update({result}).eq('run_name',runName).eq('state',claim).select('run_name').single());
 try{
  assert.equal(result.sourceCommit,options.sourceCommit);assert.equal(result.approvedMicrousd,approvedMicrousd);
  assert.ok(!result.requests.some(v=>v.state==='reserved'||v.state==='unknown'),'unknown_outcome_do_not_retry');
  const key=Netlify.env.get('OPENAI_API_KEY');assert.ok(key);
  if(!result.available){const r=await fetch('https://api.openai.com/v1/models',{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);const body=await r.json();result.available=body.data.some(v=>v.id==='gpt-4o-mini-transcribe');await persist();assert.ok(result.available);}
  const {createVoiceService}=await import('../dist/luna42-voice.js');
  // Only this closed-over adapter handles the fixed synthetic IDs. No app data,
  // user quota, wallet or global budget configuration is read or modified.
  const adapter={async rpc(name,p){
   assert.equal(p.p_owner,420042900);
   if(name==='luna42_reserve_voice'){
    const old=result.requests.find(v=>v.requestId===p.p_request);
    if(old)return {data:old.hash!==p.p_hash?{status:'conflict'}:old.state==='ready'?{status:'cached',text:old.text,costMicrousd:old.costMicrousd}:{status:'in_progress'},error:null};
    if(result.providerCalls>=3||result.spentMicrousd+result.heldMicrousd+20000>approvedMicrousd)return {data:{status:'budget'},error:null};
    result.requests.push({requestId:p.p_request,hash:p.p_hash,state:'reserved',language:p.p_language});result.providerCalls++;result.heldMicrousd+=20000;await persist();return {data:{status:'reserved'},error:null};
   }
   assert.equal(name,'luna42_settle_voice');const row=result.requests.find(v=>v.requestId===p.p_request);assert.equal(row?.state,'reserved');
   if(p.p_cost===null){row.state='unknown';await persist();return {data:true,error:null};}
   assert.ok(Number.isSafeInteger(p.p_cost)&&p.p_cost>=0);row.state=p.p_text?'ready':'failed';row.text=p.p_text;row.costMicrousd=p.p_cost;result.spentMicrousd+=p.p_cost;result.heldMicrousd-=20000;await persist();return {data:true,error:null};
  }};
  let actualCalls=0;
  const voice=createVoiceService(adapter,{enabled:()=>true,key:()=>key,transport:async(...args)=>{actualCalls++;return fetch(...args);}});
  assert.equal(options.samples.length,3);
  for(const sample of options.samples){
   if(result.results.some(v=>v.language===sample.language))continue;
   const wav=Buffer.from(sample.base64,'base64'),input={requestId:sample.requestId,language:sample.language==='en'?'en':'ru'},start=Date.now();
   const transcript=await voice.transcribe(420042900,input,wav),callsBefore=actualCalls;
   const again=await voice.transcribe(420042900,input,wav);assert.equal(again.cached,true);assert.equal(again.text,transcript.text);assert.equal(actualCalls,callsBefore);
   result.results.push({language:sample.language,text:transcript.text,costMicrousd:transcript.costMicrousd,latencyMs:Date.now()-start,reopenCached:true,duplicateProviderCalls:0,expected:sample.expected});await persist();
  }
  assert.equal(result.results.length,3);assert.ok(result.spentMicrousd<=approvedMicrousd&&result.heldMicrousd===0);result.status='TRANSCRIPTS_COLLECTED_AWAITING_REVIEW';finalState='completed';
 }catch(error){result.status='STOPPED_SAFELY';result.failureCode=/^[a-z_]{3,80}$/.test(error.message)?error.message:'transcription_check_failed';finalState='blocked';}
 finally{await must(db.from('luna30_qa_report_runs').update({state:finalState,result}).eq('run_name',runName).eq('state',claim));}
 return new Response(null,{status:204});
}
