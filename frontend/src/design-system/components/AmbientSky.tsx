import {useEffect,useState} from 'react';
import '../../components/cosmic-atmosphere.css';

/** One shell-level sky. No frame loop, canvas, network or page-owned instances. */
export function AmbientSky(){
 const [paused,setPaused]=useState(()=>document.visibilityState==='hidden');
 const [lowPower]=useState(()=>{
  const device=navigator as Navigator&{deviceMemory?:number;connection?:{saveData?:boolean}};
  return Boolean(device.connection?.saveData||(device.hardwareConcurrency>0&&device.hardwareConcurrency<=2)||(device.deviceMemory!==undefined&&device.deviceMemory<=2));
 });
 useEffect(()=>{const visibility=()=>{const hidden=document.visibilityState==='hidden';setPaused(hidden);document.documentElement.dataset.appActive=hidden?'false':'true';};visibility();document.addEventListener('visibilitychange',visibility);return()=>{document.removeEventListener('visibilitychange',visibility);delete document.documentElement.dataset.appActive;};},[]);
 const count=lowPower?12:24;
 return <div className="cosmic-atmosphere" data-testid="cosmic-atmosphere" data-paused={paused} data-mode={lowPower?'low':'full'} aria-hidden="true">
  {[0,1,2].map(depth=><svg key={depth} className={'cosmic-depth depth-'+depth} viewBox="0 0 400 900" preserveAspectRatio="xMidYMid slice">
   {Array.from({length:count},(_,index)=>{
    const n=index+depth*24,x=(n*137.508+31)%400,y=(n*n*19.173+n*71+83)%900;
    return <circle key={index} cx={x} cy={y} r={index%7===0?1.05:.45+depth*.13} opacity={index%4===0?.82:.33}/>;
   })}
  </svg>)}
 </div>;
}
