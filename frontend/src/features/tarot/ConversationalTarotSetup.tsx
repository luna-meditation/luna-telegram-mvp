import {X} from 'lucide-react';
import type {AppLanguage} from '../../api';
import {tarotCopy} from './copy';
import {TarotCardBack} from './TarotCard';

export type TarotSetupStep='kind'|'intention'|'question';
type Kind='single'|'three'|'five';
type Intention='general'|'love'|'career'|'growth';
export function ConversationalTarotSetup({language,step,onStep,kind,onKind,intention,onIntention,question,onQuestion,spreadsEnabled,pending,onSubmit,onClose}:{
 language:AppLanguage;step:TarotSetupStep;onStep:(step:TarotSetupStep)=>void;
 kind:Kind;onKind:(kind:Kind)=>void;intention:Intention;onIntention:(intention:Intention)=>void;
 question:string;onQuestion:(question:string)=>void;spreadsEnabled:boolean;pending:boolean;onSubmit:()=>void;onClose:()=>void;
}){
 const en=language==='en';
 const kinds={single:en?'One card':'Одна карта',three:en?'Three cards':'Три карты',five:en?'Five cards':'Пять карт'};
 const change=(next:TarotSetupStep)=>{if(!pending)onStep(next);};
 return <section className="luna30-tarot-dialogue" aria-label={en?'Set up a Tarot reading':'Настройка расклада Таро'} aria-busy={pending}>
  <header><span>✧ {en?'A moment with the cards':'Встреча с картами'}</span><button type="button" onClick={onClose} disabled={pending} aria-label={en?'Close Tarot setup':'Закрыть настройку расклада'}><X size={18}/></button></header>
  <p className="luna30-dialogue-prompt">{en?'How many cards would you like to explore?':'Сколько карт хочешь рассмотреть?'}</p>
  {step==='kind'?<div className="luna30-quick-replies">{(['single','three','five'] as const).map(k=><button type="button" key={k} disabled={pending||(k!=='single'&&!spreadsEnabled)} onClick={()=>{onKind(k);change('intention');}}>{kinds[k]}</button>)}</div>:<button type="button" className="luna30-dialogue-answer" disabled={pending} onClick={()=>change('kind')}>{kinds[kind]} <span>{en?'Change':'Изменить'}</span></button>}
  {step!=='kind'&&<><p className="luna30-dialogue-prompt">{en?'What would you like to reflect on?':'На какую тему посмотрим?'}</p>{step==='intention'?<div className="luna30-quick-replies">{(['love','career','growth','general'] as const).map(i=><button type="button" key={i} disabled={pending} onClick={()=>{onIntention(i);change('question');}}>{tarotCopy[language].intentions[i].title}</button>)}</div>:<button type="button" className="luna30-dialogue-answer" disabled={pending} onClick={()=>change('intention')}>{tarotCopy[language].intentions[intention].title}<span>{en?'Change':'Изменить'}</span></button>}</>}
  {step==='question'&&<form onSubmit={e=>{e.preventDefault();onSubmit();}}><label className="luna30-dialogue-prompt" htmlFor="luna30-tarot-question">{en?'Anything specific on your mind? A question is optional.':'Есть конкретный вопрос? Можно обойтись без него.'}</label><textarea id="luna30-tarot-question" value={question} maxLength={240} rows={2} disabled={pending} onChange={e=>onQuestion(e.target.value)} placeholder={en?'Your question…':'Твой вопрос…'}/>{pending?<div className="luna24-shuffling" role="status" aria-label={en?'Shuffling the deck':'Перемешиваем колоду'}>{[0,1,2].map(i=><span key={i}><TarotCardBack/></span>)}</div>:null}<button className="luna-button-primary" type="submit" disabled={pending}>{pending?(en?'Preparing…':'Готовим…'):question.trim()?(en?'Explore my question':'Рассмотреть мой вопрос'):(en?'Continue without a question':'Продолжить без вопроса')}</button></form>}
 </section>;
}
