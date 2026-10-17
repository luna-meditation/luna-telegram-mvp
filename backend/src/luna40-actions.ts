import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
export type ToolOutcome={version:1;operationId:string;toolName:string;status:'completed'|'requires_selection'|'failed';resultReference:{kind:string;id:string}|null;uiState:'not_requested'|'selection_required'|'navigation_requested';data:unknown;error:{code:string;retryable:boolean}|null;latencyMs:number};
function canonicalArguments(args:string){
 if(args.length>2000)return args;
 const order=(value:unknown):unknown=>Array.isArray(value)?value.map(order):value!==null&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>[key,order(item)])):value;
 try{return JSON.stringify(order(JSON.parse(args)));}catch{return args;}
}
export function toolOperationId(owner:number,request:string,name:string,args:string){const hash=createHash('sha256').update(JSON.stringify(['luna40-tool',owner,request,name,canonicalArguments(args)])).digest('hex');return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`;}
/** A successful read is not a successful navigation, playback or payment. */
export function toolOutcome(input:{owner:number;request:string;name:string;args:string;data:unknown;latencyMs:number;readingId?:string;chartId?:string}):ToolOutcome{
 const value=input.data as {error?:string;requiresSelection?:boolean;requiresTwoSelectedCharts?:boolean;action?:string;meditationId?:unknown}|null;
 const code=typeof value?.error==='string'&&/^[a-z_]{3,80}$/.test(value.error)?value.error:null;
 const selection=Boolean(value?.requiresSelection||value?.requiresTwoSelectedCharts||value?.action==='natal_chart'&&input.name==='get_birth_profiles');
 const navigation=value?.action==='breathing'||value?.action==='natal_chart'&&!selection||value?.action==='compatibility'&&!selection;
 const meditation=input.name==='recommend_meditation'&&value?.action==='meditation_card'?z.string().uuid().safeParse(value.meditationId):null;
 return {version:1,operationId:toolOperationId(input.owner,input.request,input.name,input.args),toolName:input.name,status:code?'failed':selection?'requires_selection':'completed',resultReference:code?null:meditation?.success?{kind:'meditation',id:meditation.data}:input.name==='get_tarot_reading'&&input.readingId?{kind:'tarot_reading',id:input.readingId}:['get_natal_chart','calculate_compatibility'].includes(input.name)&&input.chartId&&!selection?{kind:'natal_chart',id:input.chartId}:null,uiState:code?'not_requested':selection?'selection_required':navigation?'navigation_requested':'not_requested',data:input.data,error:code?{code,retryable:!['context_not_selected','invalid_tool_arguments','reading_not_found','meditation_unavailable','meditation_already_selected'].includes(code)}:null,latencyMs:Math.max(0,Math.min(600000,Math.round(input.latencyMs)))};
}
export const uiAckInput=z.object({messageId:z.string().uuid(),event:z.enum(['meditation_card_rendered','player_opened','playback_started']),referenceId:z.string().uuid()}).strict();
export async function acknowledgeUi(db:SupabaseClient,owner:number,body:unknown){const input=uiAckInput.parse(body);const result=await db.rpc('luna40_acknowledge_ui',{p_owner:owner,p_message:input.messageId,p_event:input.event,p_reference:input.referenceId});if(result.error)throw new FoundationError(503,'action_ack_unavailable','The action status could not be synchronized.');if(result.data!==true)throw new FoundationError(404,'action_not_found','This action is not attached to your conversation.');return{acknowledged:true,source:'client_observed',rewardGranted:false};}
export async function recordToolOutcomes(db:SupabaseClient,owner:number,messageId:string,outcomes:ToolOutcome[]){if(!outcomes.length)return;const rows=outcomes.slice(0,4).map(o=>({telegram_id:owner,message_id:messageId,operation_id:o.operationId,tool_name:o.toolName,status:o.status,ui_state:o.uiState,latency_ms:o.latencyMs,error_code:o.error?.code??null}));try{const result=await db.from('luna40_tool_executions').upsert(rows,{onConflict:'telegram_id,operation_id',ignoreDuplicates:true});if(result.error)console.warn('[Luna action telemetry unavailable]',{code:'tool_telemetry_unavailable'});}catch{console.warn('[Luna action telemetry unavailable]',{code:'tool_telemetry_unavailable'});}}
