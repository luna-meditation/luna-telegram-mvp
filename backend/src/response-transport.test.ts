import test from 'node:test';import assert from 'node:assert/strict';
import {createLunaResponseTransport,responseOutputText} from './luna/response-transport.js';
test('server transport fails closed with no key and never retries',async()=>{
 const native=globalThis.fetch;let calls=0;
 globalThis.fetch=async(_url,options)=>{calls++;assert.equal(options?.method,'POST');assert.equal(JSON.parse(String(options?.body)).store,false);return new Response('{}',{status:429});};
 try{assert.throws(()=>createLunaResponseTransport(()=>undefined)({},AbortSignal.timeout(1000)));const response=await createLunaResponseTransport(()=>'synthetic-test-key')({store:false},AbortSignal.timeout(1000));assert.equal(response.status,429);assert.equal(calls,1);}finally{globalThis.fetch=native;}
});
test('response extractor does not mistake an incomplete response for generated text',()=>{assert.equal(responseOutputText({status:'incomplete',output:[{content:[{type:'output_text',text:'partial'}]}]}),null);assert.equal(responseOutputText({status:'completed',output:[{content:[{type:'output_text',text:'Neutral fixture'}]}]}),'Neutral fixture');});
