import test from 'node:test';import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {experienceInput,observeExperience,recordExperience} from './luna42-analytics.js';
const sessionId='00000000-0000-4000-8000-000000000042';
test('client telemetry accepts only known screen observations, never answers or forged save/consent events',()=>{
 for(const value of [{event:'onboarding_opened',sessionId},{event:'step_opened',step:'consent',sessionId},{event:'domain_opened',step:'career',sessionId}])assert.equal(experienceInput.safeParse(value).success,true);
 for(const value of [{event:'memory_saved',sessionId},{event:'step_completed',sessionId},{event:'domain_opened',step:'My secret job',sessionId},{event:'onboarding_opened',step:'name',sessionId},{event:'step_opened',step:'birth',sessionId,answer:'2000-01-01'},{event:'cosmos_opened',sessionId,owner:1}])assert.equal(experienceInput.safeParse(value).success,false);
});
test('telemetry is owner-bound, minimal, idempotent-keyed and best effort, not a financial operation',async()=>{
 const calls:unknown[]=[],db={rpc:async(name:string,args:unknown)=>{calls.push([name,args]);return{data:true,error:null};}} as unknown as SupabaseClient;
 assert.deepEqual(await observeExperience(db,42,{event:'step_opened',step:'name',sessionId}),{recorded:true});
 assert.deepEqual(calls[0],['luna42_record_experience',{p_owner:42,p_event:'step_opened',p_step:'name',p_key:sessionId,p_source:'client_observed'}]);
 await recordExperience(db,42,'memory_saved','',sessionId);assert.deepEqual(calls[1],['luna42_record_experience',{p_owner:42,p_event:'memory_saved',p_step:'',p_key:sessionId,p_source:'server_verified'}]);
 const broken={rpc:async()=>{throw new Error('unavailable');}} as unknown as SupabaseClient;
 assert.equal(await recordExperience(broken,42,'memory_saved'),false);assert.deepEqual(await observeExperience(broken,42,{event:'cosmos_opened',sessionId}),{recorded:false});
});
