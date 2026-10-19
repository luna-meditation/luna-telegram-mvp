import{useEffect,useRef,useState}from'react';
import{ApiRequestError,interpretLunaTarot,readLunaTarotMessage,type LunaMessage}from'../../api';
import{createInterpretationRequestGuard,deferredInterpretationPlan}from'./deferredInterpretation';
import{recordTarotTiming}from'./performance';
const reserveInterpretationRequest=createInterpretationRequestGuard();
export function useDeferredInterpretation(message:LunaMessage,initData:string|undefined,onUpdate:(value:LunaMessage)=>void){
 const [busy,setBusy]=useState(false),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0),update=useRef(onUpdate),started=useRef('');update.current=onUpdate;
 const state=message.metadata?.tarot,plan=deferredInterpretationPlan(state),complete=Boolean(state&&state.revealed>=(state.kind==='single'?1:state.kind==='three'?3:5));
 useEffect(()=>{
  if(plan==='none')return;
  let live=true,timer:number|undefined,remaining=40;setBusy(true);setFailed(false);
  const accept=(value:LunaMessage)=>{if(live)update.current(value);return value.metadata?.tarot?.reading?.status;};
  const stop=(error=false)=>{if(live){setBusy(false);setFailed(error);}};
  async function observe(){
   if(!live)return;if(remaining--<=0){stop(true);return;}
   try{const value=await readLunaTarotMessage(message.id,initData),status=accept(value.message);if(status==='ready'||status==='fallback'||status==='safety'||status==='local'&&value.message.metadata?.tarot?.interpretationFinished){stop();return;}}
   catch(error){if(error instanceof ApiRequestError&&[401,403,404].includes(error.status??0)){stop(true);return;}}
   if(live)timer=window.setTimeout(()=>void observe(),1500);
  }
  void(async()=>{
   if(plan==='start'&&started.current!==message.id&&reserveInterpretationRequest(message.id,initData)){
    started.current=message.id;
    const startedAt=performance.now();try{const value=await interpretLunaTarot(message.id,initData),status=accept(value.message);recordTarotTiming('interpretation_request',startedAt,state!.kind==='single'?1:state!.kind==='three'?3:5);if(status==='ready'||status==='fallback'||status==='safety'||status==='local'){stop();return;}}
    catch(error){if(error instanceof ApiRequestError&&[401,403,404,409,422].includes(error.status??0)){stop(true);return;}/* A lost response is not permission to repeat a paid request. */}
   }
   await observe();
  })();
  return()=>{live=false;if(timer!==undefined)clearTimeout(timer);};
  // Reading status updates are handled by this one task, not a second effect.
  // IDs, final-reveal evidence and explicit reconnect are its stable lifecycle.
 },[message.id,complete,state?.interpretationRequested,initData,retry]);
 return{busy,failed,reconnect:()=>setRetry(value=>value+1)};
}
