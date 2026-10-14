import assert from 'node:assert/strict';
import test from 'node:test';
import {stagingAiMeterRecord} from './staging-ai-meter.js';
test('staging meter retains only safe cost metadata, not prompts, output or secrets',()=>{
  const record=stagingAiMeterRecord({model:'gpt-5-mini-2025-08-07',status:'completed',service_tier:'default',usage:{input_tokens:1000,output_tokens:500,total_tokens:1500,input_tokens_details:{cached_tokens:200}},secret:'synthetic-key',output:'Synthetic private text'});
  assert.deepEqual(record,{model:'gpt-5-mini-2025-08-07',input_tokens:1000,output_tokens:500,total_tokens:1500,request_status:'success',estimated_cost:0.001205});
  assert.equal(JSON.stringify(record).includes('synthetic'),false);
});
test('unknown prices and invalid meter payloads never invent a charge',()=>{
  assert.equal(stagingAiMeterRecord({model:'synthetic-key',usage:{input_tokens:1,output_tokens:2}}),null);
  assert.equal(stagingAiMeterRecord({model:'gpt-5-mini',usage:{input_tokens:-1,output_tokens:2}}),null);
  assert.equal(stagingAiMeterRecord({model:'gpt-5-mini',service_tier:'priority',usage:{input_tokens:1,output_tokens:2}})?.estimated_cost,null);
  assert.equal(stagingAiMeterRecord({model:'gpt-unknown',service_tier:'default',usage:{input_tokens:1,output_tokens:2}})?.estimated_cost,null);
});
