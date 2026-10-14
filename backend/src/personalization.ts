import {supabase} from './db.js';
import {personalProfileSchema,emptyPersonalProfile,type PersonalProfile} from './personalization-policy.js';
export class FoundationError extends Error {constructor(public status:number,public code:string,message:string){super(message);}}
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
 const {error}=await supabase.from('luna_personal_profiles').delete().eq('telegram_id',telegramId);
 if(error)throw new FoundationError(503,'personal_profile_unavailable','Could not delete your personal profile.');
}
