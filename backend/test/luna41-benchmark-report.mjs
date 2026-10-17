// Offline analysis of synthetic provider evidence, not execution or human ratings.
import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';
import {createLunaTools} from '../src/luna32-tools.ts';import {luna41EvalCases} from './luna41-eval-cases.mjs';
const source=process.env.LUNA41_BENCHMARK_OUT??'/tmp/luna41-benchmark',row=JSON.parse(await readFile(source+'/results.json','utf8')),result=row.result;
assert.ok(result.providerCalls<=400&&result.spentMicrousd+result.heldMicrousd<=2000000);assert.equal(new Set(result.results.map(r=>r.caseId+':'+r.model)).size,result.results.length);
const definitions=createLunaTools({db:{},owner:40001,operationKey:'offline-analysis',language:'en',readingContext:null,catalog:[],personalContext:null,access:{},quota:async()=>({}),astrologyEnabled:true,navigation:{personal_memory:true,tarot_daily:true},commerce:{read:async()=>({}),eligibility:async()=>({})}}).definitions;
function matches(value,schema){
 if(schema.type==='object')return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>Object.hasOwn(schema.properties,k))&&schema.required.every(k=>Object.hasOwn(value,k))&&Object.entries(value).every(([key,item])=>matches(item,schema.properties[key]));
 if(schema.type==='string')return typeof value==='string'&&(!schema.enum||schema.enum.includes(value))&&(schema.format!=='uuid'||/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value));
 return false;
}
const percentile=(items,p)=>items.length?[...items].sort((a,b)=>a-b)[Math.min(items.length-1,Math.ceil(items.length*p)-1)]:null;
const models=result.availability.map(({model})=>{
 const all=result.results.filter(r=>r.model===model),completed=all.filter(r=>r.status==='completed'),calls=completed.flatMap(r=>r.calledTools),latency=completed.map(r=>r.latencyMs);
 const valid=calls.filter(c=>{try{const d=definitions.find(d=>d.name===c.name);return d&&matches(JSON.parse(c.arguments),d.parameters);}catch{return false;}});
 let structured=0;for(const r of completed.filter(r=>r.answer))try{const value=JSON.parse(r.answer);if(typeof value.message==='string'||typeof value.reply==='string')structured++;}catch{/* Plain text is kept as an observed format, not invented JSON. */}
 return{model,providerAttempts:all.length,completedResponses:completed.length,providerPolicyDeclines:all.filter(r=>r.status==='provider_policy_blocked').length,
  pairedCasesObserved:new Set(all.map(r=>r.caseId)).size,knownUsageCostMicrousd:completed.reduce((a,r)=>a+r.costMicrousd,0),unsettledCostHoldMicrousd:all.reduce((a,r)=>a+(r.costUnknownHoldMicrousd??0),0),
  inputTokens:completed.reduce((a,r)=>a+r.inputTokens,0),cachedInputTokens:completed.reduce((a,r)=>a+r.cachedInputTokens,0),cacheWriteTokens:completed.reduce((a,r)=>a+r.cacheWriteTokens,0),outputTokens:completed.reduce((a,r)=>a+r.outputTokens,0),
  medianFirstDecisionLatencyMs:percentile(latency,.5),p95FirstDecisionLatencyMs:percentile(latency,.95),toolCalls:calls.length,validToolArguments:valid.length,invalidToolArguments:calls.length-valid.length,
  strictExpectedSelectionMatches:completed.filter(r=>r.toolSelectionMatch).length,strictExpectedSelectionDenominator:completed.length,textResponses:completed.filter(r=>r.answer).length,observedStructuredTextResponses:structured,
  humanQualityScore:null,toolExecutionVerified:false};
});
const report={status:result.status,sourceCommit:result.sourceCommit,datasetCases:luna41EvalCases.length,providerCalls:result.providerCalls,knownUsageCostUsd:result.spentMicrousd/1e6,unsettledCostHoldUsd:result.heldMicrousd/1e6,approvedLimitUsd:2,models,
 limitations:['First provider decision only; real tools were not executed in this benchmark.','Synthetic catalog omits some production metadata. Looking up the catalog first is not necessarily a recommendation failure.','No multi-turn continuation or complete natal chart fixture in this dataset.','No numeric human quality ratings are invented. Text answers require separate representative review.','Provider policy refusals are terminal, not retried; no usage returned, so their conservative cost holds remain.','Usage-derived estimates are not a provider invoice. Latest post-foundation fixes are not covered by the pinned benchmark.'],productionModelChanged:false};
await writeFile(source+'/summary.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
