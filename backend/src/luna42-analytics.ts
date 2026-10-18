import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {cosmosAreas} from './luna41-cosmos-policy.js';
import {meetSteps} from './luna42-meet-config.js';
export const experienceInput=z.object({event:z.enum(['onboarding_opened','step_opened','onboarding_left','cosmos_opened','domain_opened']),step:z.string().default(''),sessionId:z.string().uuid()}).strict().superRefine((v,c)=>{
 if(v.event==='step_opened'?!meetSteps.some(s=>s===v.step):v.event==='domain_opened'?!cosmosAreas.some(s=>s.id===v.step):v.step!=='')c.addIssue({code:'custom',message:'Use a known step or area ID, never an answer.'});
});
export type VerifiedExperience='step_completed'|'step_skipped'|'onboarding_completed'|'domain_updated'|'manual_edit'|'conversational_edit'|'memory_saved'|'memory_deleted'|'ai_navigation';
/** Best effort and text-free: telemetry never turns a successful user save into
 * a failed response, never reserves quota and never receives answer values. */
export async function recordExperience(db:SupabaseClient,owner:number,event:VerifiedExperience,step='',key:string=crypto.randomUUID()){
 try{const r=await db.rpc('luna42_record_experience',{p_owner:owner,p_event:event,p_step:step,p_key:key,p_source:'server_verified'});return !r.error&&r.data===true;}catch{return false;}
}
export async function observeExperience(db:SupabaseClient,owner:number,raw:unknown){
 const v=experienceInput.parse(raw);
 try{const r=await db.rpc('luna42_record_experience',{p_owner:owner,p_event:v.event,p_step:v.step,p_key:v.sessionId,p_source:'client_observed'});return{recorded:!r.error&&r.data===true};}catch{return{recorded:false};}
}
