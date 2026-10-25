/** Separate display labels only. Astronomy/aspect anchors always use true longitude. */
export function planetLabelAngles(planets:Array<{id:string;longitude:number}>){
 const chosen:number[]=[],result:Record<string,number>={};
 const normal=(n:number)=>(n%360+360)%360;
 const distance=(a:number,b:number)=>Math.abs((a-b+540)%360-180);
 for(const planet of planets){
  let angle=normal(planet.longitude);
  for(let step=0;step<46;step++){
   const offset=step===0?0:Math.ceil(step/2)*8*(step%2?1:-1),candidate=normal(planet.longitude+offset);
   if(chosen.every(other=>distance(candidate,other)>=15)){angle=candidate;break;}
  }
  chosen.push(angle);result[planet.id]=angle;
 }
 return result;
}

/** Touch labels occupy distinct 30 degree slots. Only label positions move;
 * the diagram's anchor dots and aspect lines always use calculated longitude. */
export function planetTouchAngles(planets:Array<{id:string;longitude:number}>){
 const slots=Array.from({length:12},(_,i)=>i*30+15),result:Record<string,number>={};
 const distance=(a:number,b:number)=>Math.abs((a-b+540)%360-180);
 for(const planet of [...planets].sort((a,b)=>a.longitude-b.longitude||a.id.localeCompare(b.id))){
  const index=slots.reduce((best,angle,i)=>distance(angle,planet.longitude)<distance(slots[best],planet.longitude)?i:best,0);
  result[planet.id]=slots.splice(index,1)[0];
 }
 return result;
}
