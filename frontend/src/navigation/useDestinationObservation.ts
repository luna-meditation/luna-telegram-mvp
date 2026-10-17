import {useEffect} from 'react';
import {acknowledgeLunaNavigation} from '../api';
import {resolveLunaDestination} from '../../../backend/src/luna41-navigation';
import {featureFlags} from '../config/featureFlags';

/** Observe the committed route, not the click or an LLM promise. Telemetry only:
 * this never grants playback, wallet rewards, chart consent or payment access. */
export function useDestinationObservation(initData?:string){
 useEffect(()=>{
  let pending:{messageId:string;referenceId:string;destination:string;expires:number}|null=null,frame=0;
  const seen=new Set<string>();
  const inspect=()=>{
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{
    if(!pending)return;
    if(Date.now()>pending.expires){pending=null;return;}
    const destination=resolveLunaDestination(pending.destination,featureFlags);
    const shell=document.querySelector<HTMLElement>('.app-shell');
    if(!destination||shell?.dataset.page!==destination.page||shell.querySelector('[data-page-loading="true"]'))return;
    if(destination.page==='profile'&&shell.dataset.profileView!==('profileView' in destination?destination.profileView:'main'))return;
    const observation=pending;pending=null;
    const key=observation.messageId+':'+observation.referenceId;
    if(seen.has(key))return;seen.add(key);
    const {expires:_expires,...value}=observation;void _expires;
    void acknowledgeLunaNavigation({...value,event:'screen_opened'},initData).catch(()=>{
     // Do not announce success or retry a paid action for a telemetry failure.
    });
   });
  };
  const open=(event:Event)=>{
   const detail=(event as CustomEvent).detail;
   if(!initData||!detail||!resolveLunaDestination(detail.destination,featureFlags)||
    ![detail.messageId,detail.operationId].every(value=>typeof value==='string'&&/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value)))return;
   pending={messageId:detail.messageId,referenceId:detail.operationId,destination:detail.destination,expires:Date.now()+15000};inspect();
  };
  const observer=new MutationObserver(inspect);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-page','data-profile-view']});
  window.addEventListener('luna-open-destination',open,true);
  return()=>{window.removeEventListener('luna-open-destination',open,true);observer.disconnect();cancelAnimationFrame(frame);};
 },[initData]);
}
