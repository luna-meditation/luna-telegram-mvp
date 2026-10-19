import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {discoveryDate} from './birth-discovery-policy.js';
import {calculateDateOnlySun} from './luna30-astrology-engine.js';
import {calculateDateNumerology} from './luna-intelligence-numerology.js';
import {resolvePersonalBirth} from './personal-context-engine.js';
import {FoundationError} from './foundation-error.js';
export function createBirthDiscovery(db:SupabaseClient){return{
 async preview(owner:number,raw:unknown){const {date}=z.object({date:discoveryDate}).strict().parse(raw);const birth=await resolvePersonalBirth(db,owner);const row=await db.from('luna_personal_profiles').select('updated_at').eq('telegram_id',owner).maybeSingle();if(row.error)throw new FoundationError(503,'birth_unavailable','Could not verify your profile.');return{date,sun:calculateDateOnlySun(date),numerology:calculateDateNumerology(date,new Date().toISOString().slice(0,10)),saved:birth.selected?.date===date,requiresCorrection:Boolean(birth.available&&birth.selected?.date!==date),expectedUpdatedAt:row.data?.updated_at??null};},
 async save(owner:number,raw:unknown){
  const input=z.object({date:discoveryDate,confirmed:z.literal(true),expectedUpdatedAt:z.string().datetime({offset:true}).nullable()}).strict().parse(raw),birth=await resolvePersonalBirth(db,owner);
  if(birth.selected?.source==='birth_profile'){if(birth.selected.date!==input.date)throw new FoundationError(409,'use_birth_profile','Edit your existing personal birth profile to correct this date.');return{saved:true,alreadySaved:true};}
  if(birth.selectionRequired)throw new FoundationError(409,'birth_selection_required','Choose your personal birth profile first.');
  // A lost HTTP response may be retried with the old revision. The same
  // confirmed value is already fulfilled; never require or perform a new write.
  if(birth.selected?.date===input.date)return{saved:true,alreadySaved:true};
  const row={birth_date:input.date,updated_at:new Date().toISOString()},query=input.expectedUpdatedAt?db.from('luna_personal_profiles').update(row).eq('telegram_id',owner).eq('updated_at',input.expectedUpdatedAt):db.from('luna_personal_profiles').insert({telegram_id:owner,...row});
  const result=await query.select('telegram_id').maybeSingle();if(result.error?.code==='23505'||!result.error&&!result.data)throw new FoundationError(409,'birth_profile_changed','Refresh the saved date before confirming.');if(result.error)throw new FoundationError(503,'birth_unavailable','The date could not be confirmed.');return{saved:true,alreadySaved:false};
 }
};}
