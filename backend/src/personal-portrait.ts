import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {resolvePersonalBirth,numerologyFromBirth,birthContextAvailability} from './personal-context-engine.js';
import {buildPersonalPortrait} from './personal-portrait-policy.js';
import type {PersonalMemory} from './personal-memory-policy.js';
import type {PersonalProfile} from './personalization-policy.js';
import {symbolicChartFacts} from './luna30-astrology-report-policy.js';
import type {NatalCalculation} from './luna30-astrology-engine.js';

export async function readPersonalPortrait(db:SupabaseClient,owner:number,input:{memories:PersonalMemory[];profile:PersonalProfile;memoryEnabled:boolean},asOf=new Date().toISOString().slice(0,10)){
 const birth=await resolvePersonalBirth(db,owner);
 let chart:{id:string;facts:ReturnType<typeof symbolicChartFacts>}|null=null;
 if(birth.selected?.source==='birth_profile'){
  const cached=await db.from('luna30_chart_cache').select('id,calculation').eq('telegram_id',owner).eq('profile_id',birth.selected.id).eq('profile_revision',birth.selected.revision!).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(cached.error)throw new FoundationError(503,'portrait_unavailable','Could not verify your calculated portrait.');
  if(cached.data)chart={id:cached.data.id,facts:symbolicChartFacts(cached.data.calculation as NatalCalculation)};
 }
 return{...buildPersonalPortrait({...input,hasBirth:birth.available}),birth:birthContextAvailability(birth),numerology:numerologyFromBirth(birth,asOf),chart};
}
