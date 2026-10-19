import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {calculateDateNumerology} from './luna-intelligence-numerology.js';

export type PersonalBirthSource={id:string;source:'birth_profile'|'personal_profile';date:string;time:string|null;place:string|null;updatedAt:string;revision?:number};
export type PersonalBirthResolution={selected:PersonalBirthSource|null;selectionRequired:boolean;available:boolean};
/** One resolver for the portrait, numerology and conversational context. The
 * canonical self profile wins; an older date-only profile is not a second
 * competing record. No birth input is inferred from a conversation. */
export async function resolvePersonalBirth(db:SupabaseClient,owner:number,chartId?:string):Promise<PersonalBirthResolution>{
 if(!Number.isSafeInteger(owner)||owner<=0)throw new FoundationError(403,'owner_required','Open Luna inside Telegram.');
 let selectedId:string|undefined;
 if(chartId){const chart=await db.from('luna30_chart_cache').select('profile_id').eq('telegram_id',owner).eq('id',chartId).maybeSingle();if(chart.error)throw new FoundationError(503,'context_unavailable','Could not verify the selected chart.');if(!chart.data)throw new FoundationError(404,'chart_not_found','Reopen your saved chart.');selectedId=chart.data.profile_id;}
 let query=db.from('luna30_birth_profiles').select('id,birth_date,birth_time,location,revision,updated_at').eq('telegram_id',owner).eq('subject_kind','self');
 if(selectedId)query=query.eq('id',selectedId);
 const result=await query.order('updated_at',{ascending:false}).limit(2);
 if(result.error)throw new FoundationError(503,'context_unavailable','Could not load your saved birth profile.');
 if(result.data?.length===1){const p=result.data[0];return{available:true,selectionRequired:false,selected:{id:p.id,source:'birth_profile',date:p.birth_date,time:p.birth_time?.slice(0,5)??null,place:typeof p.location?.label==='string'?p.location.label:null,updatedAt:p.updated_at,revision:p.revision}};}
 if(result.data?.length||selectedId)return{available:Boolean(result.data?.length),selectionRequired:Boolean(result.data?.length),selected:null};
 const legacy=await db.from('luna_personal_profiles').select('birth_date,birth_time,birth_place,updated_at').eq('telegram_id',owner).maybeSingle();
 if(legacy.error)throw new FoundationError(503,'context_unavailable','Could not verify your saved birth details.');
 const p=legacy.data;
 return{available:Boolean(p?.birth_date),selectionRequired:false,selected:p?.birth_date?{id:'personal-profile',source:'personal_profile',date:p.birth_date,time:p.birth_time?.slice(0,5)??null,place:p.birth_place,updatedAt:p.updated_at}:null};
}
export function birthContextAvailability(birth:PersonalBirthResolution){return{available:birth.available,selectionRequired:birth.selectionRequired,...(birth.selected?{source:birth.selected.source,sourceId:birth.selected.id,hasDate:true,hasTime:Boolean(birth.selected.time),hasPlace:Boolean(birth.selected.place),updatedAt:birth.selected.updatedAt}:{})};}
export function numerologyFromBirth(birth:PersonalBirthResolution,asOf:string){
 if(!birth.selected)return{calculated:false as const,requiresPersonalProfile:!birth.available,requiresSelection:birth.selectionRequired};
 return{calculated:true as const,source:{type:birth.selected.source==='birth_profile'?'confirmed_self_birth_profile':'confirmed_date_only_profile',id:birth.selected.id},...calculateDateNumerology(birth.selected.date,asOf)};
}
