import {useEffect,useSyncExternalStore} from 'react';
import {getPublishedEditorial} from './api';
import type {EditorialEntry,EditorialKind} from '../../backend/src/luna42-editorial-contract';
let entries:EditorialEntry[]=[];
const observers=new Set<()=>void>();
const subscribe=(f:()=>void)=>{observers.add(f);return()=>{observers.delete(f);};};
export const publishedEditorial=()=>entries;
export const useEditorialEntries=()=>useSyncExternalStore(subscribe,publishedEditorial,publishedEditorial);
export function useEditorial(kind:EditorialKind,key:string){return useEditorialEntries().find(e=>e.kind===kind&&e.key===key)?.body;}
export function useEditorialLoader(initData?:string){
 useEffect(()=>{let active=true,inFlight=false;const refresh=()=>{if(inFlight||document.visibilityState==='hidden'||!initData)return;inFlight=true;void getPublishedEditorial(initData).then(result=>{if(active){entries=result.entries;observers.forEach(f=>f());}}).catch(()=>{/* Last verified or bundled content stays usable. */}).finally(()=>{inFlight=false;});};
  entries=[];observers.forEach(f=>f());refresh();const visible=()=>refresh();window.addEventListener('luna-editorial-published',refresh);document.addEventListener('visibilitychange',visible);return()=>{active=false;window.removeEventListener('luna-editorial-published',refresh);document.removeEventListener('visibilitychange',visible);};
 },[initData]);
}
