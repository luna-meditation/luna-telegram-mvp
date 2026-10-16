import {useEffect,useState} from 'react';
import {Sparkles,X} from 'lucide-react';
import type {AppLanguage,ProfileStats} from '../../api';
import {nextMilestone,type MilestoneSnapshot} from './milestone';
export function ProgressMilestone({owner,profile,language}:{owner:number;profile:ProfileStats|null;language:AppLanguage}){
 const [notice,setNotice]=useState('');
 useEffect(()=>{
  if(!profile?.journeyV3||!profile.achievements)return;
  const key=`luna.milestones.v1.${owner}`,current={rank:profile.journeyV3.rank,earned:profile.achievements.items.filter(a=>a.unlocked).map(a=>a.id)};
  try{const raw=localStorage.getItem(key),saved=raw?JSON.parse(raw):null,previous:MilestoneSnapshot|null=saved&&Number.isInteger(saved.rank)&&Array.isArray(saved.earned)&&saved.earned.every((id:unknown)=>typeof id==='string')?saved:null;
   const milestone=nextMilestone(previous,current);localStorage.setItem(key,JSON.stringify(current));
   if(milestone)setNotice(milestone.kind==='status'?(language==='en'?`New status: ${profile.journeyV3.current?.names.en}`:`Новый статус: ${profile.journeyV3.current?.names.ru}`):(language==='en'?'A new milestone in your journey':'Новое достижение на вашем пути'));
  }catch{/* Storage restrictions must never interrupt progress or account access. */}
 },[owner,profile,language]);
 useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(''),6500);return()=>window.clearTimeout(timer);},[notice]);
 return notice?<div className="luna31-milestone" role="status"><Sparkles size={22}/><p>{notice}</p><button type="button" onClick={()=>setNotice('')} aria-label={language==='en'?'Dismiss milestone':'Закрыть достижение'}><X size={18}/></button></div>:null;
}
