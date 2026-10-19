/** Only a persisted final-reveal request authorizes initial interpretation.
 * Opening a historic local/failed/ready reading is never a generation trigger. */
export function deferredInterpretationPlan(state:{revealed:number;kind:'single'|'three'|'five';interpretationRequested?:boolean;interpretationAttempted?:boolean;interpretationFinished?:boolean;reading:{status:string}|null}|undefined){
 if(!state?.reading||!state.interpretationRequested||state.revealed<(state.kind==='single'?1:state.kind==='three'?3:5))return 'none';
 return state.reading.status==='processing'||state.reading.status==='local'&&state.interpretationAttempted&&!state.interpretationFinished?'observe':state.reading.status==='local'&&!state.interpretationAttempted?'start':'none';
}

/** Document-session guard survives component/tab remounts, not app restarts.
 * Lost responses are observed through GET, never repeated as paid POSTs.
 * The backend remains the authoritative durable idempotency boundary. */
export function createInterpretationRequestGuard(limit=40){
 let identity:string|undefined;const requested=new Set<string>();
 return(messageId:string,session:string|undefined)=>{
  if(identity!==session){requested.clear();identity=session;}
  if(requested.has(messageId))return false;
  requested.add(messageId);if(requested.size>limit)requested.delete(requested.values().next().value!);
  return true;
 };
}
