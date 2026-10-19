import {z} from 'zod';
import {chatTarotState,nextReveal,readingSize,type ChatTarotState} from './luna24-policy.js';
export type RevealMetrics={authorizationMs:number;persistenceMs:number;readingMs:number;progressMs:number;renderMs:number;interpretationMs:number;totalMs:number;cards:number;deferred:boolean};
type Message={metadata:Record<string,unknown>};
export async function runTarotReveal<M extends Message,R>(body:unknown,deps:{load:()=>Promise<M>;persist:(message:M,prior:ChatTarotState,next:ChatTarotState)=>Promise<M>;reading:(state:ChatTarotState)=>Promise<{card_id:string;cards?:Array<{cardId:string}>}>;progress:(state:ChatTarotState,cardId:string|undefined,complete:boolean)=>Promise<void>;render:(message:M)=>Promise<R>;interpret:()=>Promise<R>;measure?:(value:RevealMetrics)=>void}){
 const {index,deferInterpretation}=z.object({index:z.number().int().min(0).max(4),deferInterpretation:z.boolean().default(false)}).strict().parse(body);
 const start=performance.now();let at=start;const metrics:RevealMetrics={authorizationMs:0,persistenceMs:0,readingMs:0,progressMs:0,renderMs:0,interpretationMs:0,totalMs:0,cards:0,deferred:deferInterpretation};
 let message=await deps.load();metrics.authorizationMs=performance.now()-at;const prior=chatTarotState.parse(message.metadata.tarot);let next=nextReveal(prior,index);
 if(deferInterpretation&&next.revealed===readingSize(next.kind))next={...next,interpretationRequested:true};
 at=performance.now();if(next.revealed>prior.revealed||next.interpretationRequested&&!prior.interpretationRequested)message=await deps.persist(message,prior,next);metrics.persistenceMs=performance.now()-at;
 const state=chatTarotState.parse(message.metadata.tarot),complete=state.revealed===readingSize(state.kind);metrics.cards=readingSize(state.kind);
 at=performance.now();const reading=await deps.reading(state);metrics.readingMs=performance.now()-at;
 at=performance.now();await deps.progress(state,state.kind==='single'?reading.card_id:reading.cards?.[index]?.cardId,complete);metrics.progressMs=performance.now()-at;
 let result:R;if(complete&&!deferInterpretation){at=performance.now();result=await deps.interpret();metrics.interpretationMs=performance.now()-at;}else{at=performance.now();result=await deps.render(message);metrics.renderMs=performance.now()-at;}
 metrics.totalMs=performance.now()-start;deps.measure?.(metrics);return result;
}
