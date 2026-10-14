import {useEffect,useRef,useState} from 'react';
import {getReadingOffers,buyReading,getReadingOrder,type ReadingOffer,type AppLanguage} from '../../api';
import {luna21Flags} from '../../config/luna21Flags';
export function ReadingCheckout({kind,requestId,orderId,language,initData,onOrder,onReady}:{kind:ReadingOffer['kind'];requestId:string;orderId?:string;language:AppLanguage;initData?:string;onOrder:(id:string)=>void;onReady:(id:string)=>void}){
 const en=language==='en';const [offer,setOffer]=useState<ReadingOffer|null>(null),[currency,setCurrency]=useState<'SEEDS'|'XTR'>('XTR'),[terms,setTerms]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');const lock=useRef(false);
 useEffect(()=>{if(!luna21Flags.tarot_paid_readings)return;let active=true;void getReadingOffers(initData).then(r=>{if(active&&r.enabled)setOffer(r.offers.find(o=>o.kind===kind)??null);}).catch(()=>{if(active)setNotice(en?'This offer is unavailable.':'Предложение недоступно.');});return()=>{active=false;};},[kind,initData]);
 if(!luna21Flags.tarot_paid_readings||!offer)return null;
 async function confirm(){
  if(lock.current||!offer||!terms)return;lock.current=true;setBusy(true);setNotice('');
  try{
   const result=orderId?{order:await getReadingOrder(orderId,initData),invoiceUrl:null}:await buyReading({requestId,kind,currency,expectedAmount:currency==='XTR'?offer.stars:offer.seeds!,confirmed:true,termsAccepted:true},initData);
   onOrder(result.order.id);
   if(result.order.status==='entitled'){onReady(result.order.id);return;}
   if(result.invoiceUrl){const telegram=window.Telegram?.WebApp;if(!telegram?.openInvoice)throw new Error('Telegram required');await new Promise<void>(resolve=>{const timeout=window.setTimeout(resolve,30000);telegram.openInvoice!(result.invoiceUrl!,()=>{window.clearTimeout(timeout);resolve();});});}
   // The SDK callback is not a receipt. Trust only server-confirmed fulfillment.
   for(let i=0;i<8;i++){const order=await getReadingOrder(result.order.id,initData);if(order.status==='entitled'){onReady(order.id);return;}await new Promise(r=>window.setTimeout(r,1500));}
   setNotice(en?'Confirmation is pending. Reopen this saved order; do not pay again.':'Подтверждение ожидается. Открой сохранённый заказ; не оплачивай повторно.');
  }catch{setNotice(en?'Could not confirm. Your order is kept; do not pay again.':'Не удалось подтвердить. Заказ сохранён; не оплачивай повторно.');}finally{lock.current=false;setBusy(false);}
 }
 return <section className="luna21-checkout" aria-busy={busy}><h3>{en?'Your reading':'Твой расклад'}</h3><p>{offer.cards} {en?'cards · Luna AI interpretation included':'карт · интерпретация Luna AI включена'}</p><p>{en?'One reading. A failed AI response keeps your paid access. Moon Seeds are internal points, not money or cryptocurrency.':'Один расклад. При ошибке AI оплаченное право сохранится. Moon Seeds — внутренние баллы, не деньги и не криптовалюта.'}</p>
  {!orderId&&<div role="group" aria-label={en?'Payment method':'Способ оплаты'}>{offer.seeds!==null&&<button type="button" aria-pressed={currency==='SEEDS'} onClick={()=>setCurrency('SEEDS')}>{offer.seeds} Moon Seeds</button>}<button type="button" aria-pressed={currency==='XTR'} onClick={()=>setCurrency('XTR')}>{offer.stars} Telegram Stars</button></div>}
  <label><input type="checkbox" checked={terms} disabled={busy} onChange={e=>setTerms(e.target.checked)}/>{en?'I confirm this one-off reading and accept the terms.':'Подтверждаю разовую покупку расклада и принимаю условия.'}</label><details className="tarot-privacy"><summary>{en?'Terms & privacy':'Условия и приватность'}</summary><p>{en?'The displayed method and price apply only to this reading. There is no recurring subscription or conversion to cash. Symbolic reflection is not a prediction or professional advice. AI uses OpenAI; only consented profile context is shared. For payment issues: Profile → Support, or /paysupport in the Luna bot.':'Указанные способ и цена относятся только к этому раскладу. Подписки и обмена на деньги нет. Символическая рефлексия — не предсказание и не профессиональная консультация. AI использует OpenAI; контекст профиля — только с согласия. По вопросам оплаты: Профиль → Поддержка или /paysupport в боте Luna.'}</p></details>
  <button type="button" className="tarot-draw-button" disabled={!terms||busy} onClick={()=>void confirm()}>{orderId?(en?'Check saved order':'Проверить сохранённый заказ'):en?`Confirm · ${currency==='XTR'?offer.stars+' Stars':offer.seeds+' Moon Seeds'}`:`Подтвердить · ${currency==='XTR'?offer.stars+' Stars':offer.seeds+' Moon Seeds'}`}</button>{notice&&<p role="status">{notice}</p>}
 </section>;
}
