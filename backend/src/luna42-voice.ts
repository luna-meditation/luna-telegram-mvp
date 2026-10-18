import {createHash} from 'node:crypto';import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';import {validateVoiceWav,voiceMetadata,transcriptionModel,transcriptionUsage} from './luna42-voice-policy.js';
export function createVoiceService(db:SupabaseClient,config:{key:()=>string|undefined;enabled:()=>boolean;transport?:typeof fetch;stagingQa?:{owner:number;grant:string}}){
 return {async transcribe(owner:number,input:unknown,wav:Buffer){
  if(!config.enabled())throw new FoundationError(404,'feature_disabled','Voice input is unavailable.');const key=config.key();if(!key)throw new FoundationError(503,'voice_unavailable','Voice input is unavailable.');const v=voiceMetadata.parse(input);let audio;try{audio=validateVoiceWav(wav);}catch(e){throw new FoundationError(422,e instanceof Error?e.message:'invalid_voice_audio','Use a clear recording of up to 45 seconds.');}
  const qa=config.stagingQa?.owner===owner?config.stagingQa:undefined;
  const hash=createHash('sha256').update(wav).digest('hex');const reserve=await db.rpc(qa?'luna42_reserve_voice_qa':'luna42_reserve_voice',{p_owner:owner,p_request:v.requestId,p_hash:hash,p_language:v.language,p_duration:audio.durationMs,...(qa?{p_grant:qa.grant}:{})});if(reserve.error||!reserve.data)throw new FoundationError(503,'voice_budget_unavailable','Voice usage could not be reserved.');
  if(reserve.data.status==='cached')return{text:reserve.data.text,requestId:v.requestId,cached:true,costMicrousd:reserve.data.costMicrousd};
  if(reserve.data.status!=='reserved')throw new FoundationError(reserve.data.status==='daily_limit'?429:['conflict','in_progress'].includes(reserve.data.status)?409:503,'voice_'+reserve.data.status,'This voice request cannot be repeated. Your conversation is unchanged.');
  const started=performance.now();let settled=false;
  const settle=async(text:string|null,cost:number|null,input:number|null,output:number|null)=>{const r=await db.rpc(qa?'luna42_settle_voice_qa':'luna42_settle_voice',{p_owner:owner,p_request:v.requestId,p_text:text,p_cost:cost,p_input:input,p_output:output,p_latency:Math.round(performance.now()-started),...(qa?{p_grant:qa.grant}:{})});if(r.error||r.data!==true)throw new FoundationError(503,'voice_accounting_failed','Usage could not be verified.');settled=true;};
  try{
   const form=new FormData();form.set('model',transcriptionModel);form.set('file',new Blob([Uint8Array.from(wav)],{type:'audio/wav'}),'voice.wav');form.set('response_format','json');form.set('prompt',v.language==='ru'?'Luna, Moon Seeds, Moon Garden. Русская и английская речь.':'Luna, Moon Seeds, Moon Garden. English and Russian speech.');
   const response=await(config.transport??fetch)('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form,signal:AbortSignal.timeout(45000)});if(!response.ok)throw new FoundationError(503,'voice_transcription_failed','Transcription could not finish.');
   const payload=await response.json(),usage=transcriptionUsage(payload);if(!usage)throw new FoundationError(503,'voice_usage_unverified','Transcription usage could not be verified.');const text=typeof payload.text==='string'?payload.text.trim():'';
   await settle(text&&text.length<=2000?text:null,usage.costMicrousd,usage.inputTokens,usage.outputTokens);
   if(usage.costMicrousd>20000||!text||text.length>2000)throw new FoundationError(422,'voice_result_unavailable','A usable transcript was not returned.');
   return{text,requestId:v.requestId,cached:false,costMicrousd:usage.costMicrousd};
  }catch(error){if(!settled)try{await settle(null,null,null,null);}catch{/* Conservative reservation remains held; no automatic provider retry. */}throw error instanceof FoundationError?error:new FoundationError(503,'voice_transcription_failed','Transcription could not finish. No automatic retry was made.');}
 }};
}
