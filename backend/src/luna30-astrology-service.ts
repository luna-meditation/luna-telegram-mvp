import {createHash} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {trustedBirthInput} from './luna30-astrology-policy.js';
import {astrologyEngineMetadata,calculateNatalChart,calculateSynastry,natalCacheKey,type NatalCalculation} from './luna30-astrology-engine.js';
import {searchBirthLocations} from './luna30-locations.js';

const fields='id,subject_kind,display_label,birth_date,birth_time,location,revision,created_at,updated_at';
const unavailable=()=>new FoundationError(503,'astrology_unavailable','Astrology is temporarily unavailable.');
export function createAstrologyService(db:SupabaseClient,configured:()=>boolean){
 async function enabled(){if(!configured())throw new FoundationError(404,'feature_disabled','Astrology is not available yet.');const {data,error}=await db.from('luna30_release_settings').select('astrology_enabled').eq('id',true).single();if(error)throw unavailable();if(!data?.astrology_enabled)throw new FoundationError(404,'feature_disabled','Astrology is not available yet.');}
 async function profile(owner:number,id:string){const {data,error}=await db.from('luna30_birth_profiles').select(fields).eq('telegram_id',owner).eq('id',id).maybeSingle();if(error)throw unavailable();if(!data)throw new FoundationError(404,'birth_profile_not_found','Birth profile not found.');return data;}
 async function chart(owner:number,id:string){const {data,error}=await db.from('luna30_chart_cache').select('id,profile_id,profile_revision,calculation,created_at').eq('telegram_id',owner).eq('id',id).maybeSingle();if(error)throw unavailable();if(!data)throw new FoundationError(404,'chart_not_found','Chart not found.');return data;}
 return{
  async locations(query:string){await enabled();return{locations:searchBirthLocations(query),attribution:'GeoNames · CC BY 4.0',caveat:'City centre coordinates; select the correct city and country.'};},
  async list(owner:number){await enabled();const {data,error}=await db.from('luna30_birth_profiles').select(fields).eq('telegram_id',owner).order('created_at',{ascending:false});if(error)throw unavailable();return{profiles:data??[]};},
  async save(owner:number,raw:unknown,id?:string){await enabled();let parsed;try{parsed=trustedBirthInput(raw);}catch{throw new FoundationError(400,'invalid_birth_details','Check the birth date and select a city.');}const {value,calculation}=parsed;
   // Validate historical DST before persisting; ambiguous/nonexistent times need
   // user clarification, not an arbitrary offset or a fictitious ascendant.
   try{calculateNatalChart(calculation);}catch{throw new FoundationError(400,'ambiguous_birth_time','This local time is unavailable or ambiguous. Choose an exact time or leave it unknown.');}
   if(id){const current=await profile(owner,id);if(current.subject_kind!==value.subjectKind)throw new FoundationError(400,'invalid_birth_details','Subject kind cannot change.');if(value.revision!==current.revision)throw new FoundationError(409,'birth_profile_changed','Reload the updated birth details.');}
   const row={subject_kind:value.subjectKind,display_label:value.label,birth_date:value.date,birth_time:value.time,location:calculation.location,consent_version:'luna30-birth-v1',consented_at:new Date().toISOString()};
   const query=id?db.from('luna30_birth_profiles').update(row).eq('telegram_id',owner).eq('id',id).eq('revision',value.revision!):db.from('luna30_birth_profiles').insert({...row,telegram_id:owner});
   const {data,error}=await query.select(fields).maybeSingle();if(error){if(error.code==='23505')throw new FoundationError(409,'self_profile_exists','Your own birth profile already exists.');if(error.code==='23514')throw new FoundationError(400,'birth_profile_limit','Birth profile limit reached.');throw unavailable();}if(!data)throw new FoundationError(409,'birth_profile_changed','Reload the updated birth details.');return{profile:data};
  },
  async remove(owner:number,id:string){await enabled();const {data,error}=await db.from('luna30_birth_profiles').delete().eq('telegram_id',owner).eq('id',id).select('id');if(error)throw unavailable();if(!data?.length)throw new FoundationError(404,'birth_profile_not_found','Birth profile not found.');return{ok:true};},
  async calculate(owner:number,id:string){await enabled();const p=await profile(owner,id);const input={date:p.birth_date,time:p.birth_time?.slice(0,5)??null,location:p.location};
   // Profile id/revision are part of the key: two different people with identical
   // input must not share a deletable private cache record.
   const key=createHash('sha256').update(`${p.id}:${p.revision}:${natalCacheKey(owner,input)}`).digest('hex');
   const existing=await db.from('luna30_chart_cache').select('id,profile_id,profile_revision,calculation,created_at').eq('telegram_id',owner).eq('cache_key',key).maybeSingle();if(existing.error)throw unavailable();if(existing.data)return{chart:existing.data,cached:true};
   let calculation:NatalCalculation;try{calculation=calculateNatalChart(input);}catch{throw new FoundationError(400,'ambiguous_birth_time','Clarify the birth time.');}
   const {error}=await db.from('luna30_chart_cache').upsert({telegram_id:owner,profile_id:p.id,profile_revision:p.revision,cache_key:key,engine:astrologyEngineMetadata.id,engine_version:astrologyEngineMetadata.version,ephemeris:astrologyEngineMetadata.ephemeris,tzdb_version:astrologyEngineMetadata.tzdb,calculation},{onConflict:'telegram_id,cache_key',ignoreDuplicates:true});if(error){if(error.code==='23514'||error.code==='23503')throw new FoundationError(409,'birth_profile_changed','Birth details changed. Recalculate the chart.');throw unavailable();}
   const result=await db.from('luna30_chart_cache').select('id,profile_id,profile_revision,calculation,created_at').eq('telegram_id',owner).eq('cache_key',key).single();if(result.error)throw unavailable();return{chart:result.data,cached:false};
  },
  async open(owner:number,id:string){await enabled();return{chart:await chart(owner,id)};},
  async compatibility(owner:number,firstId:string,secondId:string){await enabled();if(firstId===secondId)throw new FoundationError(400,'different_charts_required','Select two different birth profiles.');const [first,second]=await Promise.all([chart(owner,firstId),chart(owner,secondId)]);if(first.profile_id===second.profile_id)throw new FoundationError(400,'different_charts_required','Select two different birth profiles.');return{firstChartId:first.id,secondChartId:second.id,...calculateSynastry(first.calculation as NatalCalculation,second.calculation as NatalCalculation)};}
 };
}
