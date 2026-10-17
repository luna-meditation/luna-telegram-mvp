import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {luna30FeatureEnabled,type Luna30Gate} from './luna30-commercial-policy.js';
import {isValidTelegramInvoiceUrl} from './plans.js';
import {recordFunnel} from './luna35-funnel.js';
export const commercialProduct=z.enum(['premium_month','premium_year','seeds_100','seeds_300','seeds_700','seeds_1500','support']);
const gates:Record<z.infer<typeof commercialProduct>,Luna30Gate>={premium_month:'premium',premium_year:'annual',seeds_100:'seed_packages',seeds_300:'seed_packages',seeds_700:'seed_packages',seeds_1500:'seed_packages',support:'support'};
export const commercialPayload=z.object({v:z.literal(3),kind:z.literal('commerce'),orderId:z.string().uuid(),telegramId:z.number().int().positive()}).strict();
export const commercialPurchase=z.object({requestId:z.string().uuid(),product:commercialProduct,expectedStars:z.number().int().min(1).max(10000),confirmed:z.literal(true),termsAccepted:z.literal(true)}).strict();
type Invoice={title:string;description:string;payload:string;currency:'XTR';provider_token:'';prices:Array<{label:string;amount:number}>;subscription_period?:number};
export function createLuna30Commerce(db:SupabaseClient,environment:Record<string,unknown>,invoice:(value:Invoice)=>Promise<string>){
 const unavailable=()=>new FoundationError(503,'commerce_unavailable','Reopen your saved order.');
 const currentCatalog=environment.LUNA34_COMMERCIAL_ENABLED===true||environment.LUNA34_COMMERCIAL_ENABLED==='true';
 async function enabled(product:z.infer<typeof commercialProduct>){
  if(['premium_month','premium_year'].includes(product)&&environment.LUNA30_PREMIUM_ENTITLEMENTS_ENABLED!==true&&environment.LUNA30_PREMIUM_ENTITLEMENTS_ENABLED!=='true')return false;
  const gate=gates[product],value=environment[`LUNA30_${gate.toUpperCase()}_ENABLED`];if(value!==true&&value!=='true')return false;
  if(currentCatalog){const r=await db.from('luna34_commercial_settings').select('checkout_enabled,owner_approved,live_payment_verified').eq('id',true).single();if(r.error)throw unavailable();return r.data?.checkout_enabled===true&&r.data.owner_approved===true&&r.data.live_payment_verified===true;}
  const {data,error}=await db.from('luna30_release_settings').select('*').eq('id',true).single();if(error)throw unavailable();
  return luna30FeatureEnabled(gate,environment,{version:data.catalog_version,enabled:{[gate]:data[`${gate}_enabled`]}});
 }
 return {
  async availability(){const products=commercialProduct.options;const result=await Promise.all(products.map(async product=>[product,await enabled(product)] as const));return Object.fromEntries(result) as Record<z.infer<typeof commercialProduct>,boolean>;},
  async purchase(owner:number,body:unknown){const input=commercialPurchase.parse(body);if(!await enabled(input.product))throw new FoundationError(404,'feature_disabled','This product is not on sale.');
   const args={p_owner:owner,p_request:input.requestId,p_product:input.product,p_expected:input.expectedStars};const {data,error}=currentCatalog?await db.rpc('luna34_prepare_order',args):await db.rpc('luna30_prepare_order',args);if(error||!data)throw unavailable();
   if(!data.order)throw new FoundationError(409,data.status,'This order is not available.');
   const order=data.order;if(order.state==='paid')return{order,invoiceUrl:null};if(!['pending','accepted'].includes(order.state))throw unavailable();
   const payload=commercialPayload.parse({v:3,kind:'commerce',orderId:order.id,telegramId:owner});
   const url=await invoice({title:input.product==='support'?'Support Luna':'Luna · '+input.product,description:input.product==='support'?'Optional support for Luna development. No subscription, paid content or special benefits. Not a charitable donation.':input.product==='premium_month'?'30-day Luna Premium. Renews every 30 days until cancelled.':input.product==='premium_year'?'365 days of Luna Premium. Prepaid access; no automatic annual renewal.':'Moon Seeds for optional Luna content. No cash value.',payload:JSON.stringify(payload),currency:'XTR',provider_token:'',prices:[{label:'Luna',amount:order.stars}],...(input.product==='premium_month'?{subscription_period:2592000}:{})});
   if(!isValidTelegramInvoiceUrl(url))throw unavailable();await recordFunnel(db,owner,'purchase_initiated',order.id,'verified');return{order,invoiceUrl:url};
  },
  async precheckout(owner:number,body:unknown,currency:string,stars:number,query:string){const p=commercialPayload.safeParse(body);if(!p.success||p.data.telegramId!==owner||currency!=='XTR'||!Number.isSafeInteger(stars))return false;
   const order=await db.from('luna30_commercial_orders').select('product').eq('telegram_id',owner).eq('id',p.data.orderId).maybeSingle();if(order.error||!order.data||!await enabled(order.data.product))return false;
   const args={p_owner:owner,p_order:p.data.orderId,p_stars:stars,p_query:query};const result=currentCatalog?await db.rpc('luna34_accept_order',args):await db.rpc('luna30_accept_order',args);return !result.error&&result.data===true;
  },
  async fulfill(owner:number,body:unknown,payment:{currency:string;total_amount:number;telegram_payment_charge_id:string;subscription_expiration_date?:number;is_recurring?:boolean}){
   const p=commercialPayload.parse(body);if(p.telegramId!==owner||payment.currency!=='XTR'||!Number.isSafeInteger(payment.total_amount)||!payment.telegram_payment_charge_id)throw new FoundationError(400,'invalid_receipt','Invalid receipt.');
   // Legitimate accepted receipts are settled even after sales are disabled.
   const args={p_owner:owner,p_order:p.orderId,p_charge:payment.telegram_payment_charge_id,p_stars:payment.total_amount,p_expires:payment.subscription_expiration_date?new Date(payment.subscription_expiration_date*1000).toISOString():null,p_recurring:payment.is_recurring===true};let result=await db.rpc('luna34_fulfill_order',args);if(result.error?.code==='PGRST202')result=await db.rpc('luna30_fulfill_order',args);if(result.error||!result.data)throw unavailable();if(result.data.status==='paid'||result.data.status==='duplicate')await recordFunnel(db,owner,'purchase_completed',payment.telegram_payment_charge_id,'verified');return result.data;
  },
  async recordRefund(owner:number,payment:{currency:string;total_amount:number;telegram_payment_charge_id:string}){
   if(payment.currency!=='XTR'||!Number.isSafeInteger(payment.total_amount))throw new FoundationError(400,'invalid_receipt','Invalid refund.');
   const args={p_owner:owner,p_charge:payment.telegram_payment_charge_id,p_stars:payment.total_amount};let result=await db.rpc('luna34_record_refund',args);if(result.error?.code==='PGRST202')result=await db.rpc('luna30_record_refund',args);if(result.error||!result.data)throw unavailable();return result.data;
  }
 };
}
