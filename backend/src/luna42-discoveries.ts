import {z} from 'zod';import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {containsCredential} from './personal-memory-policy.js';
export const discoveryKinds=['tarot','astrology','reflection'] as const;
const discoveryTitle=z.string().trim().min(2).max(100).refine(value=>!containsCredential(value),'Do not store passwords or credentials.');
export const discoveryInput=z.object({requestId:z.string().uuid(),kind:z.enum(discoveryKinds),referenceId:z.string().uuid(),title:discoveryTitle}).strict();
export const discoveryRename=z.object({requestId:z.string().uuid(),title:discoveryTitle,expectedRevision:z.number().int().positive()}).strict();
export type Discovery={id:string;kind:typeof discoveryKinds[number];reference_id:string;title:string;revision:number;created_at:string;updated_at:string};
const fields='id,kind,reference_id,title,revision,created_at,updated_at';
const fail=(code?:string)=>new FoundationError(code==='P0002'?404:code==='40001'||code==='23514'?409:503,code==='P0002'?'discovery_not_found':code==='40001'?'discovery_changed':'discovery_unavailable','This saved discovery is unavailable or changed. Reopen your discoveries before trying again.');
export function createDiscoveryService(db:SupabaseClient){
 async function row(owner:number,id:string){const r=await db.from('luna42_discoveries').select(fields).eq('telegram_id',owner).eq('id',id).maybeSingle();if(r.error)throw fail();if(!r.data)throw fail('P0002');return r.data as Discovery;}
 return{
  async list(owner:number){const r=await db.from('luna42_discoveries').select(fields).eq('telegram_id',owner).order('updated_at',{ascending:false}).limit(200);if(r.error)throw fail();return{discoveries:r.data as Discovery[]};},
  async save(owner:number,raw:unknown){const v=discoveryInput.parse(raw),r=await db.rpc('luna42_save_discovery',{p_owner:owner,p_request:v.requestId,p_kind:v.kind,p_reference:v.referenceId,p_title:v.title});if(r.error)throw fail(r.error.code);return{discovery:r.data as Discovery};},
  async rename(owner:number,id:string,raw:unknown){const v=discoveryRename.parse(raw),r=await db.rpc('luna42_rename_discovery',{p_owner:owner,p_id:id,p_request:v.requestId,p_title:v.title,p_expected:v.expectedRevision});if(r.error)throw fail(r.error.code);return{discovery:r.data as Discovery};},
  async remove(owner:number,id:string){const r=await db.from('luna42_discoveries').delete().eq('telegram_id',owner).eq('id',id);if(r.error)throw fail();return{removed:true,sourceDeleted:false};},
  async open(owner:number,id:string){const saved=await row(owner,id);
   if(saved.kind==='astrology'){const r=await db.from('ai_messages').select('id,conversation_id,role,metadata').eq('telegram_id',owner).eq('id',saved.reference_id).maybeSingle();if(r.error)throw fail();if(!r.data||r.data.role!=='assistant'||r.data.metadata?.astrologyWorkflow?.state!=='ready')throw fail('P0002');return{kind:saved.kind,referenceId:saved.reference_id,conversationId:r.data.conversation_id as string};}
   let query=db.from(saved.kind==='tarot'?'luna_tarot_readings':'user_memories').select('id').eq('telegram_id',owner).eq('id',saved.reference_id);if(saved.kind==='reflection')query=query.eq('is_active',true).eq('memory_kind','symbolic').eq('category','reflections');
   const r=await query.maybeSingle();if(r.error)throw fail();if(!r.data)throw fail('P0002');return{kind:saved.kind,referenceId:saved.reference_id};
  }
 };
}
