import {z} from 'zod';
import {cosmosDomainContext} from './luna42-cosmos-domain.js';
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
export function containsCredential(value:string){return /(?:\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}|-----BEGIN [\w ]*PRIVATE KEY-----|\beyJ[\w-]{16,}\.[\w-]+\.[\w-]+|(?:password|api[ _-]?key|пароль|токен)\s*(?:[:=]|\bis\b|\bwas\b|это|—)\s*\S{4,})/iu.test(value);}
export function potentiallySensitive(value:string){return containsCredential(value)||/(?:diagnos|medicat|passport|password|secret|api.?key|\bssn\b|sexual|religio|politic|birth.?date|date.of.birth|\bdob\b|home.address|диагноз|лекарств|паспорт|парол|секрет|сексу|религи|политич|болезн|здоров|дата.рожд|домашн.адрес|suicid|самоубий)/i.test(value)||/\b(?:\d{12,19}|\d{4}-\d{2}-\d{2})\b/.test(value);}
const hints:Record<string,RegExp>={goals:/goal|work|career|growth|цель|работ|карьер|развити/i,preferences:/recommend|meditat|practice|prefer|подбер|медитац|практик|предпоч/i,interests:/interest|tarot|astrolog|hobby|интерес|таро|астрол|хобби/i,life_context:/work|family|relationship|change|работ|семь|отношен|перемен/i,reflections:/reflect|discover|meaning|размыш|открыт|смысл/i};
const goalStopWords=new Set('about after again already and another are because before being build can confirmed continue could current does doing dont fact facts first for from give goal goals growth have help how invent inventing just know learn learning let lets like make means more most myself need new next not now only our personal please previous really remember saved should small some something start step steps take that the their them then there these they thing this those through today turn two use want was what when where which who why will wish with without would your you'.split(' '));
function goalContentTerms(value:string){return normalizedMemoryValue(value).split(' ').flatMap(token=>{
 if(token.length<4||goalStopWords.has(token)||/^(?:цел|подтвержд|сохран|продолж|небольш|маленьк|нов|догад|науч|помог|практик|эксперимент|развити|какой|какие|чтобы|перв|сдела|хочу|дальше|сейчас|сведен)/u.test(token))return[];
 const pair=([['drawing',/^(?:draw|рисов|рисун)/u],['prototype',/^(?:prototyp|прототип)/u],['volunteer',/^(?:volunteer|доброволь|волонт)/u],['career',/^(?:career|карьер)/u],['travel',/^(?:travel|путешеств)/u],['relationship',/^(?:relationship|отношен)/u]] as const).find(([,pattern])=>pattern.test(token));return[pair?.[0]??token];
});}
/** Explicit life-area memories do not leak into an unrelated consultation just
 * because both contain generic words such as "goal" or "change". */
