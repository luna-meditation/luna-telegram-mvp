import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
/** False only when BOTH optional RPC and optional table are demonstrably absent. */
export async function eraseOptionalBirthData(db:SupabaseClient,owner:number,tombstone:boolean){
 const erased=await db.rpc('luna30_clear_personal_profile',{p_owner:owner,p_tombstone:tombstone});
 if(!erased.error)return true;
 if(erased.error.code==='PGRST202'){
  const table=await db.from('luna30_birth_profiles').select('id').eq('telegram_id',owner).limit(1);
  if(table.error?.code==='PGRST205')return false;
 }
 // Includes a stale RPC schema cache, missing internal dependencies, denied
 // permissions and transport errors. Never report success with private rows left.
 throw new FoundationError(503,'personal_profile_unavailable','Private birth-data deletion is temporarily unavailable.');
}
