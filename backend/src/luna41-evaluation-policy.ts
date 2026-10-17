/** QA-only prices verified against the official standard-tier price list on
 * 2026-10-17. Never used to select a production model or alter its ledger. */
export const luna41EvaluationModels=[
 {id:'gpt-5-mini',input:.25,cached:.025,cacheWrite:.25,output:2,reasoning:'minimal'},
 {id:'gpt-4o-mini',input:.15,cached:.075,cacheWrite:.15,output:.6,reasoning:null},
 {id:'gpt-4.1',input:2,cached:.5,cacheWrite:2,output:8,reasoning:null},
 {id:'gpt-6.1-sol',input:2,cached:.1,cacheWrite:2.5,output:10,reasoning:'low'}
] as const;
export const luna41EvaluationLimit={calls:400,microusd:2_000_000};
export function evaluationCeiling(body:unknown,model:typeof luna41EvaluationModels[number],maxOutput=1200){
 // UTF-8 bytes + framing are a conservative token bound for these text-only
 // requests. Reasoning is part of max_output_tokens, not a separate allowance.
 return Math.ceil((Buffer.byteLength(JSON.stringify(body),'utf8')+1024)*Math.max(model.input,model.cacheWrite)+maxOutput*model.output);
}
export function evaluationUsage(payload:unknown,model:typeof luna41EvaluationModels[number]){
 const p=payload as {model?:string;service_tier?:string;usage?:{input_tokens?:number;output_tokens?:number;input_tokens_details?:{cached_tokens?:number;cache_write_tokens?:number}}};
 if(!(p?.model===model.id||p?.model?.startsWith(model.id+'-20'))||!['default','auto'].includes(p.service_tier??''))return null;
 const input=p.usage?.input_tokens,output=p.usage?.output_tokens,cached=p.usage?.input_tokens_details?.cached_tokens??0,written=p.usage?.input_tokens_details?.cache_write_tokens??(model.cacheWrite>model.input?undefined:0);
 if(![input,output,cached,written].every(v=>Number.isSafeInteger(v)&&Number(v)>=0)||cached+Number(written)>Number(input))return null;
 return {inputTokens:input!,cachedInputTokens:cached,cacheWriteTokens:written!,outputTokens:output!,costMicrousd:Math.ceil((input!-cached-written!)*model.input+cached*model.cached+written!*model.cacheWrite+output!*model.output)};
}
export function boundedQaReservation(state:{providerCalls:number;spentMicrousd:number;heldMicrousd:number;activeCall?:unknown},ceiling:number,limit:{calls:number;microusd:number}){
 return !state.activeCall&&[state.providerCalls,state.spentMicrousd,state.heldMicrousd,ceiling,limit.calls,limit.microusd].every(v=>Number.isSafeInteger(v)&&v>=0)&&ceiling>0&&limit.calls>0&&limit.microusd>0&&state.providerCalls<limit.calls&&state.spentMicrousd+state.heldMicrousd+ceiling<=limit.microusd;
}
export function evaluationCanReserve(state:{providerCalls:number;spentMicrousd:number;heldMicrousd:number;activeCall?:unknown},ceiling:number){return boundedQaReservation(state,ceiling,luna41EvaluationLimit);}
