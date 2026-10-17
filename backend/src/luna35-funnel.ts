import {createHash} from 'node:crypto';import {z} from 'zod';import type {SupabaseClient} from '@supabase/supabase-js';
export const funnelEvents=['bot_welcome_sent','mini_app_launched','referral_link_opened','new_user_authenticated','onboarding_completed','first_tarot_completed','first_ai_response','first_astrology_profile','membership_viewed','purchase_initiated','purchase_completed'] as const;
/** Telemetry must never prevent a practice, receipt fulfillment or account load. */
export async function recordFunnel(db:SupabaseClient,owner:number,event:typeof funnelEvents[number],key:string,source:'bot'|'app'|'verified'){
 const data=z.object({owner:z.number().int().positive(),event:z.enum(funnelEvents),key:z.string().min(1).max(20000),source:z.enum(['bot','app','verified'])}).strict().safeParse({owner,event,key,source});if(!data.success)return false;
 const event_key=createHash('sha256').update(`luna35:${owner}:${event}:${key}`).digest('hex');
 try{const r=await db.from('luna35_funnel_events').upsert({telegram_id:owner,event,event_key,source},{onConflict:'telegram_id,event,event_key',ignoreDuplicates:true});return !r.error;}catch{return false;}
}
