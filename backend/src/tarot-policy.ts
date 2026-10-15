import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {z} from 'zod';
import {buildModeInstructions} from './luna/modes.js';
import {russianAddressInstructions} from './luna/russian-address.js';
import {permittedPersonalContext,type PersonalProfile} from './personalization-policy.js';
import {tarotInterpretationV2,tarotOutputSchemaV2,conciseTarotInstructions} from './tarot-interpretation-v2.js';
const packed=new URL('./tarot-catalog.json',import.meta.url);
// A bundled Netlify function retains declared included_files relative to its root.
const bundledCatalog=resolve(process.cwd(),'backend/dist/tarot-catalog.json');
type Meaning=Record<'en'|'ru',Record<'upright'|'reversed',string>>;
const manifest=JSON.parse(readFileSync(existsSync(packed)?packed:existsSync(bundledCatalog)?bundledCatalog:new URL('../../frontend/src/features/tarot/manifest.json',import.meta.url),'utf8')) as {cards:Array<{id:string;name:{en:string;ru:string};arcana:string;suit:string|null;number:number;meaning?:Meaning}>};
if(manifest.cards.length!==78||new Set(manifest.cards.map(c=>c.id)).size!==78)throw new Error('Invalid Tarot catalog');
// Production uses the packaged catalog. Development reads the same canonical
// JSON as the frontend; no second set of interpretations or runtime TS compiler.
let content:{majorContent:string[][];minorContent:Record<string,string[][]>}|undefined;
export const tarotCatalog=manifest.cards.map(card=>{
 if(card.meaning)return {...card,meaning:card.meaning};
 content??=JSON.parse(readFileSync(new URL('../../frontend/src/features/tarot/content.json',import.meta.url),'utf8')) as NonNullable<typeof content>;
 const major=card.arcana==='major'?content.majorContent[card.number]:null;
 const minor=card.suit?content.minorContent[card.suit]?.[card.number-1]:null;
 if(!major&&!minor)throw new Error('Missing canonical Tarot meaning');
 return {...card,meaning:{en:{upright:major?.[2]??minor![0],reversed:major?.[4]??minor![2]},ru:{upright:major?.[3]??minor![1],reversed:major?.[5]??minor![3]}}};
});
export const tarotInputSchema=z.object({clientReadingId:z.string().uuid(),cardId:z.string().refine(id=>tarotCatalog.some(c=>c.id===id)),orientation:z.enum(['upright','reversed']),intention:z.enum(['general','love','career','growth']),question:z.string().trim().max(240),language:z.enum(['en','ru']),generate:z.boolean().default(false)}).strict();
export type TarotInput=z.infer<typeof tarotInputSchema>;
const paragraph=z.string().trim().min(1).max(1200);
export const legacyInterpretationSchema=z.object({summary:paragraph,cardMeaning:paragraph,context:paragraph,reflection:paragraph,question:paragraph,continuation:z.string().trim().max(300).nullable()}).strict();
export const interpretationSchema=z.union([tarotInterpretationV2,legacyInterpretationSchema]);
export type TarotInterpretation=z.infer<typeof interpretationSchema>;
export function tarotRequestHash(input:TarotInput){const immutable={clientReadingId:input.clientReadingId,cardId:input.cardId,orientation:input.orientation,intention:input.intention,question:input.question,language:input.language};return createHash('sha256').update(JSON.stringify(immutable)).digest('hex');}
export function buildTarotAiRequest(input:TarotInput,profile:PersonalProfile|null,model:string,maxTokens:number){
 const card=tarotCatalog.find(c=>c.id===input.cardId)!;
 const data={card:{id:card.id,name:card.name[input.language],meaning:card.meaning[input.language][input.orientation],arcana:card.arcana,suit:card.suit,number:card.number},cards:[{cardId:card.id,orientation:input.orientation,position:input.language==='ru'?'Основной взгляд':'Main perspective'}],orientation:input.orientation,intention:input.intention,question:input.question,personalContext:permittedPersonalContext(profile)};
 return {model,store:false,reasoning:{effort:'minimal'},max_output_tokens:maxTokens,
  instructions:buildModeInstructions('tarot',input.language,null)+'\n'+conciseTarotInstructions+'\n'+russianAddressInstructions(input.language,data.personalContext,input.question),
  input:[{role:'user',content:[{type:'input_text',text:JSON.stringify(data)}]}],
  text:{format:{type:'json_schema',name:'luna_tarot_reflection_v2',strict:true,schema:tarotOutputSchemaV2}}};
}
