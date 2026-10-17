import {useEffect,useRef,useState} from 'react';
import {Sparkles,X} from 'lucide-react';
import {acknowledgeMilestones,type AppLanguage,type ProfileStats} from '../../api';
import {nextMilestone,type MilestoneSnapshot} from './milestone';
import {luna34Achievements} from '../../../../backend/src/luna34-achievements';
type Notice={text:string;art?:string;ids:string[]};
export function ProgressMilestone({owner,profile,language,allowed=true,initData}:{owner:number;profile:ProfileStats|null;language:AppLanguage;allowed?:boolean;initData?:string}){
 const [notice,setNotice]=useState<Notice|null>(null),queue=useRef<Notice[]>([]),seen=useRef(new Set<string>()),scope=useRef(owner);
 useEffect(()=>{
  if(scope.current!==owner){scope.current=owner;queue.current=[];seen.current.clear();setNotice(null);}
  if(!profile?.journeyV3||!profile.achievements)return;
  const key=`luna.milestones.v1.${owner}`,current={rank:profile.journeyV3.rank,earned:profile.achievements.items.filter(a=>a.unlocked).map(a=>a.id)};
  try{const raw=localStorage.getItem(key),saved=raw?JSON.parse(raw):null,previous:MilestoneSnapshot|null=saved&&Number.isInteger(saved.rank)&&Array.isArray(saved.earned)&&saved.earned.every((id:unknown)=>typeof id==='string')?saved:null;
   const milestone=nextMilestone(previous,current);localStorage.setItem(key,JSON.stringify(current));
   if(milestone?.kind==='status')queue.current.push({text:language==='en'?`New status: ${profile.journeyV3.current?.names.en}`:`Новый статус: ${profile.journeyV3.current?.names.ru}`,art:profile.journeyV3.current?`/images/statuses/luna34/${profile.journeyV3.current.id}.webp`:undefined,ids:[]});
   if(profile.achievements.version===34){
    const pending=profile.achievements.items.filter(a=>a.unlocked&&a.celebrationPending&&!seen.current.has(a.id));
    for(const a of pending)seen.current.add(a.id);
    if(pending.length){const first=luna34Achievements.find(a=>a.id===pending[0].id);queue.current.push({text:pending.length===1?(first?.title[language]??(language==='en'?'A new discovery':'Новое открытие')):(language==='en'?`${pending.length} new discoveries on your journey`:`Новые открытия на вашем пути: ${pending.length}`),art:first?.art,ids:pending.map(a=>a.id)});}
   }else if(milestone?.kind==='achievement')queue.current.push({text:language==='en'?'A new milestone in your journey':'Новое достижение на вашем пути',ids:[]});
  }catch{/* Storage restrictions never block account access or progress. */}
 },[owner,profile,language]);
 useEffect(()=>{
  if(!allowed||notice)return;const show=()=>{if(document.querySelector('dialog[open],[role="dialog"]')||!queue.current.length)return;const next=queue.current.shift()!;setNotice(next);if(next.ids.length)void acknowledgeMilestones(next.ids,initData).catch(()=>undefined);};
  show();const timer=window.setInterval(show,700);return()=>window.clearInterval(timer);
 },[allowed,notice,owner,profile,initData]);
 useEffect(()=>{if(!notice||!allowed)return;const timer=window.setTimeout(()=>setNotice(null),6500);return()=>window.clearTimeout(timer);},[notice,allowed]);
 return allowed&&notice?<div className="luna31-milestone" role="status">{notice.art?<img src={notice.art.replace('.webp','-small.webp')} width="45" height="45" alt=""/>:<Sparkles size={22}/>}<p>{notice.text}</p><button type="button" onClick={()=>setNotice(null)} aria-label={language==='en'?'Dismiss milestone':'Закрыть достижение'}><X size={18}/></button></div>:null;
}
