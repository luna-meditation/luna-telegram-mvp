import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {intelligenceUuid,type IntelligenceReference} from './luna-intelligence-contract.js';
import type {AstrologyAttachment} from './luna31-consultation.js';
import {containsCredential,potentiallySensitive} from './personal-memory-policy.js';
import {z} from 'zod';

/** References never contain birth details. The downstream owner-scoped reader
 * verifies the record and report pair before any calculated data is returned. */
export function intelligenceReference(input:{readingId?:string;astrology?:AstrologyAttachment}):IntelligenceReference|null{
 if(input.astrology){const a=input.astrology;if(!intelligenceUuid(a.chartId))return null;return a.secondChartId&&intelligenceUuid(a.secondChartId)?{type:'compatibility_report',id:a.reportId??a.comparisonId??a.chartId,chartId:a.chartId,secondChartId:a.secondChartId,...(a.reportId?{reportId:a.reportId}:{}),...(a.comparisonId?{comparisonId:a.comparisonId}:{}),...(a.relationship?{relationship:a.relationship}:{})}:{type:'natal_chart',id:a.chartId,...(a.reportId?{reportId:a.reportId}:{})};}
 return intelligenceUuid(input.readingId)?{type:'tarot_reading',id:input.readingId}:null;
}
export function relevantArtifactFollowUp(message:string,reference:IntelligenceReference|null){
 if(!reference||message.length>220)return false;
 if(/meditat|breath|moon seeds|buy|change.*language|медитац|подыш|дыхан|купить|язык|новый расклад|new spread/iu.test(message))return false;
 if(reference.type==='compatibility_report')return /(?:почему|как|что).{0,45}(?:мы|нам|нас|наши|общени|ссор|конфликт|сближ|отношен)|(?:why|how|what).{0,45}(?:we|us|our|communicat|conflict|connect|relationship)/iu.test(message);
 return false;
}
export type RetrievedContext={sources:Array<{type:'saved_reflection'|'conversation';id:string;updatedAt:string;text:string}>;requiresConsent:boolean;truncated:boolean};
/** Explicit targeted retrieval only. No bulk history, raw birth data, sensitive
 * dreams, unchecked model memories, deleted entries or another owner's rows. */
export async function retrieveIntelligenceContext(db:SupabaseClient,owner:number,kind:'journal'|'history',query:string,options:{consented:boolean;currentConversationId?:string;privacyBoundary?:string|null}):Promise<RetrievedContext>{
 if(!Number.isSafeInteger(owner)||owner<=0)throw new FoundationError(403,'owner_required','Open Luna inside Telegram.');
 const clean=query.trim();if(!clean||clean.length>200)throw new FoundationError(422,'invalid_query','Choose one short topic.');
 if(!options.consented)return{sources:[],requiresConsent:true,truncated:false};
 const tokens=clean.toLocaleLowerCase().match(/[\p{L}\p{N}]{4,}/gu)?.filter(t=>!['about','previous','conversation','remember','помнишь','разговор','прошлый','дневник','journal','history'].includes(t))??[];
 if(!tokens.length)return{sources:[],requiresConsent:false,truncated:true};
 const table=kind==='journal'?'user_memories':'ai_conversations';
 let request=db.from(table).select(kind==='journal'?'id,memory_value,confirmation_status,memory_kind,is_sensitive,updated_at':'id,title,status,updated_at').eq('telegram_id',owner);
 request=kind==='journal'?request.eq('is_active',true).eq('confirmation_status','confirmed').eq('category','reflections').eq('is_sensitive',false):request.eq('status','active');
 const rows=await request.order('updated_at',{ascending:false}).limit(40);if(rows.error)throw new FoundationError(503,'context_unavailable','Could not retrieve the selected context.');
 const parsed=z.array(z.object({id:z.string().uuid(),updated_at:z.string(),memory_value:z.string().optional(),title:z.string().nullable().optional()}).passthrough()).safeParse(rows.data??[]);
 if(!parsed.success)throw new FoundationError(503,'context_unavailable','The selected source could not be verified.');
 const candidates=parsed.data.filter(row=>row.id!==options.currentConversationId).map(row=>({id:row.id,updatedAt:row.updated_at,text:kind==='journal'?row.memory_value??'':row.title??''})).filter(row=>!containsCredential(row.text)&&!potentiallySensitive(row.text)&&tokens.some(token=>row.text.toLocaleLowerCase().includes(token))).slice(0,3);
 const sources:RetrievedContext['sources']=[];
 for(const row of candidates){
  // A privacy edit invalidates summaries/snippets from before that boundary.
  if(options.privacyBoundary&&row.updatedAt<options.privacyBoundary)continue;
  if(kind==='journal'){sources.push({type:'saved_reflection',...row,text:row.text.slice(0,450)});continue;}
  // Read only short owner-authored messages from a matched conversation. Never
  // feed an old assistant inference back as a confirmed fact or a fresh task.
  const messages=await db.from('ai_messages').select('content,created_at').eq('telegram_id',owner).eq('conversation_id',row.id).eq('role','user').order('created_at',{ascending:false}).limit(6);
  if(messages.error)throw new FoundationError(503,'context_unavailable','Could not retrieve this conversation.');
  const snippets=(messages.data??[]).filter(m=>!options.privacyBoundary||m.created_at>=options.privacyBoundary).map(m=>String(m.content??'')).filter(text=>!containsCredential(text)&&!potentiallySensitive(text)&&tokens.some(token=>text.toLocaleLowerCase().includes(token))).slice(0,2);
  if(snippets.length)sources.push({type:'conversation',...row,text:snippets.map(t=>t.slice(0,300)).join('\n')});
 }
 return{sources,requiresConsent:false,truncated:(rows.data?.length??0)>=40};
}
export function contextRetrievalMetrics(value:unknown,latencyMs:number){const text=JSON.stringify(value);return{characters:text.length,estimatedTokens:Math.ceil(text.length/3),latencyMs:Math.max(0,Math.round(latencyMs)),sources:value&&typeof value==='object'&&'sources' in value&&Array.isArray(value.sources)?value.sources.length:0};}
export const symbolicSystemCapabilities=[{id:'western_astrology',status:'calculated'},{id:'tarot',status:'symbolic'},{id:'numerology',status:'unavailable'},{id:'human_design',status:'unavailable'},{id:'jyotish',status:'unavailable'},{id:'bazi',status:'unavailable'}] as const;
