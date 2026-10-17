import {recordProgressEvidence,type TarotReading} from '../../api';
const seen=new Set<string>(),pending=new Map<string,Promise<boolean>>();
async function send(kind:string,entityId:string,detail:string,initData?:string,secondChartId?:string){
 const key=[initData??'',kind,entityId,detail,secondChartId??''].join('|');if(seen.has(key))return true;if(pending.has(key))return pending.get(key)!;
 const promise=recordProgressEvidence({kind,entityId,detail,...(secondChartId?{secondChartId}:{})},initData).then(r=>{if(r.recorded){seen.add(key);if(seen.size>500)seen.delete(seen.values().next().value!);}return r.recorded;}).catch(()=>false).finally(()=>pending.delete(key));pending.set(key,promise);return promise;
}
/** Best-effort evidence never blocks a real activity, payment or private history.
 * Server validates identity, ownership, exact entity and allowed detail again. */
export function noteProgress(kind:string,entityId:string|undefined,detail='',initData?:string,secondChartId?:string){
 if(!entityId)return;
 void send(kind,entityId,detail,initData,secondChartId);
}
export function noteCompletedReading(reading:TarotReading,initData?:string){
 const cards=reading.cards?.length?reading.cards.map(c=>c.cardId):[reading.card_id];
 void(async()=>{for(const cardId of cards)if(!await send('reading_reveal',reading.id,cardId,initData))return;await send('reading_reveal',reading.id,'complete',initData);})().catch(()=>undefined);
}
