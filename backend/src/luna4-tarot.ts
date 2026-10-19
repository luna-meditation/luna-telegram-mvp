import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {z} from 'zod';
const priceSchema=z.object({version:z.literal('luna-4.0-completion-v1'),revision:z.number().int().nonnegative(),enabled:z.boolean(),daily:z.number().int().positive(),single:z.number().int().positive(),three:z.number().int().positive(),five:z.number().int().positive()}).strict();
const dailyQuoteSchema=z.object({seeds:z.number().int().min(0).max(10000),confirmationRequired:z.boolean(),source:z.enum(['existing_free','preserved_daily','preserved_legacy','public_beta','new_daily','owned','recovered','saved']),orderId:z.string().uuid().optional(),orderStatus:z.enum(['entitled','consumed','refunded']).optional(),paidSeeds:z.number().int().positive().optional()}).strict();
export type DailyQuote=z.infer<typeof dailyQuoteSchema>;
const unavailable=()=>new FoundationError(503,'reading_price_unavailable','Your saved cards and balance are preserved. Reopen this offer.');
/** Missing new schema is safe only for a verified older ACTIVE catalog. A
 * half-deployed new economy must never fall back to old free access/prices. */
async function requireLegacyCatalog(db:SupabaseClient){const r=await db.from('luna34_commercial_settings').select('catalog').eq('id',true).single();if(r.error||!['luna-3.4','luna-4.3'].includes(r.data?.catalog?.version))throw unavailable();}
export async function readTarotPrices(db:SupabaseClient){const r=await db.rpc('luna4_tarot_prices');if(r.error?.code==='PGRST202'){await requireLegacyCatalog(db);return null;}if(!r.error&&r.data===null)return null;const parsed=priceSchema.safeParse(r.data);if(r.error||!parsed.success)throw unavailable();return parsed.data;}
export async function readDailyQuote(db:SupabaseClient,owner:number):Promise<DailyQuote>{const r=await db.rpc('luna4_daily_quote',{p_owner:owner});if(r.error?.code==='PGRST202'){await requireLegacyCatalog(db);return{seeds:0,confirmationRequired:false,source:'existing_free'};}const parsed=dailyQuoteSchema.safeParse(r.data);if(r.error||!parsed.success)throw unavailable();return parsed.data;}
export async function buyContractReading(db:SupabaseClient,args:Record<string,unknown>){const r=await db.rpc('luna4_buy_seed_reading',args);if(r.error?.code!=='PGRST202')return r;await requireLegacyCatalog(db);return db.rpc('luna21_buy_seed_reading',args);}
export async function reserveDailyCard(db:SupabaseClient,args:Record<string,unknown>){const r=await db.rpc('luna4_reserve_daily_card',args);if(r.error?.code!=='PGRST202')return r;await requireLegacyCatalog(db);const{p_confirmed,p_expected_seeds,...old}=args;void p_confirmed;void p_expected_seeds;return db.rpc('reserve_luna_daily_card',old);}
export async function finishDailyAccess(db:SupabaseClient,owner:number,client:string,success:boolean){const r=await db.rpc('luna4_finish_daily_access',{p_owner:owner,p_client:client,p_success:success});if(r.error||!r.data)throw new FoundationError(503,'daily_payment_pending','Your card and purchase are saved. Reopen the same card, without paying again.');return r.data as{status:string;seeds?:number;replay?:boolean};}
export async function cancelDailyDelivery(db:SupabaseClient,owner:number,id:string){const r=await db.rpc('luna4_cancel_daily_delivery',{p_owner:owner,p_reading:id});if(r.error?.code==='PGRST202'){await requireLegacyCatalog(db);return;}if(r.error)throw new FoundationError(503,'daily_payment_pending','The saved card is preserved until any pending purchase is recovered.');}
/** Same draw engine, with a finite-contract access adapter. Only a genuinely
 * older schema can fall back; grants/network/validation errors fail closed. */
export async function reserveContractTarot(db:SupabaseClient,args:Record<string,unknown>,quotasEnabled=true){
 const value=await db.rpc('luna4_reserve_tarot_spread',args);
 if(value.error?.code==='PGRST202'){await requireLegacyCatalog(db);return db.rpc('reserve_luna_tarot_spread',args);}
 if(!value.error&&value.data?.acquired&&!args.p_order_id&&!quotasEnabled){
  const status=await db.rpc('luna4_allowance_status',{p_owner:args.p_telegram_id,p_bucket:args.p_kind,p_exclude:null});
  if(status.error||status.data?.enabled&&status.data.contractVersion==='luna-4.0-completion-v1')throw new FoundationError(503,'allowance_configuration_required','Your cards are saved. Included readings require the verified allowance guard.');
 }
 return value;
}
