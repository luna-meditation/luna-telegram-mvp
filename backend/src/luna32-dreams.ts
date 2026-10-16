import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
export const dreamInput=z.object({clientId:z.string().uuid(),title:z.string().trim().min(1).max(100),description:z.string().trim().min(1).max(6000),language:z.enum(['en','ru']),date:z.string().date(),saveConsent:z.literal(true)}).strict();
const fields='id,client_id,title,description,language,dream_date,created_at,updated_at';
export function createDreamService(db:SupabaseClient){
 const failure=()=>new FoundationError(503,'dream_history_unavailable','Dream history is temporarily unavailable.');
 return {
  async list(owner:number,offset=0){const start=z.number().int().min(0).max(10000).parse(offset);const r=await db.from('luna32_dream_entries').select(fields).eq('telegram_id',owner).order('created_at',{ascending:false}).order('id').range(start,start+19);if(r.error)throw failure();return{dreams:r.data??[],nextOffset:r.data?.length===20?start+20:null};},
  async open(owner:number,id:string){const r=await db.from('luna32_dream_entries').select(fields).eq('telegram_id',owner).eq('id',z.string().uuid().parse(id)).maybeSingle();if(r.error)throw failure();if(!r.data)throw new FoundationError(404,'dream_not_found','Dream not found.');return r.data;},
  async save(owner:number,raw:unknown,id?:string){const v=dreamInput.parse(raw),row={client_id:v.clientId,title:v.title,description:v.description,language:v.language,dream_date:v.date,consent_version:'luna32-dream-v1',updated_at:new Date().toISOString()};
   // Replayed create never overwrites a previous explicit save. Editing needs
   // both the private row ID and the same owner; clients cannot supply an owner.
   const r=id?await db.from('luna32_dream_entries').update(row).eq('telegram_id',owner).eq('id',z.string().uuid().parse(id)).select(fields).maybeSingle():await db.from('luna32_dream_entries').upsert({...row,telegram_id:owner},{onConflict:'telegram_id,client_id',ignoreDuplicates:true}).select(fields).maybeSingle();
   if(r.error)throw failure();if(r.data)return r.data;
   if(id)throw new FoundationError(404,'dream_not_found','Dream not found.');
   const prior=await db.from('luna32_dream_entries').select(fields).eq('telegram_id',owner).eq('client_id',v.clientId).single();if(prior.error)throw failure();return prior.data;
  },
  async remove(owner:number,id:string){const r=await db.from('luna32_dream_entries').delete().eq('telegram_id',owner).eq('id',z.string().uuid().parse(id));if(r.error)throw failure();return{ok:true};}
 };
}
