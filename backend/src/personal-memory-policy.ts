import {z} from 'zod';
export const personalMemoryCategories=['personal_facts','preferences','goals','interests','birth_information','life_context','reflections'] as const;
export function messagesAfterMemoryBoundary<T extends {created_at:string}>(rows:T[],boundary?:string):T[]{if(!boundary)return rows;const cutoff=Date.parse(boundary);if(!Number.isFinite(cutoff))return [];return rows.filter(row=>Date.parse(row.created_at)>cutoff);}
/** A transcript cutoff must also invalidate text cached in conversation state. */
export function conversationStateAfterMemoryBoundary(value:unknown,boundary?:string):unknown {
 if(!boundary)return value;
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const updatedAt=(value as {updated_at?:unknown}).updated_at;
 const cutoff=Date.parse(boundary),created=typeof updatedAt==='string'?Date.parse(updatedAt):NaN;
 return Number.isFinite(cutoff)&&Number.isFinite(created)&&created>cutoff?value:null;
}
export const memoryWriteSchema=z.object({
 category:z.enum(personalMemoryCategories),key:z.string().trim().min(2).max(64).regex(/^[\p{L}\p{N} _-]+$/u),value:z.string().trim().min(2).max(500),confirmed:z.boolean(),kind:z.enum(['fact','symbolic']).default('fact'),sourceMessageId:z.string().uuid().optional(),revision:z.number().int().positive().optional(),sensitiveConsent:z.boolean().default(false)
}).strict().refine(v=>v.category!=='birth_information','Use the canonical optional birth profile, not a second copy.').refine(v=>v.kind!=='symbolic'||v.category==='reflections','Symbolic interpretations are reflections, never personal facts.');
export type MemoryWrite=z.infer<typeof memoryWriteSchema>;
export type PersonalMemory={id:string;category:string;memory_key:string;memory_value:string;confirmation_status:'pending'|'confirmed';memory_kind:'fact'|'symbolic';is_sensitive:boolean;source_type:string;source_message_id:string|null;revision:number;created_at:string;updated_at:string;confirmed_at:string|null};
export const canonicalMemoryKey=(key:string)=>key.normalize('NFKC').trim().toLowerCase().replace(/[\s-]+/gu,'_');
export const normalizedMemoryValue=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function containsCredential(value:string){return /(?:\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}|-----BEGIN [\w ]*PRIVATE KEY-----|\beyJ[\w-]{16,}\.[\w-]+\.[\w-]+|(?:password|api[ _-]?key|пароль|токен)\s*[:=]\s*\S{4,})/i.test(value);}
export function potentiallySensitive(value:string){return containsCredential(value)||/(?:diagnos|medicat|passport|password|secret|api.?key|\bssn\b|sexual|religio|politic|birth.?date|date.of.birth|\bdob\b|home.address|диагноз|лекарств|паспорт|парол|секрет|сексу|религи|политич|болезн|здоров|дата.рожд|домашн.адрес|suicid|самоубий)/i.test(value)||/\b(?:\d{12,19}|\d{4}-\d{2}-\d{2})\b/.test(value);}
const hints:Record<string,RegExp>={goals:/goal|work|career|growth|цель|работ|карьер|развити/i,preferences:/recommend|meditat|practice|prefer|подбер|медитац|практик|предпоч/i,interests:/interest|tarot|astrolog|hobby|интерес|таро|астрол|хобби/i,life_context:/work|family|relationship|change|работ|семь|отношен|перемен/i,reflections:/reflect|discover|meaning|размыш|открыт|смысл/i};
export function selectRelevantMemories(rows:PersonalMemory[],query:string,maxChars=1600){
 const tokens=normalizedMemoryValue(query).split(' ').filter(t=>t.length>3);
 const eligible=rows.filter(r=>r.confirmation_status==='confirmed'&&r.memory_kind==='fact'&&!r.is_sensitive&&r.category!=='birth_information'&&!potentiallySensitive(r.memory_key+' '+r.memory_value));
 const counts=new Map<string,number>();for(const r of eligible){const k=r.category+':'+canonicalMemoryKey(r.memory_key);counts.set(k,(counts.get(k)??0)+1);}
 const scored=eligible.map(r=>({r,score:r.category==='personal_facts'&&/name|address|имя|обращен/i.test(r.memory_key)?10:(hints[r.category]?.test(query)?2:0)+tokens.filter(t=>normalizedMemoryValue(r.memory_value+' '+r.memory_key).includes(t)).length})).filter(x=>x.score>0&&counts.get(x.r.category+':'+canonicalMemoryKey(x.r.memory_key))===1).sort((a,b)=>b.score-a.score||b.r.updated_at.localeCompare(a.r.updated_at));
 const selected:Array<{category:string;key:string;value:string;updatedAt:string}>=[];let length=0;const seen=new Set<string>();for(const {r}of scored){const value=normalizedMemoryValue(r.memory_value);if(seen.has(value))continue;const item={category:r.category,key:r.memory_key,value:r.memory_value,updatedAt:r.updated_at};const size=JSON.stringify(item).length;if(length+size>maxChars)continue;selected.push(item);length+=size;seen.add(value);if(selected.length===6)break;}return selected;
}
export function selectRelevantReflections(rows:PersonalMemory[],query:string){if(!hints.reflections.test(query))return [];return rows.filter(r=>r.confirmation_status==='confirmed'&&r.memory_kind==='symbolic'&&!r.is_sensitive&&!potentiallySensitive(r.memory_value)).slice(0,2).map(r=>({label:'symbolic_reflection' as const,value:r.memory_value.slice(0,240)}));}
