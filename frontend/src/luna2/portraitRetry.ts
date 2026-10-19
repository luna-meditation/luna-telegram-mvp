/** Network/unknown outcomes retain their operation ID. Only an explicit source
 * invalidation permits a new user-triggered operation, never automatic replay. */
export function portraitOperationAfterFailure(operationId:string,error:{status?:number|null;responseBody?:string|null},newId:()=>string=()=>crypto.randomUUID()){
 if(error.status!==409||!error.responseBody)return operationId;
 try{if(JSON.parse(error.responseBody).code==='portrait_source_changed')return newId();}catch{/* Keep the same identity for an unrecognized response. */}
 return operationId;
}
