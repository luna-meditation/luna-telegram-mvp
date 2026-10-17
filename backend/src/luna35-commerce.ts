import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {readLuna34Membership} from './luna34-membership.js';
import {readCommercialAllowance} from './luna34-allowances.js';
import {betaEntitlement,readLuna32Settings} from './luna32-runtime.js';
import {commerceText,pendingActionInput,actionEligibility,type CommerceView,type CommerceFacts} from './luna35-commerce-policy.js';
import type {createLuna30Commerce} from './luna30-commerce.js';
import {playbackRewardDecision} from './playback-security.js';
const fail=()=>new FoundationError(503,'commerce_unavailable','Your current access and balance remain unchanged.');
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Preserve the existing chat API's opaque request IDs, including older clients.
// The owner-bound deterministic UUID is only an internal persistence identity.
export function commerceRequestId(owner:number,request:string){if(z.string().uuid().safeParse(request).success)return request;const raw=hash(['luna35-commerce-request',owner,request]);return `${raw.slice(0,8)}-${raw.slice(8,12)}-4${raw.slice(13,16)}-8${raw.slice(17,20)}-${raw.slice(20,32)}`;}
type Usage={limit:number;remaining:number;resetAt:string};
type Config={LUNA34_COMMERCIAL_ENABLED:boolean;LUNA34_COMMERCIAL_QUOTAS_ENABLED:boolean;FEATURE_TAROT_PAID_READINGS:boolean;FEATURE_GARDEN_ATOMIC:boolean;FEATURE_ECONOMY_REWARDS_V2:boolean};
type PurchaseService=ReturnType<typeof createLuna30Commerce>;
export function createLuna35Commerce(db:SupabaseClient,config:Config,payments:Pick<PurchaseService,'availability'>,usage:(owner:number)=>Promise<Usage>){
 async function overview(owner:number){
  const [membership,quota,settings,products]=await Promise.all([readLuna34Membership(db,owner,config.LUNA34_COMMERCIAL_ENABLED),usage(owner),readLuna32Settings(db),payments.availability()]);
  const beta=betaEntitlement(settings),facts:CommerceFacts={balance:membership.balance,paid:membership.membership.paid,lifetime:membership.membership.kind==='lifetime',beta,usage:quota,checkout:membership.commercialEnabled,prices:membership.catalog.seeds,paidReadings:config.FEATURE_TAROT_PAID_READINGS};
  const included:Partial<Record<'three'|'five'|'compatibility',number>>={};
  if(config.LUNA34_COMMERCIAL_QUOTAS_ENABLED)for(const kind of ['three','five','compatibility'] as const){const value=await readCommercialAllowance(db,owner,kind);if(value.enabled&&typeof value.remaining==='number')included[kind]=value.remaining;}
  facts.included=included;
  if(config.FEATURE_TAROT_PAID_READINGS){const rules=await db.from('luna21_settings').select('paid_readings_enabled,single_seeds,three_seeds,five_seeds').eq('id',true).single();if(rules.error)throw fail();facts.paidReadings=rules.data.paid_readings_enabled===true;if(facts.paidReadings)facts.prices={...facts.prices,single:rules.data.single_seeds,three:rules.data.three_seeds,five:rules.data.five_seeds};}
  if(facts.lifetime||facts.paid){products.premium_month=false;products.premium_year=false;}
  // Derive the legacy reward from the actual playback decision, not the future catalog.
  const minute=playbackRewardDecision({trustedListenedSeconds:60,previouslyAwardedPosition:0,completionBonusEligible:false,completionBonusAlreadyAwarded:false}).listeningSeedsAwarded;
  const earning=config.FEATURE_ECONOMY_REWARDS_V2?[]:[{id:'meditation',destination:'meditations',rewardPerMinute:minute,completionBonus:2,condition:'new_verified_listening_only'},{id:'breath',destination:'breathwork',seeds:1,condition:'verified_completed_session'}];
  const orders=await db.from('luna30_commercial_orders').select('id,request_id,product,stars,state,created_at').eq('telegram_id',owner).in('state',['pending','accepted']).order('created_at',{ascending:false}).limit(10);if(orders.error)throw fail();
  return {facts,products,catalog:membership.catalog,membership:membership.membership,usage:quota,beta,balance:membership.balance,earning,transactions:membership.transactions,purchases:membership.purchases,newPurchases:membership.newPurchases,pendingOrders:orders.data??[]};
 }
 async function pending(owner:number,conversationId?:string){let q=db.from('luna35_pending_actions').select('id,conversation_id,action_type,parameters,language,state,expires_at,created_at').eq('telegram_id',owner).in('state',['pending','resuming']).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(3);if(conversationId)q=q.eq('conversation_id',conversationId);const r=await q;if(r.error)throw fail();return r.data??[];}
 async function verifyContext(owner:number,action:z.infer<typeof pendingActionInput>['action']){
  if(action.type==='tarot')return;
  const ids=action.type==='compatibility'?[action.chartId,action.secondChartId]:[action.chartId];
  if(new Set(ids).size!==ids.length)throw new FoundationError(422,'different_charts_required','Select two different charts.');
  const r=await db.from('luna30_chart_cache').select('id,profile_id').eq('telegram_id',owner).in('id',ids);if(r.error)throw fail();if(r.data?.length!==ids.length||new Set(r.data.map(c=>c.profile_id)).size!==ids.length)throw new FoundationError(404,'chart_not_found','Select your saved chart again.');
 }
 return {
  overview,pending,
  async card(owner:number,view:CommerceView,language:'en'|'ru',conversationId?:string){const data=await overview(owner),actions=await pending(owner,conversationId);return {version:1 as const,view,language,...data,pending:actions.map(action=>({...action,eligibility:action.action_type==='tarot'?actionEligibility(data.facts,action.parameters.kind):action.action_type==='compatibility'?actionEligibility(data.facts,'compatibility'):null})),content:commerceText(view,language,data.facts)};},
  async eligibility(owner:number,kind:'single'|'three'|'five'|'compatibility'){return actionEligibility((await overview(owner)).facts,kind);},
  async message(owner:number,input:{requestId:string;conversationId?:string;message:string;language:'en'|'ru'},view:CommerceView){
   const request=commerceRequestId(owner,input.requestId),card=await this.card(owner,view,input.language,input.conversationId);
   // Keep history compact. A card is refreshed on open; historical figures are explicitly timestamped.
   const data={version:1,view,language:input.language,checkedAt:new Date().toISOString()};
   const r=await db.rpc('luna35_save_commerce_turn',{p_owner:owner,p_request:request,p_hash:hash(input),p_conversation:input.conversationId??null,p_language:input.language,p_text:input.message,p_content:card.content,p_card:data});
   if(r.error||!r.data)throw fail();return {...r.data,requestState:'completed' as const,...card.usage};
  },
  async savePending(owner:number,raw:unknown){const input=pendingActionInput.parse(raw);await verifyContext(owner,input.action);const conversation=await db.from('ai_conversations').upsert({id:input.conversationId,telegram_id:owner,language:input.language,title:input.language==='ru'?'Сохранённое действие':'Your saved action'},{onConflict:'id',ignoreDuplicates:true});if(conversation.error)throw fail();const r=await db.rpc('luna35_save_pending_action',{p_owner:owner,p_id:input.id,p_conversation:input.conversationId,p_type:input.action.type,p_parameters:input.action,p_language:input.language,p_hash:hash(input)});if(r.error||!r.data)throw fail();return r.data;},
  async resume(owner:number,id:string,execute:(action:z.infer<typeof pendingActionInput>['action'],identity:{id:string;conversationId:string;language:'en'|'ru';seedCost:number},prior:unknown)=>Promise<{message:{id:string};conversationId:string}>,expectedSeeds?:number){
   z.string().uuid().parse(id);const lease=randomUUID(),r=await db.rpc('luna35_claim_pending_action',{p_owner:owner,p_id:id,p_lease:lease});if(r.error||!r.data)throw fail();
   const status=r.data.status;if(!['claimed','completed'].includes(status))throw new FoundationError(status==='not_found'?404:409,'pending_action_'+status,status==='expired'?'The saved action expired. Start a new one; nothing was charged.':'This saved action cannot be resumed right now.');
   const row=r.data.action,input=pendingActionInput.parse({id:row.id,conversationId:row.conversation_id,language:row.language,action:row.parameters});
   try{
    await verifyContext(owner,input.action);
    let seedCost=0;
    if(status!=='completed'&&input.action.type!=='natal'){const eligible=await this.eligibility(owner,input.action.type==='tarot'?input.action.kind:'compatibility');if(!eligible.allowed)throw new FoundationError(402,'insufficient_seeds','Your action remains saved. No Moon Seeds were charged.');seedCost=eligible.required;if(seedCost>0&&expectedSeeds!==seedCost)throw new FoundationError(409,'price_confirmation_required','Confirm the current Moon Seeds price before continuing.');}
    const result=await execute(input.action,{id,conversationId:input.conversationId,language:input.language,seedCost},status==='completed'?row.result:null);
    if(status!=='completed'){const saved=await db.rpc('luna35_finish_pending_action',{p_owner:owner,p_id:id,p_lease:lease,p_result:{messageId:result.message.id,conversationId:result.conversationId}});if(saved.error||saved.data!==true)throw fail();}
    return result;
   }catch(e){if(status!=='completed')await db.rpc('luna35_finish_pending_action',{p_owner:owner,p_id:id,p_lease:lease,p_result:null});throw e;}
  }
 };
}
