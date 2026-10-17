import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';

export const languagePreferenceInput=z.object({mode:z.enum(['auto','en','ru']),expectedRevision:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),requestId:z.string().uuid()}).strict();
export function createLanguagePreferences(db:SupabaseClient){
 return {
  async read(owner:number){
   const result=await db.from('luna40_language_preferences').select('mode,revision,updated_at').eq('telegram_id',owner).maybeSingle();
   if(result.error)throw new FoundationError(503,'language_preference_unavailable','Your device language choice is preserved.');
   return {mode:result.data?.mode??'auto',revision:result.data?.revision??0,updatedAt:result.data?.updated_at??null};
  },
  async update(owner:number,body:unknown){
   const input=languagePreferenceInput.parse(body);
   const result=await db.rpc('luna40_set_language_preference',{p_owner:owner,p_mode:input.mode,p_expected_revision:input.expectedRevision,p_request:input.requestId});
   if(result.error)throw new FoundationError(503,'language_preference_unavailable','Your device language choice is preserved.');
   if(!result.data)throw new FoundationError(503,'language_preference_unavailable','Your device language choice is preserved.');
   return result.data;
  }
 };
}
