import {createHash} from 'node:crypto';
import {z} from 'zod';
import {tarotCatalog,legacyInterpretationSchema} from './tarot-policy.js';
import {tarotInterpretationV2,tarotOutputSchemaV2,conciseTarotInstructions} from './tarot-interpretation-v2.js';
import {buildModeInstructions} from './luna/modes.js';
import {russianAddressInstructions} from './luna/russian-address.js';
import {permittedPersonalContext,type PersonalProfile} from './personalization-policy.js';
const card=z.object({cardId:z.string().refine(id=>tarotCatalog.some(c=>c.id===id)),orientation:z.enum(['upright','reversed'])}).strict();
export const spreadInputSchema=z.object({clientReadingId:z.string().uuid(),kind:z.enum(['three','five']),cards:z.array(card).min(3).max(5),intention:z.enum(['general','love','career','growth']),question:z.string().trim().max(240),language:z.enum(['en','ru']),generate:z.boolean().default(false)}).strict().superRefine((input,ctx)=>{
 if(input.cards.length!==(input.kind==='three'?3:5)||new Set(input.cards.map(c=>c.cardId)).size!==input.cards.length)ctx.addIssue({code:'custom',message:'A spread must contain exactly 3 or 5 distinct cards.'});
});
export type SpreadInput=z.infer<typeof spreadInputSchema>;
export const spreadInterpretationSchema=z.union([tarotInterpretationV2,legacyInterpretationSchema.extend({cardInsights:z.array(z.object({cardId:z.string(),text:z.string().min(1).max(1800)}).strict()).min(3).max(5),links:z.string().min(1).max(2000)})]);
export function spreadRequestHash(input:SpreadInput){const immutable={clientReadingId:input.clientReadingId,kind:input.kind,cards:input.cards,intention:input.intention,question:input.question,language:input.language};return createHash('sha256').update(JSON.stringify(immutable)).digest('hex');}
export const spreadPositions={en:{three:['The situation','What needs attention','A possible direction'],five:['The heart of the question','Hidden influences','Obstacles','Opportunities','A conscious next step']},ru:{three:['Суть ситуации','Что требует внимания','Возможное направление'],five:['Суть вопроса','Скрытые факторы','Препятствия','Возможности','Осознанный следующий шаг']}};
export function buildSpreadAiRequest(input:SpreadInput,profile:PersonalProfile|null,model:string){
 const cards=input.cards.map((selection,index)=>{const c=tarotCatalog.find(c=>c.id===selection.cardId)!;return {...selection,position:spreadPositions[input.language][input.kind][index],name:c.name[input.language],meaning:c.meaning[input.language][selection.orientation]};});
 return {model,store:false,reasoning:{effort:'minimal'},max_output_tokens:input.kind==='three'?2400:3600,
  instructions:buildModeInstructions('tarot',input.language,null)+'\n'+conciseTarotInstructions+'\n'+russianAddressInstructions(input.language,permittedPersonalContext(profile),input.question),
  input:[{role:'user',content:[{type:'input_text',text:JSON.stringify({kind:input.kind,cards,intention:input.intention,question:input.question,personalContext:permittedPersonalContext(profile)})}]}],
  text:{format:{type:'json_schema',name:'luna_tarot_spread_v2',strict:true,schema:tarotOutputSchemaV2}}};
}
