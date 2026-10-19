import test from 'node:test';import assert from 'node:assert/strict';import type {SupabaseClient} from '@supabase/supabase-js';
import {reserveContractTarot,readTarotPrices,readDailyQuote,reserveDailyCard,buyContractReading} from './luna4-tarot.js';
import {chatTarotState,nextReveal} from './luna24-policy.js';
test('finite Tarot uses the existing draw engine adapter; only missing schema may use the older entrypoint',async()=>{
 for(const code of [null,'PGRST202','42501','network']){const calls:string[]=[],db={from(){const q={select(){return q;},eq(){return q;},single:async()=>({error:null,data:{catalog:{version:'luna-4.3'}}})};return q;},rpc:async(name:string)=>{calls.push(name);return{data:code?null:{status:'local'},error:code?{code}:null};}} as unknown as SupabaseClient;await reserveContractTarot(db,{p_telegram_id:1});assert.deepEqual(calls,code==='PGRST202'?['luna4_reserve_tarot_spread','reserve_luna_tarot_spread']:['luna4_reserve_tarot_spread']);}
});
test('a half-deployed new catalog cannot fall back to old free daily access or old purchase prices',async()=>{
 const calls:string[]=[],db={from(){const q={select(){return q;},eq(){return q;},single:async()=>({error:null,data:{catalog:{version:'luna-4.0-completion-v1'}}})};return q;},rpc:async(name:string)=>{calls.push(name);return{data:null,error:{code:'PGRST202'}};}} as unknown as SupabaseClient;
 for(const run of[()=>readTarotPrices(db),()=>readDailyQuote(db,1),()=>reserveDailyCard(db,{p_telegram_id:1}),()=>buyContractReading(db,{p_telegram_id:1}),()=>reserveContractTarot(db,{p_telegram_id:1})])await assert.rejects(run(),e=>(e as{code?:string}).code==='reading_price_unavailable');assert.equal(calls.some(n=>n.startsWith('reserve_luna_')||n.startsWith('luna21_')),false);
});
test('daily old-schema compatibility strips new consent args and never treats permission errors as free access',async()=>{
 for(const code of['PGRST202','42501']){const calls:Array<{name:string;args:unknown}>=[],db={from(){const q={select(){return q;},eq(){return q;},single:async()=>({error:null,data:{catalog:{version:'luna-4.3'}}})};return q;},rpc:async(name:string,args:unknown)=>{calls.push({name,args});return{data:null,error:{code}};}} as unknown as SupabaseClient;await reserveDailyCard(db,{p_telegram_id:1,p_generate:true,p_confirmed:true,p_expected_seeds:5});assert.equal(calls.length,code==='PGRST202'?2:1);if(code==='PGRST202')assert.deepEqual(calls[1].args,{p_telegram_id:1,p_generate:true});await assert.rejects(readDailyQuote({...db,rpc:async()=>({data:null,error:{code:'42501'}})} as unknown as SupabaseClient,1));}
});
test('all reveal steps preserve the exact saved paid order, and old unpaid attachments remain valid',()=>{
 const value={readingId:'00000000-0000-4000-8000-000000000001',clientReadingId:'00000000-0000-4000-8000-000000000002',kind:'three' as const,revealed:0,requestHash:'a'.repeat(64),orderId:'00000000-0000-4000-8000-000000000003'};let state=chatTarotState.parse(value);for(let i=0;i<3;i++){state=nextReveal(state,i);assert.equal(state.orderId,value.orderId);}const{orderId,...old}=value;void orderId;assert.equal(chatTarotState.parse(old).orderId,undefined);
});
test('a disabled backend quota guard cannot silently grant new finite included readings',async()=>{
 const calls:string[]=[],db={rpc:async(name:string)=>{calls.push(name);return{error:null,data:name==='luna4_reserve_tarot_spread'?{acquired:true}:{enabled:true,contractVersion:'luna-4.0-completion-v1'}};}} as unknown as SupabaseClient;
 await assert.rejects(reserveContractTarot(db,{p_telegram_id:1,p_kind:'three'},false),e=>(e as{code?:string}).code==='allowance_configuration_required');assert.deepEqual(calls,['luna4_reserve_tarot_spread','luna4_allowance_status']);
});
