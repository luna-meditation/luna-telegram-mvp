import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {cosmosStateInput,emptyCosmosState,type CosmosState} from './luna41-cosmos-policy.js';
export function createCosmosStateService(db:SupabaseClient){
 const table='luna41_cosmos_onboarding',fields='skipped,revision,updated_at,last_request_id';
 const visible=(r:{skipped:string[];revision:number;updated_at:string}):CosmosState=>({skipped:r.skipped,revision:r.revision,updatedAt:r.updated_at});
 async function read(owner:number){const r=await db.from(table).select(fields).eq('telegram_id',owner).maybeSingle();if(r.error)throw new FoundationError(503,'cosmos_unavailable','Your setup progress could not be loaded.');return r.data;}
 return {
  async get(owner:number){const row=await read(owner);return row?visible(row):emptyCosmosState();},
  async save(owner:number,raw:unknown){
   const input=cosmosStateInput.parse(raw),old=await read(owner);
   if(old?.last_request_id===input.requestId)return visible(old);
   if((old?.revision??0)!==input.expectedRevision)throw new FoundationError(409,'cosmos_changed','Refresh setup progress before continuing.');
   const row={skipped:input.skipped,revision:input.expectedRevision+1,last_request_id:input.requestId,updated_at:new Date().toISOString()};
   const q=old?db.from(table).update(row).eq('telegram_id',owner).eq('revision',input.expectedRevision):db.from(table).insert({telegram_id:owner,...row});
   const r=await q.select(fields).maybeSingle();if(r.error?.code==='23505'||!r.error&&!r.data)throw new FoundationError(409,'cosmos_changed','Refresh setup progress before continuing.');if(r.error||!r.data)throw new FoundationError(503,'cosmos_unavailable','Could not save setup progress.');return visible(r.data);
  },
  async remove(owner:number){const r=await db.from(table).delete().eq('telegram_id',owner);if(r.error)throw new FoundationError(503,'cosmos_unavailable','Could not remove setup progress.');}
 };
}
