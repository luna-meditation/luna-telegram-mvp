import { ArrowUpRight, BookOpen, Flame, Flower2, Sparkles, Wind } from 'lucide-react';
import type { AppLanguage } from '../api';
import { CelestialArt } from './ExplorePage';
import { luna2Copy } from './copy';
import { tarotCopy } from '../features/tarot/copy';

export function HomeLunaGuide({language,onTalk,onPersonalize}:{language:AppLanguage;onTalk:()=>void;onPersonalize?:()=>void}){
 const en=language==='en';
 return <section className="luna2-home-guide" aria-label={en?'Your personal Luna guide':'Твоя персональная Luna'}>
  <div><Sparkles size={25}/><span>{en?'A little magic. A lot of clarity.':'Немного магии. Больше понимания.'}</span></div>
  <h2>{en?'Understand yourself. Find your way.':'Пойми себя. Найди свой путь.'}</h2>
  <button type="button" className="luna2-talk-primary" onClick={onTalk}>{en?'Talk to Luna':'Поговорить с Luna'}<ArrowUpRight size={19}/></button>
  {onPersonalize&&<button type="button" className="luna2-personalize-entry" onClick={onPersonalize}>{en?'Make Luna yours · optional':'Настроить Luna под себя · необязательно'}</button>}
 </section>;
}

export function HomeDiscovery({ language, tarotEnabled, onTarot, onMeditate, onBreathe }: {
  language: AppLanguage; tarotEnabled: boolean; onTarot: () => void; onMeditate: () => void; onBreathe: () => void;
}) {
  const t = luna2Copy[language];
  return <>
    <button type="button" disabled={!tarotEnabled} onClick={onTarot} className="luna2-daily-card" aria-disabled={!tarotEnabled} data-feature-flag="tarot_daily" data-feature-enabled={tarotEnabled} aria-label={tarotEnabled ? tarotCopy[language].homeTitle : t.dailyTarotNote}>
      <CelestialArt kind="tarot" /><div><span className="luna2-eyebrow">{tarotEnabled ? tarotCopy[language].homeTitle : t.dailyTarot}</span><h2>{tarotEnabled ? tarotCopy[language].homeBody : t.dailyTarotBody}</h2><p>{tarotEnabled ? tarotCopy[language].noCharge : t.dailyTarotNote}</p></div><span className="luna2-soon">{tarotEnabled ? tarotCopy[language].free : t.soon}</span>
    </button>
    <section className="luna2-quick-actions" aria-label={t.quickActions}>
      <button type="button" onClick={onTarot}><Sparkles size={21} /><span>{t.tarot}</span>{!tarotEnabled && <small>{t.soon}</small>}</button>
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
