import {ArrowRight,Layers,Sparkles} from 'lucide-react';
import type {AppLanguage} from '../../api';
import type {TarotSession} from './session';
import {TarotCardBack} from './TarotCard';
import {luna21Flags} from '../../config/luna21Flags';
import {featureFlags} from '../../config/featureFlags';

export function TarotHub({language,onOpen}:{language:AppLanguage;onOpen:(screen:NonNullable<TarotSession['screen']>)=>void}){
 const en=language==='en';
 return <section className="tarot-hub" data-testid="tarot-hub">
  <header><p className="luna2-eyebrow">LUNA TAROT</p><h1>{en?'A little perspective.':'Новый взгляд на себя.'}</h1><p>{en?'Pause, notice what matters, and choose your next step.':'Остановись, услышь себя и выбери следующий шаг.'}</p></header>
  {luna21Flags.daily_card_v2&&<button type="button" className="tarot-hub-daily" onClick={()=>onOpen('daily')}><span className="tarot-hub-cover"><TarotCardBack/></span><span><small>{en?'YOUR DAILY RITUAL':'ТВОЙ ЕЖЕДНЕВНЫЙ РИТУАЛ'}</small><strong>{en?'Card of the day':'Карта дня'}</strong><span>{en?'One card. A personal reflection.':'Одна карта. Личная интерпретация.'}</span><b>{en?'Open free card':'Открыть бесплатную карту'} <ArrowRight size={16}/></b></span></button>}
  <button type="button" className="tarot-hub-reading" onClick={()=>onOpen('single')}><Sparkles size={25}/><span><strong>{en?'One-card reflection':'Расклад на одну карту'}</strong><small>{en?'Bring a question or follow your curiosity.':'Задай вопрос или доверься любопытству.'}</small></span><ArrowRight size={19}/></button>
  <div className="tarot-hub-spreads">{(['three','five'] as const).map((screen,index)=><button type="button" key={screen} disabled={!featureFlags.tarot_spreads} onClick={()=>onOpen(screen)}><Layers size={25}/><strong>{en?`${index?5:3}-card reading`:index?'Расклад на 5 карт':'Расклад на 3 карты'}</strong><span>{en?(index?'A deeper, connected reflection.':'Situation, attention, direction.'):(index?'Глубже рассмотреть общую картину.':'Ситуация, внимание, направление.')}</span>{!featureFlags.tarot_spreads&&<small>{en?'Coming soon':'Скоро'}</small>}</button>)}</div>
  <p className="tarot-hub-note">{en?'A mirror for reflection, not a prediction.':'Зеркало для размышлений, не предсказание.'}</p>
 </section>;
}
