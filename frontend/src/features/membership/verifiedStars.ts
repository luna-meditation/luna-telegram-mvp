import {createCommercialOrder,getCommercialOrder,isValidTelegramInvoiceUrl} from '../../api';
export type StarsOffer={product:string;stars:number;title:string;requestId?:string};
/** Never grants rights on invoiceClosed. No automatic payment retry. */
export async function verifiedStarsPurchase(offer:StarsOffer,requestId:string,initData?:string){
 const telegram=window.Telegram?.WebApp;
 if(!telegram?.openInvoice)throw new Error('telegram_required');
 const result=await createCommercialOrder({requestId,product:offer.product,expectedStars:offer.stars,confirmed:true,termsAccepted:true},initData);
 if(result.order.state==='paid')return {status:'paid' as const,orderId:result.order.id};
 if(!result.invoiceUrl||!isValidTelegramInvoiceUrl(result.invoiceUrl))throw new Error('invalid_invoice');
 const callback=await new Promise<string>(resolve=>{let done=false;const finish=(state:string)=>{if(done)return;done=true;window.clearTimeout(timeout);resolve(state);};const timeout=window.setTimeout(()=>finish('pending'),90000);try{telegram.openInvoice!(result.invoiceUrl!,state=>finish(state));}catch{finish('failed');}});
 // Delayed webhook? Reopen/refresh this same server order, never buy again.
 const verified=await getCommercialOrder(result.order.id,initData);
 return {status:verified.order.state==='paid'?'paid' as const:callback==='cancelled'?'cancelled' as const:callback==='failed'?'failed' as const:'pending' as const,orderId:result.order.id};
}
