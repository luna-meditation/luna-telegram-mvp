import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForProductBackend} from '../scripts/wait-product-v2-backend.mjs';
const commit='a'.repeat(40),good={ok:true,service:'luna-backend',runtime:{commit,projectRef:'vkcdtasbdoeilgfucoax'},luna21:{telegramReady:true}};
const response=body=>({ok:true,json:async()=>body});
test('frontend release waits for the exact healthy backend and keeps the old frontend on mismatches',async()=>{
 const samples=[{...good,runtime:{...good.runtime,commit:'b'.repeat(40)}},good];let calls=0,delays=0;
 assert.equal(await waitForProductBackend(commit,{fetcher:async()=>response(samples[calls++]),delay:async()=>{delays++;},attempts:2}),true);assert.equal(calls,2);assert.equal(delays,1);
});
test('wrong database project or unready Telegram blocks frontend publication',async()=>{
 for(const sample of [{...good,runtime:{...good.runtime,projectRef:'another-project'}},{...good,luna21:{telegramReady:false}},{ok:true,commit}])await assert.rejects(waitForProductBackend(commit,{fetcher:async()=>response(sample),attempts:1}),/publication is blocked/);
});
