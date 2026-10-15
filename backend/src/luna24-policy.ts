import {createHash,randomInt} from 'node:crypto';
import {z} from 'zod';
import {tarotCatalog} from './tarot-policy.js';
export const chatTarotInput=z.object({clientReadingId:z.string().uuid(),conversationId:z.string().uuid().optional(),kind:z.enum(['single','three','five']),intention:z.enum(['general','love','career','growth']),question:z.string().trim().max(240),language:z.enum(['en','ru'])}).strict();
export type ChatTarotInput=z.infer<typeof chatTarotInput>;
export type ChatTarotState={readingId:string;clientReadingId:string;kind:ChatTarotInput['kind'];revealed:number;requestHash:string};
export const chatTarotState=z.object({readingId:z.string().uuid(),clientReadingId:z.string().uuid(),kind:z.enum(['single','three','five']),revealed:z.number().int().min(0).max(5),requestHash:z.string().length(64)}).strict();
export const readingSize=(kind:ChatTarotInput['kind'])=>kind==='single'?1:kind==='three'?3:5;
export function chatTarotHash(input:ChatTarotInput){return createHash('sha256').update(JSON.stringify({kind:input.kind,intention:input.intention,question:input.question,language:input.language})).digest('hex');}
export function drawChatTarot(kind:ChatTarotInput['kind'],random:(max:number)=>number=randomInt){
 const pool=tarotCatalog.map(c=>c.id),cards=[];
 for(let i=0;i<readingSize(kind);i++){const index=random(pool.length);if(!Number.isInteger(index)||index<0||index>=pool.length)throw new Error('Invalid secure draw');cards.push({cardId:pool.splice(index,1)[0],orientation:random(2)===0?'upright' as const:'reversed' as const});}
 return cards;
}
export function nextReveal(state:ChatTarotState,index:number){const size=readingSize(state.kind);if(!Number.isInteger(index)||index<0||index>=size||index>state.revealed)throw new Error('reveal_order');return {...state,revealed:Math.min(size,Math.max(state.revealed,index+1))};}
export function contextualActionIds(message:string,safety:string|null):Array<'tarot'|'birth_profile'|'journal'|'meditation'>{
 if(safety)return [];
 const ids:Array<'tarot'|'birth_profile'|'journal'|'meditation'>=[];
 if(/таро|расклад|отношен|tarot|relationship|partner|cards\b/i.test(message))ids.push('tarot');
 if(/астро|рождени|натальн|astrolog|birth|natal|zodiac/i.test(message))ids.push('birth_profile');
 if(/дневник|чувств|заметк|записа|journal|feeling|reflect|note\b/i.test(message))ids.push('journal');
 if(/медитац|практик|meditat|practice/i.test(message))ids.push('meditation');
 return ids.slice(0,3);
}
