import {ArrowUpRight, Flame, Flower2, Sparkles} from 'lucide-react';
import {getDailyTarotStatus,type AppLanguage} from '../api';
import {useEffect,useState} from 'react';
import {CelestialArt} from './ExplorePage';
import {OptimizedImage} from '../design-system/components/OptimizedImage';
import {luna2Copy} from './copy';
import {luna21Flags} from '../config/luna21Flags';
import {featureFlags} from '../config/featureFlags';
import homeArt from '../v2/home-art-32.json';

export function HomeLunaGuide({language,onTalk}:{language:AppLanguage;onTalk:()=>void;onPersonalize?:()=>void}){
 return <div className="luna25-hero-action"><button type="button" className="luna2-talk-primary" onClick={onTalk}><Sparkles size={17}/><span>{language==='en'?'Talk to Luna':'Поговорить с Luna'}</span><ArrowUpRight size={16}/></button></div>;
}

export function HomeDiscovery({language,tarotEnabled,onTarot,onMeditate,onBreathe,onAstrology,onDaily,initData}:{language:AppLanguage;tarotEnabled:boolean;onTarot:()=>void;onMeditate:()=>void;onBreathe:()=>void;onAstrology?:()=>void;onDaily?:()=>void;initData?:string}){
 const t=luna2Copy[language],en=language==='en';
 const [dailyState,setDailyState]=useState<'new'|'saved'|'removed'>('new');
 useEffect(()=>{if(!initData||!luna21Flags.daily_card_v2)return;let active=true;getDailyTarotStatus(initData).then(r=>{if(active)setDailyState(r.state);}).catch(()=>{});return()=>{active=false;};},[initData]);
 const categories=[
  {id:'tarot',label:t.tarot,description:en?'Explore your question':'Исследовать свой вопрос',onOpen:onTarot},
  {id:'astrology',label:t.astrology,description:en?'Your celestial portrait':'Твой небесный портрет',onOpen:onAstrology},
  {id:'meditations',label:t.meditations,description:en?'Return to yourself':'Вернуться к себе',onOpen:onMeditate},
  {id:'breathwork',label:t.breathwork,description:en?'Find your rhythm':'Найти свой ритм',onOpen:onBreathe}
 ] as const;
 return <>
  <button type="button" disabled={!tarotEnabled||dailyState==='removed'} onClick={luna21Flags.daily_card_v2?onDaily??onTarot:onTarot} className="luna2-daily-card luna25-daily-card" aria-disabled={!tarotEnabled} data-feature-flag="tarot_daily" data-feature-enabled={tarotEnabled} aria-label={en?'Card of the day':'Карта дня'}>
   <CelestialArt kind="tarot" sizes="88px"/><div><h2>{en?'Card of the day':'Карта дня'}</h2><p>{dailyState==='saved'?(en?'View your saved card':'Посмотреть сохранённую карту'):dailyState==='removed'?(en?'A new card arrives at 00:00 UTC':'Новая карта — в 00:00 UTC'):(en?'Free · one saved card each day':'Бесплатно · одна сохранённая карта в день')}</p></div><ArrowUpRight size={18}/>
  </button>
  <section className="luna25-home-categories" aria-label={t.quickActions}>{categories.map(c=><button type="button" key={c.id} data-category={c.id} className={`luna25-category is-${c.id}`} onClick={c.onOpen} disabled={!c.onOpen}>
   <div className="luna25-category-art" aria-hidden="true"><OptimizedImage src={homeArt[c.id].variants[0].src} asset={homeArt[c.id]} alt="" sizes="(max-width: 600px) calc((100vw - 44px) / 2), 260px"/></div>
   {c.id==='astrology'&&!featureFlags.astrology&&<small className="luna25-soon">{t.soon}</small>}<span className="luna25-category-copy"><strong>{c.label}</strong><span>{c.description}</span></span><ArrowUpRight size={16}/>
  </button>)}</section>
 </>;
}

export function HomeProgress({language,streak,checkins,gardenLevel,onJourney,onGarden}:{language:AppLanguage;streak:string;checkins:string;gardenLevel?:number;onJourney:()=>void;onGarden:()=>void}){
 const t=luna2Copy[language];
 return <section className="luna2-home-progress"><button type="button" onClick={onJourney}><Flame size={21}/><span><strong>{t.progress}</strong><small>{streak} {t.days} · {checkins} {language==='ru'?'отметок':'check-ins'}</small></span><ArrowUpRight size={18}/></button><button type="button" onClick={onGarden}><Flower2 size={21}/><span><strong>{t.garden}</strong><small>{gardenLevel===undefined?t.gardenBody:`${t.gardenLevel} ${gardenLevel}`}</small></span><ArrowUpRight size={18}/></button></section>;
}
