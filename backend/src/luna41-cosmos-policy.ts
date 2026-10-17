import {z} from 'zod';
export const cosmosAreas=[
 {id:'relationships',category:'life_context',en:'Relationships',ru:'Отношения',question:{en:'What would you like to understand or improve in your relationships?',ru:'Что хочется лучше понять или изменить в отношениях?'}},
 {id:'career',category:'goals',en:'Career & business',ru:'Карьера и дело',question:{en:'What matters most in your work, studies or next direction right now?',ru:'Что сейчас важнее всего в работе, учёбе или поиске нового направления?'}},
 {id:'money',category:'goals',en:'Money & goals',ru:'Деньги и цели',question:{en:'Is there a financial goal you want to work toward? No amounts or private account details are needed.',ru:'Есть ли финансовая цель, к которой хочется двигаться? Суммы и данные счетов не нужны.'}},
 {id:'growth',category:'goals',en:'Personal growth',ru:'Личное развитие',question:{en:'Which quality or skill would you like to develop?',ru:'Какое качество или навык хочется развить?'}},
 {id:'wellbeing',category:'preferences',en:'Wellbeing',ru:'Самочувствие',question:{en:'What kind of everyday support feels useful — calm, focus, rest or something else?',ru:'Какая повседневная поддержка полезна — спокойствие, внимание, отдых или что-то другое?'}},
 {id:'social',category:'life_context',en:'Friends & community',ru:'Друзья и окружение',question:{en:'What would you like more of in your social life?',ru:'Чего хотелось бы больше в общении и окружении?'}},
 {id:'lifestyle',category:'preferences',en:'Lifestyle',ru:'Образ жизни',question:{en:'What helps you feel at home in your everyday rhythm?',ru:'Что помогает чувствовать себя комфортно в повседневном ритме?'}},
 {id:'dreams',category:'goals',en:'Dreams & future',ru:'Мечты и будущее',question:{en:'Is there a dream or direction you would like to keep in view?',ru:'Есть ли мечта или направление, о котором хочется помнить?'}}
] as const;
export const cosmosQuestionIds=['name','interests',...cosmosAreas.map(a=>a.id)] as const;
export const cosmosStateInput=z.object({skipped:z.array(z.string().refine(v=>cosmosQuestionIds.includes(v as never))).max(10).transform(v=>[...new Set(v)]),expectedRevision:z.number().int().min(0),requestId:z.string().uuid()}).strict();
export type CosmosState={skipped:string[];revision:number;updatedAt:string|null};
export const emptyCosmosState=():CosmosState=>({skipped:[],revision:0,updatedAt:null});
export function cosmosMemoryKey(id:string){if(!cosmosAreas.some(a=>a.id===id))throw new Error('invalid_cosmos_area');return 'cosmos_'+id;}
/** Completion comes from the actual confirmed fact, not from an onboarding flag. */
export function cosmosCompletion(memories:Array<{memory_key:string;confirmation_status:string;memory_kind?:string}>) {
 return cosmosAreas.filter(area=>memories.some(m=>m.memory_key===cosmosMemoryKey(area.id)&&m.confirmation_status==='confirmed'&&m.memory_kind!=='symbolic')).map(a=>a.id);
}