export function personalMemoryOverview(query:string):'all'|'goals'|null{
 const request=query.trim().replace(/^(?:luna|луна)[,\s]+/i,'');
 if(/(?:my (?:strengths|weaknesses)|strengths and (?:weaknesses|challenges)|мои (?:сильные|слабые) стороны|(?:сильные и слабые|сильн.{0,20}сторон)|что (?:ты )?можешь сказать обо мне)/iu.test(request))return 'all';
 if(/^(?:help me (?:understand|explore) myself|(?:show|explore|discuss) my (?:portrait|cosmos|universe)|помоги (?:мне )?(?:лучше )?понять себя|(?:покажи|исследуем|обсудим) (?:мой портрет|мой космос|меня))(?:[?!.,\s]|$)/i.test(request))return 'all';
 if(/^(?:what (?:do you|does luna) (?:know|remember) about me|(?:show|summari[sz]e) my (?:saved (?:information|profile)|personal (?:profile|memories))|что (?:ты|луна) (?:обо мне|про меня) (?:знаешь|помнишь)|что (?:ты|луна) (?:знаешь|помнишь) (?:обо мне|про меня)|покажи (?:мой портрет|что (?:ты )?обо мне знаешь))(?:[?!.,\s]|$)/i.test(request))return 'all';
 if(/^(?:what are my (?:current |saved )?goals|(?:show|list) my (?:current |saved )?goals|какие у меня (?:сейчас |сохран[её]нные )?цели|покажи мои (?:текущие |сохран[её]нные )?цели)(?:[?!.,\s]|$)/i.test(request))return 'goals';
 return null;
}
export function cosmosAreaRelevant(key:string,query:string){
 if(!key.startsWith('cosmos_'))return true;
 if(personalMemoryOverview(query)==='all')return true;
 if(personalMemoryOverview(query)==='goals')return ['career','money','growth','dreams'].includes(key.slice('cosmos_'.length));
 const domains:Record<string,RegExp>={relationships:/relationship|partner|romance|love|отношен|партн[её]р|любов/i,career:/career|business|work|study|карьер|бизнес|работ|уч[её]б/i,money:/money|financ|budget|деньг|финанс|бюджет/i,growth:/personal growth|skill|confidence|развити|навык|уверен/i,wellbeing:/calm|focus|rest|meditat|breath|спокой|вниман|отдых|медитац|дыхан/i,social:/friend|social|community|друз|друж|общен|окружен/i,lifestyle:/lifestyle|routine|rhythm|habit|образ жизни|ритм|привыч/i,dreams:/future|aspiration|dreams? for|будущ|мечт/i};
 const area=key.slice('cosmos_'.length);return Boolean(domains[area]?.test(query)||area==='dreams'&&/spiritual|self-discover|духов|самопознан/i.test(query));
}
export function selectRelevantMemories(rows:PersonalMemory[],query:string,maxChars=1600){
 const tokens=normalizedMemoryValue(query).split(' ').filter(t=>t.length>3);
 const eligible=rows.filter(r=>r.confirmation_status==='confirmed'&&r.memory_kind==='fact'&&!r.is_sensitive&&r.category!=='birth_information'&&r.memory_key!=='companion_settings'&&cosmosAreaRelevant(r.memory_key,query)&&!potentiallySensitive(r.memory_key+' '+r.memory_value));
 const counts=new Map<string,number>();for(const r of eligible){const k=r.category+':'+canonicalMemoryKey(r.memory_key);counts.set(k,(counts.get(k)??0)+1);}
 const overview=personalMemoryOverview(query),specific=goalContentTerms(query),scored=eligible.map(r=>{const matches=tokens.filter(t=>normalizedMemoryValue(r.memory_value+' '+r.memory_key).includes(t)).length;
  // "a goal" alone is not permission to send an unrelated saved goal. Keep
  // explicit profile/goals overviews and existing scoped Cosmos behavior.
  if(r.category==='goals'&&!r.memory_key.startsWith('cosmos_')&&!overview){const terms=goalContentTerms(r.memory_key+' '+r.memory_value),overlap=specific.filter(t=>terms.some(v=>v===t||v.length>=5&&t.length>=5&&(v.startsWith(t)||t.startsWith(v)))).length;return{r,score:specific.length?overlap:hints.goals.test(query)?2:0};}
  return{r,score:['personal_facts','preferences'].includes(r.category)&&/name|address|pronouns|gender|communication_style|имя|обращен|местоимения|^род$/i.test(r.memory_key)?10:(r.memory_key.startsWith('cosmos_')?3:overview==='all'||overview==='goals'&&r.category==='goals'?2:hints[r.category]?.test(query)?2:0)+matches};
 }).filter(x=>x.score>0&&counts.get(x.r.category+':'+canonicalMemoryKey(x.r.memory_key))===1).sort((a,b)=>b.score-a.score||b.r.updated_at.localeCompare(a.r.updated_at));
 const selected:Array<{id:string;category:string;key:string;value:string;source:string;createdAt:string;updatedAt:string}>=[];let length=0;const seen=new Set<string>();for(const {r}of scored){const value=normalizedMemoryValue(r.memory_value);if(seen.has(value))continue;const item={id:r.id,category:r.category,key:r.memory_key,value:r.memory_key.startsWith('cosmos_')?cosmosDomainContext(r.memory_value):r.memory_value,source:r.source_type,createdAt:r.created_at,updatedAt:r.updated_at};const size=JSON.stringify(item).length;if(length+size>maxChars)continue;selected.push(item);length+=size;seen.add(value);if(selected.length===6)break;}return selected;
}
export function selectRelevantReflections(rows:PersonalMemory[],query:string){if(!hints.reflections.test(query))return [];return rows.filter(r=>r.confirmation_status==='confirmed'&&r.memory_kind==='symbolic'&&!r.is_sensitive&&!potentiallySensitive(r.memory_value)).slice(0,2).map(r=>({label:'symbolic_reflection' as const,value:r.memory_value.slice(0,240),id:r.id,source:r.source_type,updatedAt:r.updated_at}));}
