import { ArrowUpRight, BookOpen, Flame, Flower2, Sparkles, Wind,Orbit } from 'lucide-react';
import type { AppLanguage } from '../api';
import { CelestialArt } from './ExplorePage';
import { luna2Copy } from './copy';
import { tarotCopy } from '../features/tarot/copy';
import {luna21Flags} from '../config/luna21Flags';

export function HomeLunaGuide({language,onTalk,onPersonalize}:{language:AppLanguage;onTalk:()=>void;onPersonalize?:()=>void}){
 const en=language==='en';
 return <section className="luna2-home-guide" aria-label={en?'Your personal Luna guide':'Твоя персональная Luna'}>
  <div><Sparkles size={22}/><span>Luna AI</span></div>
  <h2>{en?'A space to find your clarity.':'Пространство для твоей ясности.'}</h2>
  <button type="button" className="luna2-talk-primary" onClick={onTalk}><span className="luna2-talk-label">{en?'Talk to Luna':'Поговорить с Luna'}</span><ArrowUpRight size={19}/></button>
  {onPersonalize&&<button type="button" className="luna2-personalize-entry" onClick={onPersonalize}>{en?'Personalize your guide':'Настроить своего проводника'}</button>}
 </section>;
}

export function HomeDiscovery({ language, tarotEnabled, onTarot, onMeditate, onBreathe,onAstrology,onDaily }: {
  language: AppLanguage; tarotEnabled: boolean; onTarot: () => void; onMeditate: () => void; onBreathe: () => void;onAstrology?:()=>void;onDaily?:()=>void;
}) {
  const t = luna2Copy[language];
  return <>
    <button type="button" disabled={!tarotEnabled} onClick={luna21Flags.daily_card_v2?onDaily??onTarot:onTarot} className="luna2-daily-card" aria-disabled={!tarotEnabled} data-feature-flag="tarot_daily" data-feature-enabled={tarotEnabled} aria-label={luna21Flags.daily_card_v2?(language==='en'?'Card of the day':'Карта дня'):tarotEnabled ? tarotCopy[language].homeTitle : t.dailyTarotNote}>
      <CelestialArt kind="tarot" /><div><span className="luna2-eyebrow">{luna21Flags.daily_card_v2?(language==='en'?'Card of the day':'Карта дня'):tarotEnabled ? tarotCopy[language].homeTitle : t.dailyTarot}</span><h2>{luna21Flags.daily_card_v2?(language==='en'?'A new perspective for today.':'Новый взгляд на сегодняшний день.'):tarotEnabled ? tarotCopy[language].homeBody : t.dailyTarotBody}</h2><p>{luna21Flags.daily_card_v2?(language==='en'?'Open your free card':'Открыть бесплатную карту'):tarotEnabled ? tarotCopy[language].homeTitle : t.dailyTarotNote}</p></div><span className="luna2-soon">{tarotEnabled ? tarotCopy[language].free : t.soon}</span>
    </button>
    <section className="luna2-quick-actions luna21-home-categories" aria-label={t.quickActions}>
      <button type="button" onClick={onTarot}><Sparkles size={21} /><span>{t.tarot}</span>{!tarotEnabled && <small>{t.soon}</small>}</button>
      <button type="button" onClick={onAstrology} disabled={!onAstrology}><Orbit size={21}/><span>{language==='en'?'Astrology':'Астрология'}</span><small>{t.soon}</small></button>
      <button type="button" onClick={onMeditate}><BookOpen size={21} /><span>{t.meditate}</span></button>
      <button type="button" onClick={onBreathe}><Wind size={21} /><span>{t.breathe}</span></button>
    </section>
  </>;
}

export function HomeProgress({ language, streak, checkins, gardenLevel, onJourney, onGarden }: {
  language: AppLanguage; streak: string; checkins: string; gardenLevel?: number; onJourney: () => void; onGarden: () => void;
}) {
  const t = luna2Copy[language];
  return <section className="luna2-home-progress">
    <button type="button" onClick={onJourney}><Flame size={21} /><span><strong>{t.progress}</strong><small>{streak} {t.days} · {checkins} {language === 'ru' ? 'отметок' : 'check-ins'}</small></span><ArrowUpRight size={18} /></button>
    <button type="button" onClick={onGarden}><Flower2 size={21} /><span><strong>{t.garden}</strong><small>{gardenLevel === undefined ? t.gardenBody : `${t.gardenLevel} ${gardenLevel}`}</small></span><ArrowUpRight size={18} /></button>
  </section>;
}
