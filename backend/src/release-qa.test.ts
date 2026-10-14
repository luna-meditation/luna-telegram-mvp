import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {boundedQaRequest} from './release-qa-policy.js';
test('authorized QA forces standard tier and a conservative sub-cent budget',()=>{
 const body={model:'gpt-5-mini',store:false,max_output_tokens:1600,input:'neutral QA',service_tier:'priority'};
 const value=boundedQaRequest(body);assert.equal(value.request.service_tier,'default');assert.ok(value.maximumCost<0.01);
 for(const invalid of [{...body,model:'gpt-5'},{...body,tools:[]},{...body,store:true},{...body,max_output_tokens:2000},{...body,input:'x'.repeat(40000)}])assert.throws(()=>boundedQaRequest(invalid));
});
test('QA is opt-in server maintenance with owner scoping, caching and no personal context',()=>{
 const source=readFileSync('src/release-qa.ts','utf8');
 assert.match(source,/if\(!env.RELEASE_QA_TAROT_ENABLED\)return/);assert.match(source,/excludePersonalContext:true/);assert.match(source,/if\(\+\+calls>1\)/);assert.match(source,/getTarotReading\(user/);assert.match(source,/preservedUserGardenProfile:true/);
 assert.doesNotMatch(source,/initData|\.insert\(|users'\)\.update|bot\.|app\.(get|post)/);
 const config=readFileSync('src/config.ts','utf8');assert.match(config,/RELEASE_QA_TAROT_ENABLED: envBoolean.default\(false\)/);
});
