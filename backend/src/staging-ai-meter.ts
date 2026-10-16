export function stagingAiMeterRecord(payload:unknown) {
  const value=payload as {model?:unknown;status?:unknown;service_tier?:unknown;usage?:{input_tokens?:unknown;output_tokens?:unknown;total_tokens?:unknown;input_tokens_details?:{cached_tokens?:unknown}}};
  const count=(item:unknown)=>typeof item==='number'&&Number.isSafeInteger(item)&&item>=0?item:null;
  const input=count(value?.usage?.input_tokens),output=count(value?.usage?.output_tokens),cached=count(value?.usage?.input_tokens_details?.cached_tokens)??0;
  if(input===null||output===null||cached>input||typeof value?.model!=='string'||!/^gpt-[a-z0-9-]{1,70}$/.test(value.model))return null;
  // Verified official standard GPT-5-mini rates on 2026-10-16. Never infer the
  // price of a future model from a shared name prefix.
  const known=['gpt-5-mini','gpt-5-mini-2025-08-07'].includes(value.model)&&['default','auto'].includes(String(value.service_tier));
  return {model:value.model,input_tokens:input,output_tokens:output,total_tokens:count(value.usage?.total_tokens)??input+output,
    request_status:value.status==='completed'?'success':'error',
    estimated_cost:known?((input-cached)*0.25+cached*0.025+output*2)/1000000:null};
}
export type StagingAiMeterRecord=NonNullable<ReturnType<typeof stagingAiMeterRecord>>;
