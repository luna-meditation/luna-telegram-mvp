import assert from 'node:assert/strict';
import {test} from 'node:test';
Object.assign(process.env,{BOT_TOKEN:'fixture',BOT_USERNAME:'luna_staging_qa_eger_bot',MINI_APP_URL:'https://luna-staging-itfl.netlify.app',SUPABASE_URL:'https://funvzpmpbgazsisehiru.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture',STAGING_MODE:'true',STAGING_HOST:'netlify',STAGING_TELEGRAM_IDS:'24001',STAGING_SUPABASE_PROJECT_REF:'funvzpmpbgazsisehiru',STAGING_TAROT_AI_QA_OWNER_ID:'24001',STAGING_TAROT_AI_QA_GRANT_ID:'00000000-0000-4000-8000-000000000024',FEATURE_AI_CENTRAL_EXPERIENCE:'true',FEATURE_TAROT_SPREAD_AI_QA:'true',AI_CHAT_MODEL:'gpt-5-mini',REMINDER_SCHEDULER_ENABLED:'false'});
const {env}=await import('./config.js');const {supabase}=await import('./db.js');
const {qaTarotEnabled,qaTarotLimits,qaTarotTransport}=await import('./staging-tarot-budget.js');
test('QA is pinned to staging project, explicit owner, model and disabled default flag',()=>{
 assert.equal(qaTarotEnabled(24001),true);assert.equal(qaTarotEnabled(24002),false);assert.equal(qaTarotLimits(24001).daily,8);assert.equal(qaTarotLimits(24002).daily,env.TAROT_AI_DAILY_LIMIT);
 for(const [key,value] of [['STAGING_MODE',false],['FEATURE_TAROT_SPREAD_AI_QA',false],['STAGING_SUPABASE_PROJECT_REF','vkcdtasbdoeilgfucoax'],['SUPABASE_URL','https://vkcdtasbdoeilgfucoax.supabase.co'],['AI_CHAT_MODEL','other-model']] as const){const before=env[key];Object.assign(env,{[key]:value});assert.equal(qaTarotEnabled(24001),false);Object.assign(env,{[key]:before});}
});
test('bounded provider requests reserve once, settle actual usage; duplicates and errors cannot retry',async()=>{
 let calls=0;const acquired=new Set<string>(),rpcCalls:Array<Record<string,unknown>>=[];const original=supabase.rpc;
 // Only in-memory fixture; no external keys, database or provider calls.
 supabase.rpc=((name:string,args:Record<string,unknown>)=>{rpcCalls.push({name,...args});if(name==='settle_luna24_qa_ai_call')return Promise.resolve({error:null,data:true});const id=String(args.p_client_reading_id);const fresh=!acquired.has(id);acquired.add(id);return Promise.resolve({error:null,data:{acquired:fresh}});}) as unknown as typeof supabase.rpc;
 const request={model:'gpt-5-mini',store:false,max_output_tokens:1600,input:[]};
 const provider=async(body:unknown)=>{calls++;assert.equal((body as {service_tier:string}).service_tier,'default');return Response.json({status:'completed',model:'gpt-5-mini-2025-08-07',service_tier:'default',usage:{input_tokens:500,output_tokens:200}});};
 try{
  const run=qaTarotTransport(24001,'00000000-0000-4000-8000-000000000001',provider);
  await run(request,AbortSignal.timeout(1000));assert.equal(calls,1);assert.equal(rpcCalls[1].p_actual_microusd,525);
  await assert.rejects(run(request,AbortSignal.timeout(1000)));assert.equal(calls,1);
  await assert.rejects(qaTarotTransport(24002,'x',provider)(request,AbortSignal.timeout(1000)));assert.equal(calls,1);
  for(const bad of [{...request,max_output_tokens:3601},{...request,model:'other'},{...request,store:true},{...request,tools:[]},{...request,input:'x'.repeat(16001)}])await assert.rejects(qaTarotTransport(24001,'bad',provider)(bad,AbortSignal.timeout(1000)));
  const before=rpcCalls.length;const fail=qaTarotTransport(24001,'00000000-0000-4000-8000-000000000002',async()=>{calls++;throw new Error('timeout');});
  await assert.rejects(fail(request,AbortSignal.timeout(1000)));assert.equal(rpcCalls.length,before+1);await assert.rejects(fail(request,AbortSignal.timeout(1000)));assert.equal(calls,2);
 }finally{supabase.rpc=original;}
});
test('production QA needs separate approval, exact production project and hard-pinned owner',()=>{
 const original={...env};try{
  Object.assign(env,{STAGING_MODE:false,SUPABASE_URL:'https://vkcdtasbdoeilgfucoax.supabase.co',FEATURE_TAROT_RELEASE_AI_QA:true,RELEASE_TAROT_AI_QA_OWNER_ID:158467796,RELEASE_TAROT_AI_QA_GRANT_ID:'00000000-0000-4000-8000-000000000025'});
  assert.equal(qaTarotEnabled(158467796),true);assert.equal(qaTarotEnabled(24001),false);
  env.RELEASE_TAROT_AI_QA_OWNER_ID=24001;assert.equal(qaTarotEnabled(24001),false);env.RELEASE_TAROT_AI_QA_OWNER_ID=158467796;
  env.FEATURE_TAROT_RELEASE_AI_QA=false;assert.equal(qaTarotEnabled(158467796),false);
  env.FEATURE_TAROT_RELEASE_AI_QA=true;env.SUPABASE_URL='https://funvzpmpbgazsisehiru.supabase.co';assert.equal(qaTarotEnabled(158467796),false);
 }finally{Object.assign(env,original);}
});
