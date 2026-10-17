import {createHash} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
export type AllowanceStatus={enabled:boolean;preserveLegacy?:boolean;status?:string;scope?:'utc_day'|'billing_month';limit?:number;remaining?:number;resetAt?:string};
const unavailable=()=>new FoundationError(503,'allowance_unavailable','Your subscription is preserved. Saved results remain available.');
export async function readCommercialAllowance(db:SupabaseClient,owner:number,bucket='ai'):Promise<AllowanceStatus>{const r=await db.rpc('luna34_allowance_status',{p_owner:owner,p_bucket:bucket,p_exclude:null});if(r.error||!r.data)throw unavailable();return r.data;}
export function allowanceIdentity(owner:number,operation:string){const hash=createHash('sha256').update('luna34:'+owner+':'+operation).digest('hex');return {hash,id:`${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`};}
/** Initial interpretations have their own buckets; ordinary chat follow-ups do
 * not inherit the initial report benefit just because a chart is attached. */
export async function operationBucket(db:SupabaseClient,owner:number,key:string):Promise<'ai'|'three'|'five'|'compatibility'|null>{
 if(key.startsWith('chat:'))return 'ai';
 if(key.startsWith('tarot:')){const r=await db.from('luna_tarot_readings').select('reading_kind').eq('telegram_id',owner).eq('client_reading_id',key.slice(6)).maybeSingle();if(r.error||!r.data)throw unavailable();return r.data.reading_kind==='three'?'three':r.data.reading_kind==='five'?'five':null;}
 if(key.startsWith('report:')){const r=await db.from('luna30_astrology_jobs').select('report_kind').eq('telegram_id',owner).eq('cache_key',key.slice(7)).maybeSingle();if(r.error||!r.data)throw unavailable();return r.data.report_kind==='compatibility'?'compatibility':null;}
 throw unavailable();
}
export async function reserveCommercialAllowance(db:SupabaseClient,owner:number,key:string){
 const bucket=await operationBucket(db,owner,key);if(bucket===null)return null;const identity=allowanceIdentity(owner,key);
 const r=await db.rpc('luna34_reserve_allowance',{p_owner:owner,p_request:identity.id,p_bucket:bucket,p_hash:identity.hash});if(r.error||!r.data)throw unavailable();const value=r.data as AllowanceStatus&{replay?:boolean};
 // The global operation lease is acquired FIRST by guardedProviderTransport.
 // Reusing this identical hold is safe; it is not permission for a second call.
 if(!value.enabled)throw unavailable();if(value.status!=='reserved')throw new FoundationError(value.status==='limit'?429:value.status==='no_included_allowance'?402:409,value.status==='limit'?'quota_exhausted':value.status==='no_included_allowance'?'reading_allowance_required':'allowance_conflict','This allowance is unavailable. No Moon Seeds were charged.');
 return identity.id;
}
