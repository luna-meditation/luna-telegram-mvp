import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
export type AdminGrant={id:string;source:string;starts_at:string;expires_at:string|null;lifetime:boolean;revoked_at:string|null};
export function effectiveAdminGrants(grants:AdminGrant[],now=Date.now()){
 const active=grants.filter(g=>!g.revoked_at&&Date.parse(g.starts_at)<=now&&(g.lifetime||Date.parse(g.expires_at??'')>now));
 return {active:active.length>0,lifetime:active.some(g=>g.lifetime),until:active.some(g=>g.lifetime)?null:active.map(g=>g.expires_at!).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]??null,sources:[...new Set(active.map(g=>g.source))]};
}
export async function readAdminGrants(db:SupabaseClient,owner:number){const r=await db.from('luna40_entitlement_grants').select('id,source,starts_at,expires_at,lifetime,revoked_at').eq('telegram_id',owner).is('revoked_at',null).lte('starts_at',new Date().toISOString()).limit(200);if(r.error)throw new FoundationError(503,'admin_grants_unavailable','Access could not be verified. Existing rights are unchanged.');return effectiveAdminGrants(r.data??[]);}
export async function adminQuotaUsage(db:SupabaseClient,owner:number,limit:number,used:number,resetAt:string){const r=await db.rpc('luna40_quota_available',{p_owner:owner});if(r.error||!Number.isSafeInteger(r.data)||r.data<0)throw new FoundationError(503,'quota_unavailable','The allowance could not be verified.');return{remaining:Math.max(0,limit-used)+r.data,limit:Math.max(limit,used)+r.data,resetAt,adminBonusRemaining:r.data};}
