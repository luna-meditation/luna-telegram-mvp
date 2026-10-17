import {useEffect,useState} from 'react';
import {Flame,Flower2,Trophy,ArrowUpRight} from 'lucide-react';
import type {AppLanguage,ProfileStats} from '../../api';
import {JourneyStatusHero,StatusProgressionSheet,type ProgressAchievement} from '../progress/ProgressExperience';
export function CompactJourney({profile,language,achievements,onGarden,onAchievements,registerBackHandler}:{profile:ProfileStats|null;language:AppLanguage;achievements:ProgressAchievement[];onGarden:()=>void;onAchievements:()=>void;registerBackHandler?:(handler:(()=>void)|null)=>void}){
 const [statuses,setStatuses]=useState(false),en=language==='en';
 useEffect(()=>{if(!statuses)return;registerBackHandler?.(()=>setStatuses(false));return()=>registerBackHandler?.(null);},[statuses,registerBackHandler]);
 const latest=achievements.filter(item=>item.unlocked).sort((a,b)=>String(b.unlockedAt??'').localeCompare(String(a.unlockedAt??''))).slice(0,3);
 return <section className="compact-journey" data-testid="compact-journey">
  <JourneyStatusHero profile={profile} language={language} onOpen={()=>setStatuses(true)}/>
  <div className="compact-streak"><Flame size={25}/><strong>{profile?.currentStreak??'—'}</strong><span>{en?'consecutive days':'дней подряд'}</span></div>
  <section className="compact-achievements"><h2>{en?'Recent achievements':'Последние достижения'}</h2>{latest.length?<div>{latest.map(item=><button key={item.id} onClick={onAchievements} aria-label={item.title}>{item.art?<img src={item.art.replace('.webp','-small.webp')} width="64" height="64" alt="" loading="lazy"/>:<Trophy size={24}/>}<strong>{item.title}</strong></button>)}</div>:<p>{en?'Your next small practice can be your first milestone.':'Следующая небольшая практика может стать первым шагом.'}</p>}</section>
  <button className="compact-journey-link" onClick={onAchievements}><Trophy/>{en?'All achievements':'Все достижения'}<ArrowUpRight/></button>
  <button className="compact-journey-link" onClick={onGarden}><Flower2/>{en?'Open Moon Garden':'Открыть Лунный сад'}<ArrowUpRight/></button>
  {statuses&&<StatusProgressionSheet profile={profile} language={language} onClose={()=>setStatuses(false)}/>}
 </section>;
}
