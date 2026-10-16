import {supabase} from './db.js';
import {env} from './config.js';
import {eraseOptionalBirthData} from './luna30-privacy.js';
import {personalProfileSchema,emptyPersonalProfile,type PersonalProfile} from './personalization-policy.js';
import {FoundationError} from './foundation-error.js';
export {FoundationError} from './foundation-error.js';
export async function getPersonalProfile(telegramId:number):Promise<PersonalProfile>{
 const {data,error}=await supabase.from('luna_personal_profiles').select('display_name,interests,preferences,birth_date,birth_time,birth_place,ai_context_consent').eq('telegram_id',telegramId).maybeSingle();
 if(error)throw new FoundationError(503,'personal_profile_unavailable','Personal profile is unavailable.');
 // Postgres time may be returned with seconds; the app deliberately stores minute precision.
 return data?personalProfileSchema.parse({...data,birth_time:data.birth_time?.slice(0,5)??null}):{...emptyPersonalProfile};
}
export async function savePersonalProfile(telegramId:number,body:unknown){
 const profile=personalProfileSchema.parse(body);
 const {error}=await supabase.from('luna_personal_profiles').upsert({telegram_id:telegramId,...profile,updated_at:new Date().toISOString()},{onConflict:'telegram_id'});
 if(error)throw new FoundationError(503,'personal_profile_unavailable','Could not save your personal profile.');
 return profile;
}
export async function deletePersonalProfile(telegramId:number){
 // The optional 3.0 RPC erases both the existing profile and derived birth data
 // atomically, even if astrology is later switched off. Only an absent RPC may
 // fall back to the pre-3.0 path; permission/connection errors must fail closed.
 if(await eraseOptionalBirthData(supabase,telegramId,env.FEATURE_PERSONAL_MEMORY))return;
 if(env.FEATURE_ASTROLOGY)throw new FoundationError(503,'personal_profile_unavailable','Birth-data deletion is unavailable.');
 if(env.FEATURE_PERSONAL_MEMORY){
  // Erase every supplied value and revoke consent, but retain an empty privacy
  // tombstone so old messages/cached context cannot resurrect deleted facts.
  const {error}=await supabase.from('luna_personal_profiles').upsert({telegram_id:telegramId,...emptyPersonalProfile,updated_at:new Date().toISOString()},{onConflict:'telegram_id'});
  if(error)throw new FoundationError(503,'personal_profile_unavailable','Could not delete your personal profile.');
  return;
 }
 const {error}=await supabase.from('luna_personal_profiles').delete().eq('telegram_id',telegramId);
 if(error)throw new FoundationError(503,'personal_profile_unavailable','Could not delete your personal profile.');
}
