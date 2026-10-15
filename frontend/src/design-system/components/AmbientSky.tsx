import {useEffect} from 'react';

/** One shared visibility signal, zero animation-frame JavaScript loops. */
export function AmbientSky(){
 useEffect(()=>{
  const update=()=>{document.documentElement.dataset.appActive=document.visibilityState==='hidden'?'false':'true';};
  update();document.addEventListener('visibilitychange',update);
  return()=>{document.removeEventListener('visibilitychange',update);delete document.documentElement.dataset.appActive;};
 },[]);
 return <div className="premium-ambient" aria-hidden="true"><span/><span/><span/><span/><span/><span/><span/><span/></div>;
}
