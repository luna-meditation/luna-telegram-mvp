import {z} from 'zod';
import {env} from './config.js';
import {supabase} from './db.js';
import {FoundationError} from './personalization.js';
import {isValidTelegramInvoiceUrl} from './plans.js';
import {readTarotPrices,buyContractReading} from './luna4-tarot.js';
import {reconcileReferralPurchase}from'./luna4-referrals.js';
const kindSchema=z.enum(['single','three','five']);
export const readingPurchaseSchema=z.object({requestId:z.string().uuid(),kind:kindSchema,currency:z.enum(['SEEDS','XTR']),expectedAmount:z.number().int().positive(),confirmed:z.literal(true),termsAccepted:z.literal(true)}).strict();
export const readingInvoicePayloadSchema=z.object({v:z.literal(2),kind:z.literal('tarot'),orderId:z.string().uuid(),telegramId:z.number().int().positive()}).strict();
type Settings={paid_readings_enabled:boolean;wallet_enabled:boolean;premium_enabled:boolean;single_seeds:number;three_seeds:number;five_seeds:number;single_stars:number;three_stars:number;five_stars:number;premium_three_daily:number;premium_five_daily:number;monthly_premium_stars:number|null};
export type ReadingOrder={id:string;kind:z.infer<typeof kindSchema>;currency:'SEEDS'|'XTR';amount:number;status:'pending'|'entitled'|'consumed'|'refunded';client_reading_id:string|null};
async function settings(){const {data,error}=await supabase.from('luna21_settings').select('*').eq('id',true).single();if(error||!data)throw new FoundationError(503,'commerce_unavailable','This offer is unavailable.');return data as Settings;}
export async function luna21Offers(){
 if(!env.FEATURE_TAROT_PAID_READINGS&&!env.FEATURE_PREMIUM_V2)return {enabled:false,offers:[],premium:null};
 const s=await settings(),prices=await readTarotPrices(supabase),enabled=env.FEATURE_TAROT_PAID_READINGS&&s.paid_readings_enabled&&(!prices||prices.enabled);
 return {enabled,offers:enabled?(['single','three','five'] as const).map(kind=>({kind,cards:kind==='single'?1:kind==='three'?3:5,seeds:env.FEATURE_MOON_SEEDS_WALLET_V2&&s.wallet_enabled?prices?.[kind]??s[`${kind}_seeds`]:null,stars:s[`${kind}_stars`]})):[],premium:!prices&&env.FEATURE_PREMIUM_V2&&s.premium_enabled?{threeDaily:s.premium_three_daily,fiveDaily:s.premium_five_daily,monthlyStars:s.monthly_premium_stars}:null};
}
export async function getLuna21Order(telegramId:number,id:unknown){
 const orderId=z.string().uuid().parse(id);
 const {data,error}=await supabase.from('luna_reading_orders').select('id,kind,currency,amount,status,client_reading_id').eq('telegram_id',telegramId).eq('id',orderId).maybeSingle();
 if(error)throw new FoundationError(503,'order_unavailable','Please reopen your order.');if(!data)throw new FoundationError(404,'order_unavailable','Order not found.');return data as ReadingOrder;
}
type InvoiceTransport=(invoice:{title:string;description:string;payload:string;provider_token:string;currency:'XTR';prices:Array<{label:string;amount:number}>})=>Promise<string>;
export async function buyLuna21Reading(telegramId:number,body:unknown,invoice:InvoiceTransport){
 if(!env.FEATURE_TAROT_PAID_READINGS)throw new FoundationError(404,'feature_disabled','This offer is not available.');
 const input=readingPurchaseSchema.parse(body),s=await settings();
 if(!s.paid_readings_enabled||input.currency==='SEEDS'&&(!s.wallet_enabled||!env.FEATURE_MOON_SEEDS_WALLET_V2))throw new FoundationError(404,'feature_disabled','This offer is not available.');
 const args={p_telegram_id:telegramId,p_request_id:input.requestId,p_kind:input.kind,p_expected_amount:input.expectedAmount};
 const {data,error}=await (input.currency==='SEEDS'?buyContractReading(supabase,args):supabase.rpc('luna21_prepare_stars_reading',args));
 if(error||!data)throw new FoundationError(503,'order_unavailable','Could not create your order.');
 const result=data as {status:string;order?:ReadingOrder};
 if(!result.order)throw new FoundationError(result.status==='insufficient'?402:409,result.status==='insufficient'?'insufficient_seeds':result.status==='price_changed'?'price_changed':'order_unavailable','This order is unavailable.');
 if(input.currency==='SEEDS'||result.order.status!=='pending')return {order:result.order,invoiceUrl:null};
 const order=result.order,payload=readingInvoicePayloadSchema.parse({v:2,kind:'tarot',orderId:order.id,telegramId});
 const url=await invoice({title:`Luna Tarot · ${input.kind==='single'?1:input.kind==='three'?3:5} cards`,description:'One symbolic reading with a Luna AI reflection. Not a prediction or professional advice.',payload:JSON.stringify(payload),provider_token:'',currency:'XTR',prices:[{label:'Luna Tarot reading',amount:order.amount}]});
 if(!isValidTelegramInvoiceUrl(url))throw new FoundationError(503,'invoice_unavailable','Please reopen your saved order.');
 return {order,invoiceUrl:url};
}
export async function validateLuna21Precheckout(user:number,payload:unknown,currency:unknown,amount:unknown,queryId:string){
 if(!env.FEATURE_TAROT_PAID_READINGS)return false;
 const parsed=readingInvoicePayloadSchema.safeParse(payload);if(!parsed.success||parsed.data.telegramId!==user||currency!=='XTR'||!Number.isSafeInteger(amount))return false;
 const s=await settings();if(!s.paid_readings_enabled)return false;
 const {data,error}=await supabase.rpc('luna21_claim_stars_checkout',{p_telegram_id:user,p_order_id:parsed.data.orderId,p_currency:currency,p_amount:amount,p_query_id:queryId});
 return !error&&data===true;
}
export async function fulfillLuna21Payment(user:number,payload:unknown,currency:unknown,amount:unknown,charge:unknown){
 const p=readingInvoicePayloadSchema.parse(payload);if(p.telegramId!==user||currency!=='XTR'||!Number.isSafeInteger(amount)||typeof charge!=='string'||!charge)throw new FoundationError(400,'invalid_receipt','Invalid receipt.');
 // Fulfill previously accepted legitimate payments even when sales are paused.
 const {data,error}=await supabase.rpc('luna21_fulfill_stars_reading',{p_telegram_id:user,p_order_id:p.orderId,p_charge_id:charge,p_currency:currency,p_amount:amount});
 if(error||!data)throw new FoundationError(503,'order_unavailable','Payment confirmation is pending.');await reconcileReferralPurchase(supabase,user,env.LUNA34_REFERRALS_ENABLED);return data as {status:string;order:ReadingOrder};
}
