type Page={count:number|null;data:Array<{created_at:string}>|null;error:unknown};
/** Only timestamps, never private content. A 120-day sample is sufficient for
 * every rank threshold; full moment counts come from PostgreSQL's exact count.
 * Very large, single-day abusive histories fail closed to the legacy view. */
export async function loadLuna30ActivityMetadata(fetchPage:(from:number,to:number)=>PromiseLike<Page>,dateKey:(iso:string)=>string|null){
 const dates=new Set<string>();let count:number|null=null,offset=0;
 while(offset<10000){
  const page=await fetchPage(offset,Math.min(9999,offset+999));if(page.error||page.count===null||!page.data)return null;
  count=page.count;if(page.data.length===0)return offset>=count?{count,dates:[...dates]}:null;
  for(const row of page.data){const key=dateKey(row.created_at);if(key)dates.add(key);}offset+=page.data.length;
  if(offset>=count||dates.size>=120)return{count,dates:[...dates]};
 }
 return null;
}
