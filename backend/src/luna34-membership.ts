import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {luna34CommercialCatalog,resolveMembership} from './luna34-commercial-catalog.js';
export async function readLuna34Membership(db:SupabaseClient,owner:number,checkoutEnabled=false){
 const allocation=await db.rpc('luna34_claim_due_allocations',{p_owner:owner});if(allocation.error&&allocation.error.code!=='PGRST202')throw new FoundationError(503,'membership_unavailable','Paid allocation verification is temporarily unavailable.');
 const [user,balance,settings,periods,ledger,receipts,newReceipts]=await Promise.all([
  db.from('users').select('lifetime_access,active_until').eq('telegram_id',owner).maybeSingle(),
  db.from('moon_gardens').select('moon_seeds_available,moon_seeds_earned_total').eq('telegram_id',owner).maybeSingle(),
  db.from('luna34_commercial_settings').select('checkout_enabled,quotas_enabled,live_payment_verified,owner_approved').eq('id',true).maybeSingle(),
  db.from('luna30_entitlement_periods').select('period_start,period_end,source_charge_id').eq('telegram_id',owner).is('revoked_at',null).lte('period_start',new Date().toISOString()).gt('period_end',new Date().toISOString()).order('period_start',{ascending:false}).limit(1).maybeSingle(),
  db.from('luna_seed_ledger').select('id,kind,delta,balance_after,created_at').eq('telegram_id',owner).order('created_at',{ascending:false}).limit(30),
  db.from('payments').select('id,plan,amount_stars,currency,status,created_at').eq('telegram_id',owner).eq('status','paid').order('created_at',{ascending:false}).limit(20),
  db.from('luna30_commercial_receipts').select('charge_id,order_id,stars,state,subscription_expires_at,cancelled_at,created_at').eq('telegram_id',owner).order('created_at',{ascending:false}).limit(30)
 ]);
 if(user.error||!user.data||balance.error||periods.error||receipts.error)throw new FoundationError(503,'membership_unavailable','Your subscription and balance remain unchanged.');
 if(settings.error&&settings.error.code!=='PGRST205'&&settings.error.code!=='42P01')throw new FoundationError(503,'membership_unavailable','Membership settings could not be verified.');
 const active=periods.data,days=active?Math.round((Date.parse(active.period_end)-Date.parse(active.period_start))/86400000):0;
 const membership=resolveMembership({lifetime:user.data.lifetime_access,legacyUntil:user.data.active_until,period:active&&[30,365].includes(days)?{start:active.period_start,end:active.period_end,days:days as 30|365}:null});
 return {catalog:luna34CommercialCatalog,membership,commercialEnabled:checkoutEnabled&&settings.data?.checkout_enabled===true&&settings.data.live_payment_verified===true&&settings.data.owner_approved===true,quotasEnabled:settings.data?.quotas_enabled===true,
  balance:balance.data?.moon_seeds_available??0,earned:balance.data?.moon_seeds_earned_total??0,
  transactions:ledger.error?null:ledger.data??[],purchases:receipts.data??[],newPurchases:newReceipts.error?null:newReceipts.data??[],notice:'New commercial conditions are prepared but not activated. Existing paid rights and balances are preserved.'};
}
