/** Explicit owner-authorized maintenance only; never exposed as a public route. */
export function boundedQaRequest(body:unknown){
 const value=body as {model?:unknown;max_output_tokens?:unknown;tools?:unknown;store?:unknown};
 if(value.model!=='gpt-5-mini'||value.store!==false||value.tools!==undefined||typeof value.max_output_tokens!=='number'||value.max_output_tokens<512||value.max_output_tokens>1600)throw new Error('QA budget configuration rejected');
 const request={...(body as Record<string,unknown>),service_tier:'default'};
 // Conservative byte-based input ceiling including schema/envelope overhead.
 // Current standard rates: $0.25 input / $2 output per million tokens.
 const maximumCost=((Buffer.byteLength(JSON.stringify(request),'utf8')+1024)*0.25+value.max_output_tokens*2)/1_000_000;
 if(maximumCost>0.009)throw new Error('QA request exceeds approved $0.01 ceiling');
 return {request,maximumCost};
}
