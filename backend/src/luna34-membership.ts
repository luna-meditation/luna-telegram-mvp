import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {luna34CommercialCatalog,resolveMembership} from './luna34-commercial-catalog.js';
import {isDeepStrictEqual} from 'node:util';
import {luna43CommercialCatalog} from './luna43-commerce-policy.js';
import {parseCurrentCommercialCatalog} from './luna4-commercial-catalog.js';
import {readContractBenefits} from './luna4-contract-benefits.js';
import {luna4EconomyVersion} from './luna4-economy-policy.js';
import {reconcileReferralPurchase}from'./luna4-referrals.js';
export async function readLuna34Membership(db:SupabaseClient,owner:number,checkoutEnabled=false){
 const allocation=await db.rpc('luna34_claim_due_allocations',{p_owner:owner});if(allocation.error&&allocation.error.code!=='PGRST202')throw new FoundationError(503,'membership_unavailable','Paid allocation verification is temporarily unavailable.');
 await reconcileReferralPurchase(db,owner,process.env.LUNA34_REFERRALS_ENABLED);
 const [user,balance,settings,periods,ledger,receipts,newReceipts]=await Promise.all([
  db.from('users').select('lifetime_access,active_until').eq('telegram_id',owner).maybeSingle(),
  db.from('moon_gardens').select('moon_seeds_available,moon_seeds_earned_total').eq('telegram_id',owner).maybeSingle(),
  db.from('luna34_commercial_settings').select('catalog,checkout_enabled,quotas_enabled,live_payment_verified,owner_approved,catalog_revision').eq('id',true).maybeSingle(),
  db.from('luna30_entitlement_periods').select('period_start,period_end,source_charge_id').eq('telegram_id',owner).is('revoked_at',null).lte('period_start',new Date().toISOString()).gt('period_end',new Date().toISOString()).order('period_start',{ascending:false}).limit(1).maybeSingle(),
  db.from('luna_seed_ledger').select('id,kind,delta,balance_after,created_at').eq('telegram_id',owner).order('created_at',{ascending:false}).limit(30),
  db.from('payments').select('id,plan,amount_stars,currency,status,created_at').eq('telegram_id',owner).eq('status','paid').order('created_at',{ascending:false}).limit(20),
  db.from('luna30_commercial_receipts').select('charge_id,order_id,stars,state,subscription_expires_at,cancelled_at,created_at').eq('telegram_id',owner).order('created_at',{ascending:false}).limit(30)
 ]);
 if(user.error||!user.data||balance.error||periods.error||receipts.error)throw new FoundationError(503,'membership_unavailable','Your subscription and balance remain unchanged.');
 if(settings.error&&settings.error.code!=='PGRST205'&&settings.error.code!=='42P01')throw new FoundationError(503,'membership_unavailable','Membership settings could not be verified.');
 const oldCatalog=isDeepStrictEqual(settings.data?.catalog,luna34CommercialCatalog);let catalog:ReturnType<typeof parseCurrentCommercialCatalog>=luna43CommercialCatalog;
 if(!oldCatalog)try{catalog=parseCurrentCommercialCatalog(settings.data?.catalog);}catch{throw new FoundationError(503,'catalog_review_required','The product catalog needs verification. Your current rights are unchanged.');}
 const active=periods.data,days=active?Math.round((Date.parse(active.period_end)-Date.parse(active.period_start))/86400000):0;
 let membership=resolveMembership({lifetime:user.data.lifetime_access||active?.period_end==='infinity',legacyUntil:user.data.active_until,period:active&&[7,30,365].includes(days)?{start:active.period_start,end:active.period_end,days:days as 7|30|365}:null});
 const contract=await readContractBenefits(db,owner,catalog.version===luna4EconomyVersion);
 if(contract?.paid&&!contract.preserveLegacy&&contract.window&&contract.allowances){membership={kind:contract.kind,paid:true,until:contract.until??null,preserveLegacy:false,ordinaryLimit:contract.allowances.standard,resetAt:contract.window.end,window:{start:contract.window.start,end:contract.window.end,index:contract.window.index}};}
 else if(contract?.paid&&contract.preserveLegacy)membership={...membership,paid:true,preserveLegacy:true};
 const administrative=process.env.FEATURE_ADMIN_V4_MUTATIONS==='true'?await (await import('./luna40-grants.js')).readAdminGrants(db,owner):null;
 const commercialEnabled=!oldCatalog&&checkoutEnabled&&settings.data?.checkout_enabled===true&&settings.data.live_payment_verified===true&&settings.data.owner_approved===true;
 return {catalog,catalogRevision:settings.data?.catalog_revision??0,membership,includedBenefits:contract?.paid&&!contract.preserveLegacy?contract.allowances:undefined,administrative,commercialEnabled,quotasEnabled:settings.data?.quotas_enabled===true,
  balance:balance.data?.moon_seeds_available??0,earned:balance.data?.moon_seeds_earned_total??0,
  transactions:ledger.error?null:ledger.data??[],purchases:receipts.data??[],newPurchases:newReceipts.error?null:newReceipts.data??[],notice:commercialEnabled?'Purchases are enabled at the displayed prices. Existing paid rights and balances are preserved.':'Purchases are not activated. Existing paid rights and balances are preserved.'};
}
