import test from 'node:test';import assert from 'node:assert/strict';
import {EvaluationBudget,evaluationCeiling} from './core-v1-eval-budget.mjs';
import {mkdtemp,mkdir,writeFile,access,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const body={model:'gpt-5-mini',store:false,service_tier:'default',max_output_tokens:2600,input:[{role:'user',content:'Synthetic only'}]};
test('unknown provider outcomes retain their entire hold and attempts cannot be retried beyond the cap',()=>{const budget=new EvaluationBudget(2000000,2),one=budget.reserve(body);assert.equal(budget.settle(one,undefined),null);budget.reserve(body);assert.throws(()=>budget.reserve(body),/attempt_cap/);assert.equal(budget.snapshot().heldMicrousd,2*evaluationCeiling(body));});
test('the full next request is reserved before dispatch; a failure cannot release unobserved cost',()=>{const limit=evaluationCeiling(body),budget=new EvaluationBudget(limit);budget.reserve(body);assert.throws(()=>budget.reserve(body),/cost_cap/);assert.equal(budget.snapshot().attempts,1);});
test('usage counts reasoning in output once and cached input at its published rate',()=>{const budget=new EvaluationBudget(),hold=budget.reserve(body);assert.equal(budget.settle(hold,{input_tokens:1000,input_tokens_details:{cached_tokens:100},output_tokens:500,output_tokens_details:{reasoning_tokens:200}}),1228);assert.equal(budget.snapshot().heldMicrousd,0);assert.throws(()=>budget.settle(hold,{input_tokens:1,output_tokens:1}),/already_settled/);});
test('unapproved model, retention, tier and oversized output cannot reserve money',()=>{for(const change of [{model:'another-model'},{store:true},{service_tier:'priority'},{max_output_tokens:2601}])assert.throws(()=>evaluationCeiling({...body,...change}));});
test('a duplicate run stops before any dispatch and still removes the temporary credential file',async()=>{
 const root=fileURLToPath(new URL('../../',import.meta.url)),folder=await mkdtemp(resolve(tmpdir(),'luna-eval-cleanup-')),out=resolve(folder,'out'),key=resolve(folder,'synthetic-key');
 try{
  await mkdir(out);await writeFile(resolve(out,'run.lock'),'synthetic duplicate run');await writeFile(key,'sk-synthetic-test-only-never-a-real-credential',{mode:0o600});
  const result=await new Promise(done=>{const child=spawn(process.execPath,[resolve(root,'scripts/evaluate-intelligence-core-v1.mjs'),'--live','--approval=80_attempts_2_usd_synthetic_only','--baseline='+root,'--candidate='+root,'--out='+out,'--key-file='+key],{env:{PATH:process.env.PATH,NODE_OPTIONS:'--import '+resolve(root,'backend/test/intelligence-core-network-guard.mjs')},stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',value=>error+=value.toString());child.on('exit',code=>done({code,error}));child.on('error',error=>done({code:127,error:String(error)}));});
  assert.notEqual(result.code,0);assert.match(result.error,/EEXIST/);await assert.rejects(access(key),{code:'ENOENT'});
 }finally{await rm(folder,{recursive:true,force:true});}
});
