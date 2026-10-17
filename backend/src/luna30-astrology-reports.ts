import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {astrologyReportKey,buildAstrologyReportRequest,validateAstrologyReport,type AstrologyReportKind} from './luna30-astrology-report-policy.js';
import type {NatalCalculation} from './luna30-astrology-engine.js';
import type {PersonalProfile} from './personalization-policy.js';
import {requestLunaResponse,responseOutputText} from './luna/ai-provider.js';
import {stagingAiMeterRecord} from './staging-ai-meter.js';
import {withAiOperation} from './luna32-ai-accounting.js';
const fields='id,first_chart_id,second_chart_id,report_kind,language,report,created_at';
const unavailable=()=>new FoundationError(503,'astrology_ai_unavailable','The report is unavailable. Your chart and Moon Seeds are unchanged.');
export function createAstrologyReportService(db:SupabaseClient,options:{enabled:()=>boolean;personalProfile:(owner:number)=>Promise<PersonalProfile|null>;dailyLimit:(owner:number)=>Promise<number>;transport?:typeof requestLunaResponse}){
 async function chart(owner:number,id:string){const result=await db.from('luna30_chart_cache').select('id,profile_id,calculation').eq('telegram_id',owner).eq('id',id).maybeSingle();if(result.error)throw unavailable();if(!result.data)throw new FoundationError(404,'chart_not_found','Chart not found.');return result.data;}
 async function available(){if(!options.enabled())throw new FoundationError(404,'feature_disabled','AI reports are not available yet.');const {data,error}=await db.from('luna30_release_settings').select('astrology_enabled,astrology_ai_enabled').eq('id',true).single();if(error)throw unavailable();if(!data.astrology_enabled||!data.astrology_ai_enabled)throw new FoundationError(404,'feature_disabled','AI reports are not available yet.');}
 async function cached(owner:number,key:string){const value=await db.from('luna30_astrology_reports').select(fields).eq('telegram_id',owner).eq('cache_key',key).maybeSingle();if(value.error)throw unavailable();return value.data;}
 return {
  async open(owner:number,firstId:string,secondId:string|null,language:'en'|'ru',relationship?:import('./luna40-compatibility.js').RelationshipKind){
   await available();await chart(owner,firstId);if(secondId)await chart(owner,secondId);
   return {report:await cached(owner,astrologyReportKey(owner,firstId,secondId,secondId?'compatibility':'portrait',language,relationship)),cached:true};
  },
  async generate(owner:number,input:{firstChartId:string;secondChartId?:string;language:'en'|'ru';consent:true;relationship?:import('./luna40-compatibility.js').RelationshipKind}){
   return withAiOperation(db,owner,'report:'+astrologyReportKey(owner,input.firstChartId,input.secondChartId??null,input.secondChartId?'compatibility':'portrait',input.language,input.relationship),async()=>{
   await available();const kind:AstrologyReportKind=input.secondChartId?'compatibility':'portrait';
   const first=await chart(owner,input.firstChartId),second=input.secondChartId?await chart(owner,input.secondChartId):null;
   if(second?.profile_id===first.profile_id)throw new FoundationError(400,'different_charts_required','Select two different profiles.');
   const key=astrologyReportKey(owner,first.id,second?.id??null,kind,input.language,input.relationship),previous=await cached(owner,key);if(previous)return {report:previous,cached:true};
   const {data:claim,error}=await db.rpc('luna30_claim_astrology_report',{p_owner:owner,p_first:first.id,p_second:second?.id??null,p_kind:kind,p_language:input.language,p_key:key,p_daily_chat_limit:await options.dailyLimit(owner)});
   if(error||!claim)throw unavailable();
   if(!claim.acquired){const result=await cached(owner,key);if(result)return {report:result,cached:true};throw new FoundationError(claim.status==='limit'?429:409,claim.status==='limit'?'daily_limit':'report_in_progress',claim.status==='failed'?'This attempt needs review before retrying. No extra generation was started.':'A report is already being prepared, or the daily limit was reached.');}
   // Never automatically retry an ambiguous provider outcome. The durable claim
   // remains failed/pending until reviewed; opening the page cannot spend tokens.
   try{
    const subject=await db.from('luna30_birth_profiles').select('subject_kind').eq('telegram_id',owner).eq('id',first.profile_id).single();if(subject.error)throw unavailable();
    const personal=subject.data.subject_kind==='self'&&kind==='portrait';
    const before=personal?await db.from('luna_personal_profiles').select('updated_at,ai_context_consent').eq('telegram_id',owner).maybeSingle():null;
    if(before?.error)throw unavailable();
    const profile=personal?await options.personalProfile(owner):null;
    const body=buildAstrologyReportRequest({kind,relationship:input.relationship,language:input.language,first:first.calculation as NatalCalculation,...(second?{second:second.calculation as NatalCalculation}:{}),profile});
    const response=await(options.transport??requestLunaResponse)(body,AbortSignal.timeout(45000));if(!response.ok)throw unavailable();
    const payload=await response.json(),meter=stagingAiMeterRecord(payload);
    if(!meter||meter.estimated_cost===null)throw unavailable();
    const usage=await db.from('ai_usage').upsert({...meter,telegram_id:owner,request_id:`astro:${key}`},{onConflict:'telegram_id,request_id'});if(usage.error)throw unavailable();
    const text=responseOutputText(payload);if(!text)throw unavailable();const report=validateAstrologyReport(JSON.parse(text),kind);
    if(personal){const after=await db.from('luna_personal_profiles').select('updated_at,ai_context_consent').eq('telegram_id',owner).maybeSingle();if(after.error||JSON.stringify(after.data)!==JSON.stringify(before?.data))throw unavailable();}
    const settled=await db.rpc('luna30_finish_astrology_report',{p_owner:owner,p_key:key,p_report:report,p_model:meter.model,p_input:meter.input_tokens,p_output:meter.output_tokens});
    if(settled.error||!settled.data)throw unavailable();return {report:settled.data,cached:false};
   }catch{
    await db.from('luna30_astrology_jobs').update({state:'failed',updated_at:new Date().toISOString()}).eq('telegram_id',owner).eq('cache_key',key).eq('state','processing');
    await db.from('ai_chat_requests').update({status:'failed_non_retryable',quota_charged:false,updated_at:new Date().toISOString()}).eq('telegram_id',owner).eq('client_request_id',`astro_${key}`).eq('status','processing');
    throw unavailable();
   }
   });
  }
 };
}
