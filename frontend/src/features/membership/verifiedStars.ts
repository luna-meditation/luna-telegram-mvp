import {createCommercialOrder,getCommercialOrder,isValidTelegramInvoiceUrl,type MembershipOverview} from '../../api';
import type {StarsTerms} from '../../../../backend/src/luna4-order-consent';
import {productPlan} from './PremiumBenefits';
export type StarsOffer={product:string;stars:number;title:string;requestId?:string;expectedTerms?:StarsTerms};
/** Presentation of the actual server catalog, not a client-created invoice. */
export function reviewedStarsOffer(offer:StarsOffer,catalog:MembershipOverview['catalog']):StarsOffer{
 const c=catalog.newEconomy;if(!c)return offer;const plan=productPlan(offer.product),pack=c.packages.find(p=>p.id===offer.product);
 if(!plan&&!pack&&offer.product!=='support')throw Error('product_unavailable');
 return {...offer,expectedTerms:{product:offer.product,stars:offer.stars,seeds:pack?.seeds??0,days:plan==='weekly'?7:plan==='monthly'?30:plan==='annual'?365:0,recurring:false,plan,allowances:plan?c.premiumAllowances[plan]:null,allowanceScope:plan==='weekly'?'subscription_week':plan?'subscription_month':null}};
}
/** Never grants rights on invoiceClosed. No automatic payment retry. */
export async function verifiedStarsPurchase(offer:StarsOffer,requestId:string,initData?:string){
 const telegram=window.Telegram?.WebApp;
 if(!telegram?.openInvoice)throw new Error('telegram_required');
 const result=await createCommercialOrder({requestId,product:offer.product,expectedStars:offer.stars,confirmed:true,termsAccepted:true,...(offer.expectedTerms?{expectedTerms:offer.expectedTerms}:{})},initData);
 if(result.order.state==='paid')return {status:'paid' as const,orderId:result.order.id};
 if(result.requiresConfirmation&&result.terms)return{status:'terms_changed' as const,orderId:result.order.id,terms:result.terms};
 if(!result.invoiceUrl||!isValidTelegramInvoiceUrl(result.invoiceUrl))throw new Error('invalid_invoice');
 const callback=await new Promise<string>(resolve=>{let done=false;const finish=(state:string)=>{if(done)return;done=true;window.clearTimeout(timeout);resolve(state);};const timeout=window.setTimeout(()=>finish('pending'),90000);try{telegram.openInvoice!(result.invoiceUrl!,state=>finish(state));}catch{finish('failed');}});
 // Delayed webhook? Reopen/refresh this same server order, never buy again.
 const verified=await getCommercialOrder(result.order.id,initData);
 return {status:verified.order.state==='paid'?'paid' as const:callback==='cancelled'?'cancelled' as const:callback==='failed'?'failed' as const:'pending' as const,orderId:result.order.id};
}
