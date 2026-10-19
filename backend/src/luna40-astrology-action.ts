import type {SupabaseClient} from '@supabase/supabase-js';
import {createAstrologyService} from './luna30-astrology-service.js';
/** Preserve an explicitly named relationship, never infer it from a memory.
 * Ambiguous or negated labels remain a selection in the existing UI. */
export function explicitRelationshipContext(message:string){
 const text=message.replace(/\b(?:not|no|without)\s+(?:a\s+)?(?:romantic|romance|business|friendship|family)\b|(?:не|без)\s+(?:романт\p{L}*|делов\p{L}*|друж\p{L}*|семейн\p{L}*)/giu,' ');
 const values=([['business',/\bbusiness\b|делов\p{L}*/iu],['friendship',/\bfriendship\b|дружб\p{L}*/iu],['family',/\bfamily\b|семейн\p{L}*/iu],['romantic',/\b(?:romantic|romance)\b|романт\p{L}*/iu]] as const).filter(([,pattern])=>pattern.test(text)).map(([kind])=>kind);
 return values.length===1?values[0]:undefined;
}
/** A real calculation/UI preparation, not permission to send birth facts to AI.
 * Reuses the existing owner-scoped cache and never returns raw birth details. */
export async function prepareAstrologyAction(db:SupabaseClient,owner:number,kind:'natal'|'compatibility',enabled:()=>boolean,requestFocus?:string){
 const focus=requestFocus?.trim().slice(0,2000),relationship=kind==='compatibility'?explicitRelationshipContext(focus??''):undefined,context={...(focus?{requestFocus:focus}:{}),...(relationship?{relationship}:{})};
 const service=createAstrologyService(db,enabled),{profiles}=await service.list(owner),personal=profiles.filter(p=>p.subject_kind==='self');
 if(kind==='natal'&&personal.length===1){const {chart}=await service.calculate(owner,personal[0].id);return{workflow:{version:1 as const,kind,state:'ready' as const,firstProfileId:personal[0].id as string,firstChartId:chart.id as string,...context},attachment:{chartId:chart.id as string},providerResult:{action:'natal_chart',state:'calculated',requiresSelection:false,requiresSeparateAiConsent:true,note:'The real chart card is attached in the app. No chart positions or birth data are sent in this tool output. Do not claim playback, a reading or an interpretation was generated.'}};}
 return{workflow:{version:1 as const,kind,state:'selecting' as const,...context},attachment:null,providerResult:{action:kind==='natal'?'natal_chart':'compatibility',state:'selecting',requiresSelection:true,profileCount:profiles.length,requiresSeparateAiConsent:true,note:profiles.length?'The actual profile selector is attached. Ask only for the missing selection, not repeated permission.':'No saved birth profiles. The actual add-profile control is attached. Birth details are optional and should be entered in the secure form, not ordinary chat.'}};
}

/** A prepared selector is a real card, not a promise to open something later.
 * Do not show speculative model buttons or ask for already selected labels. */
export function astrologyActionCopy(action:Awaited<ReturnType<typeof prepareAstrologyAction>>,language:'en'|'ru'){
 if(action.workflow.state==='ready')return language==='ru'?'Рассчитанная карта — ниже. Её можно открыть; для обсуждения с AI нужно отдельное согласие.':'Your calculated chart is below. Open it here; discussing its details with AI needs separate consent.';
 if(!action.providerResult.profileCount)return language==='ru'?'Добавь данные рождения в защищённой форме ниже. Точное время необязательно.':'Add birth details in the secure form below. Exact birth time is optional.';
 if(action.workflow.kind==='compatibility')return action.workflow.relationship?(language==='ru'?'Выбери два профиля на карточке ниже. Указанный контекст отношений сохранён; расчёт не списывает Moon Seeds.':'Choose two profiles on the card below. Your requested relationship context is preserved; the calculation does not spend Moon Seeds.'):(language==='ru'?'Выбери контекст отношений и два профиля на карточке ниже. Расчёт не списывает Moon Seeds.':'Choose the relationship context and two profiles on the card below. The calculation does not spend Moon Seeds.');
 return language==='ru'?'Выбери сохранённый профиль на карточке ниже. Повторное подтверждение не нужно.':'Choose a saved profile on the card below. No repeated confirmation is needed.';
}
