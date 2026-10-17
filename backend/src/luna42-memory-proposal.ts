import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {canonicalMemoryKey,containsCredential,potentiallySensitive,personalMemoryCategories} from './personal-memory-policy.js';
import {cosmosAreas} from './luna41-cosmos-policy.js';
import {readCosmosDomain,writeCosmosDomain} from './luna42-cosmos-domain.js';

export const memoryProposalInput=z.object({operation:z.enum(['save','delete']),key:z.string().trim().min(2).max(64).regex(/^[\p{L}\p{N} _-]+$/u),category:z.enum(personalMemoryCategories),value:z.string().trim().max(500).nullable(),field:z.enum(['status','priority','details','goal']).nullable()}).strict();
export type MemoryProposal={version:1;id:string;operation:'save'|'delete';key:string;category:string;before:string|null;after:string|null;memoryId:string|null;expectedRevision:number;sourceMessageId:string;boundary:string|null;state:'pending'|'applied'|'cancelled';createdAt:string;expiresAt:string};
type Existing={id:string;memory_key:string;memory_value:string;category:string;revision:number;is_sensitive:boolean};
/** A proposal is inert. Only a later authenticated, explicit UI confirmation can
 * change memory. Neither model prose nor an AI tool call is user consent. */
export function buildMemoryProposal(raw:unknown,context:{id:string;sourceMessageId:string;boundary:string|null;existing:Existing|null;now?:number}):MemoryProposal{
 const input=memoryProposalInput.parse(raw),key=canonicalMemoryKey(input.key),old=context.existing;
 if(input.category==='birth_information'||/^(?:name|display_name|preferred_name|language|имя|обращение|birth_.*)$/.test(key))throw new FoundationError(422,'use_profile','Use the canonical profile editor for identity and birth details.');
 if(old?.is_sensitive||potentiallySensitive((old?.memory_key??'')+' '+(old?.memory_value??'')))throw new FoundationError(422,'private_memory_editor_required','Manage private information in My Cosmos, without sending it to AI.');
 if(input.operation==='delete'&&(input.value!==null||!old))throw new FoundationError(422,'memory_target_required','Choose an existing topic before deleting it.');
 let after:string|null=null,category=old?.category??input.category,operation=input.operation;
 if(input.operation==='delete'&&input.field){
  const area=cosmosAreas.find(a=>'cosmos_'+a.id===key),domain=readCosmosDomain(old!.memory_value);
  if(!area||!domain[input.field])throw new FoundationError(422,'memory_field_not_found','Review the exact saved field before removing it.');
  domain[input.field]='';category=area.category;
  if([domain.status,domain.priority,domain.details,domain.goal].some(Boolean)){after=writeCosmosDomain(domain);operation='save';}
 }
 if(input.operation==='save'){
  if(!input.value||input.value.length<2||containsCredential(input.value)||potentiallySensitive(key+' '+input.value))throw new FoundationError(422,'private_memory_editor_required','Use the private editor for sensitive information. Never save credentials.');
  if(key.startsWith('cosmos_')){
   const area=cosmosAreas.find(a=>'cosmos_'+a.id===key);if(!area||!input.field)throw new FoundationError(422,'invalid_cosmos_area','Choose a real life area and field.');
   category=area.category;
   try{after=writeCosmosDomain({...readCosmosDomain(old?.memory_value??''),[input.field]:input.value});}catch{throw new FoundationError(422,'memory_too_long','This update is too long. Review it in My Cosmos.');}
  }else{
   if(input.field!==null)throw new FoundationError(422,'invalid_memory_field','Fields apply only to My Cosmos life areas.');
   after=input.value;
  }
 }
 const now=context.now??Date.now();
 return{version:1,id:context.id,operation,key,category,before:old?.memory_value??null,after,memoryId:old?.id??null,expectedRevision:old?.revision??0,sourceMessageId:context.sourceMessageId,boundary:context.boundary,state:'pending',createdAt:new Date(now).toISOString(),expiresAt:new Date(now+24*60*60*1000).toISOString()};
}
export async function prepareMemoryProposal(db:SupabaseClient,owner:number,raw:unknown,context:{id:string;sourceMessageId:string;boundary:string|null}){
 const input=memoryProposalInput.parse(raw),key=canonicalMemoryKey(input.key);
 const result=await db.from('user_memories').select('id,memory_key,memory_value,category,revision,is_sensitive').eq('telegram_id',owner).eq('is_active',true).eq('memory_key',key).limit(2);
 if(result.error)throw new FoundationError(503,'memory_unavailable','Could not verify the current memory.');
 if((result.data?.length??0)>1)throw new FoundationError(409,'memory_conflict','Review conflicting entries in My Cosmos.');
 return buildMemoryProposal(raw,{...context,existing:result.data?.[0]??null});
}
export const memoryProposalDecision=z.object({proposalId:z.string().uuid(),confirmed:z.boolean()}).strict();
export async function decideMemoryProposal(db:SupabaseClient,owner:number,messageId:string,raw:unknown){
 const input=memoryProposalDecision.parse(raw),result=await db.rpc('luna42_decide_memory_proposal',{p_owner:owner,p_message:messageId,p_proposal:input.proposalId,p_confirm:input.confirmed});
 if(result.error)throw new FoundationError(result.error.code==='P0002'?404:['40001','23514','23505'].includes(result.error.code)?409:503,result.error.code==='P0002'?'memory_proposal_not_found':['40001','23514','23505'].includes(result.error.code)?'memory_proposal_changed':'memory_unavailable','This proposal could not be applied. Reopen My Cosmos to review the latest information.');
 return{proposal:result.data as MemoryProposal};
}
