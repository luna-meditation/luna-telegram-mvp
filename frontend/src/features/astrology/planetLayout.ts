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
