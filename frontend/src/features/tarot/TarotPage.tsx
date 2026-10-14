import {useCallback,useEffect,useRef,useState,type Dispatch,type CSSProperties} from 'react';
import {Compass,Heart,Briefcase,Leaf,Sparkles,Scan,RotateCcw,ArrowRight} from 'lucide-react';
import type {AppLanguage} from '../../api';
import {SectionBack} from '../../luna2/ExplorePage';
import {tarotDeck} from './deck';
import {prepareCardChoices,randomIndex} from './draw';
import {TarotCard,TarotCardBack} from './TarotCard';
import {TarotDetails} from './TarotDetails';
import {tarotCopy} from './copy';
import {tarotIntentions,type TarotSession,type TarotAction} from './session';
import {buildTarotInterpretation} from './interpretation';
import {featureFlags} from '../../config/featureFlags';
import {TarotHistory,TarotReadingTools} from './TarotReadingTools';
import {TarotHub} from './TarotHub';
import {DailyTarot} from './DailyTarot';
import {luna21Flags} from '../../config/luna21Flags';
import {TarotSpread} from './TarotSpread';
import './tarot.css';

const intentionIcons={general:Compass,love:Heart,career:Briefcase,growth:Leaf};
export default function TarotPage({language,onBack,session,dispatch,registerBackHandler,initData,onContinue}:{language:AppLanguage;onBack:()=>void;session:TarotSession;dispatch:Dispatch<TarotAction>;registerBackHandler:(handler:(()=>void)|null)=>void;initData?:string;onContinue?:(id:string)=>void}){
 const t=tarotCopy[language];
 const [error,setError]=useState(false),[coverFailed,setCoverFailed]=useState(false),[coverAttempt,setCoverAttempt]=useState(0),[zoom,setZoom]=useState(false);
 const heading=useRef<HTMLHeadingElement>(null),selectionLocked=useRef(false),shuffleLocked=useRef(false);
 const previousStep=useRef({stage:session.stage,serial:session.serial});
 const card=session.result?tarotDeck.find(item=>item.id===session.result?.cardId):null;
 const revealed=session.stage==='interpretation',step=session.stage==='intention'?0:session.stage==='shuffling'||session.stage==='choose'?1:session.stage==='reveal'?2:3;
 const titles={intention:t.intentionTitle,shuffling:t.shufflingTitle,choose:t.chooseTitle,reveal:t.revealTitle,interpretation:t.reflectionTitle};
 const descriptions={intention:t.intentionBody,shuffling:t.shufflingBody,choose:t.chooseBody,reveal:t.revealBody,interpretation:t.reflectionBody};
 const closeZoom=useCallback(()=>setZoom(false),[]);
 useEffect(()=>{
  if(session.screen!=='single'||zoom)return;
  registerBackHandler(()=>dispatch({type:'screen',value:'hub'}));
  return ()=>registerBackHandler(null);
 },[session.screen,zoom,dispatch,registerBackHandler]);
 useEffect(()=>{
  selectionLocked.current=Boolean(session.result);shuffleLocked.current=session.stage!=='intention';
  if(previousStep.current.stage!==session.stage||previousStep.current.serial!==session.serial){heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start',behavior:'instant'});}
  previousStep.current={stage:session.stage,serial:session.serial};
 },[session.stage,session.serial,session.result]);
 useEffect(()=>{
  if(session.stage!=='shuffling')return;
  const duration=window.matchMedia('(prefers-reduced-motion: reduce)').matches?120:1400;
  const timer=window.setTimeout(()=>dispatch({type:'ready'}),Math.max(0,duration-(Date.now()-session.shuffledAt)));
  return ()=>window.clearTimeout(timer);
 },[session.stage,session.shuffledAt,dispatch]);
 function shuffle(){
  if(shuffleLocked.current||session.stage!=='intention'||coverFailed)return;
  try{const choices=prepareCardChoices(tarotDeck).map(item=>item.id);shuffleLocked.current=true;setError(false);(document.activeElement as HTMLElement|null)?.blur();dispatch({type:'shuffle',choices,at:Date.now(),...(featureFlags.tarot_history?{clientReadingId:crypto.randomUUID(),language}:{})});}catch{setError(true);}
 }
 function choose(slot:number){
  if(selectionLocked.current||session.stage!=='choose'||coverFailed)return;
  try{const orientation=randomIndex(2)===1?'reversed':'upright';selectionLocked.current=true;setError(false);dispatch({type:'choose',slot,orientation});}catch{setError(true);}
 }
 function reset(){setZoom(false);setError(false);selectionLocked.current=false;shuffleLocked.current=false;dispatch({type:'reset'});}
 const reading=card&&session.result?buildTarotInterpretation(card.meaning[language][session.result.orientation],session.intention,language):null;
 const coverProps={attempt:coverAttempt,onError:()=>setCoverFailed(true)};
 if(session.screen==='daily'&&luna21Flags.daily_card_v2)return <div className="luna2-page tarot-page"><DailyTarot language={language} initData={initData} session={session} dispatch={dispatch} registerBackHandler={registerBackHandler} onContinue={onContinue}/></div>;
 if((session.screen==='three'||session.screen==='five')&&(featureFlags.tarot_spreads||session.spreads?.[session.screen]?.reading))return <div className="luna2-page tarot-page"><TarotSpread kind={session.screen} language={language} initData={initData} session={session} dispatch={dispatch} registerBackHandler={registerBackHandler} onContinue={onContinue}/></div>;
 if((!session.screen&&session.stage==='intention')||session.screen==='hub')return <div className="luna2-page tarot-page"><SectionBack language={language} onBack={onBack}/><TarotHub language={language} onOpen={value=>dispatch({type:'screen',value})}/>{featureFlags.tarot_history&&<TarotHistory language={language} initData={initData} dispatch={dispatch}/>}</div>;
 return <div className="luna2-page tarot-page" data-testid="tarot-single-card" data-stage={session.stage} data-feature-flag="tarot_daily" data-feature-enabled="true">
  <SectionBack language={language} onBack={()=>dispatch({type:'screen',value:'hub'})}/>
  {featureFlags.tarot_history&&<TarotHistory language={language} initData={initData} dispatch={dispatch}/>}
  <header className="luna2-page-heading tarot-heading"><p>{t.eyebrow}<span>{t.step} {step+1} {t.of} 4</span></p><h1 ref={heading} tabIndex={-1}>{revealed&&card?card.name[language]:titles[session.stage]}</h1>{!revealed&&<span>{descriptions[session.stage]}</span>}</header>
  {!revealed&&<ol className="tarot-progress" aria-label={`${t.step} ${step+1} ${t.of} 4`}>{t.steps.map((label,index)=><li key={index} className={index<=step?'is-current':''} aria-current={index===step?'step':undefined}><span aria-hidden="true"/><span>{label}</span></li>)}</ol>}
  {session.stage==='intention'&&<section className="tarot-intention" aria-label={t.intentionTitle}>
   <div className="tarot-intention-intro"><div><TarotCardBack {...coverProps}/></div><p>{t.body}<span>{t.deck}</span></p></div>
   <div className="tarot-intention-grid" role="group" aria-label={t.intentionTitle}>{tarotIntentions.map(value=>{const Icon=intentionIcons[value];return <button type="button" key={value} data-intention={value} aria-pressed={session.intention===value} onClick={()=>dispatch({type:'intention',value})}><Icon size={22}/><strong>{t.intentions[value].title}</strong><span>{t.intentions[value].description}</span></button>;})}</div>
   <div className="tarot-question"><label htmlFor="tarot-question">{t.question}<span>{t.optional}</span></label><textarea id="tarot-question" rows={2} maxLength={240} value={session.question} onChange={event=>dispatch({type:'question',value:event.target.value})} placeholder={t.questionPlaceholder} aria-describedby="tarot-question-privacy"/><p id="tarot-question-privacy">{featureFlags.tarot_history?(language==='en'?'After reveal, this reading and question are saved privately. You can delete them in history. AI receives them only when you choose Reflect with Luna AI.':'После открытия расклад и вопрос сохраняются приватно. Их можно удалить в истории. AI получит их только по кнопке «Осмыслить с Luna AI».'):t.questionPrivacy}</p></div>
   <button type="button" className="tarot-draw-button" onClick={shuffle} disabled={coverFailed}><Sparkles size={20}/>{t.shuffle}<ArrowRight size={18}/></button>
  </section>}
  {session.stage==='shuffling'&&<section className="tarot-shuffling" aria-busy="true" aria-label={t.shuffling}><div className="tarot-shuffle-stack" aria-hidden="true">{[0,1,2,3,4].map(index=><div key={index} style={{'--card-index':index} as CSSProperties}><TarotCardBack {...coverProps}/></div>)}</div><p role="status" aria-live="polite">{t.shuffling}</p></section>}
  {session.stage==='choose'&&<section className="tarot-selection" aria-label={t.ready}><div className="tarot-choice-grid">{session.choices.map((_,slot)=><button type="button" key={slot} data-slot={slot} aria-label={`${t.chooseCard} ${slot+1}`} disabled={coverFailed} onClick={()=>choose(slot)}><TarotCardBack {...coverProps}/><span aria-hidden="true">{slot+1}</span></button>)}</div><button type="button" className="tarot-text-button" onClick={reset}><RotateCcw size={17}/>{t.changeIntention}</button></section>}
  {card&&session.result&&<section className="tarot-reading" aria-label={t.selected}>
   <p className="tarot-intention-caption">{t.intentions[session.intention].title}</p>
   <TarotCard key={session.serial} card={card} orientation={session.result.orientation} revealed={revealed} language={language} onFlip={()=>revealed?setZoom(true):dispatch({type:'reveal'})}/>
   {revealed&&reading&&<>
    <button type="button" className="tarot-text-button tarot-details-button" onClick={()=>setZoom(true)}><Scan size={19}/>{t.details}</button>
    <article className="tarot-meaning" aria-label={card.name[language]}><div className="tarot-card-meta"><span>{card.suit?t.suits[card.suit]:t.major}</span><span className="tarot-orientation-pill" data-testid="tarot-orientation">{session.result.orientation==='reversed'&&<RotateCcw size={14} aria-hidden="true"/>}{t[session.result.orientation]}</span></div><h2>{card.name[language]}</h2>{session.savedReading?.status!=='ready'&&session.savedReading?.status!=='safety'&&<><h3>{t.meaning}</h3><p>{card.meaning[language][session.result.orientation]}</p></>}
     {session.question&&<div className="tarot-question-summary"><h3>{t.yourQuestion}</h3><p>{session.question}</p></div>}
     {featureFlags.tarot_history&&<TarotReadingTools session={session} language={language} initData={initData} dispatch={dispatch} onContinue={onContinue}/>}
     {session.savedReading?.status!=='ready'&&session.savedReading?.status!=='safety'&&<><div className="tarot-context"><h3>{t.context}</h3><p>{reading.text}</p></div><div className="tarot-reflection"><Sparkles size={21} aria-hidden="true"/><div><h3>{t.reflection}</h3><p>{reading.reflection}</p></div></div></>}
    </article><button type="button" className="tarot-draw-button" onClick={reset}><RotateCcw size={19}/>{t.again}</button>
   </>}
  </section>}
  {coverFailed&&<div className="tarot-error" role="alert"><p>{t.imageError}</p><button type="button" className="tarot-text-button" onClick={()=>{setCoverFailed(false);setCoverAttempt(value=>value+1);}}>{t.retry}</button></div>}
  {error&&<p className="tarot-error" role="alert">{t.drawError}</p>}
  <footer className="tarot-footnote"><p>{t.disclaimer}</p></footer>
  {zoom&&card&&session.result&&<TarotDetails card={card} orientation={session.result.orientation} language={language} onClose={closeZoom} registerBackHandler={registerBackHandler}/>}
 </div>;
}
