import {useEffect,useRef,useState,type Dispatch} from 'react';
import {RotateCcw,Sparkles} from 'lucide-react';
import {SectionBack} from '../../luna2/ExplorePage';
import {featureFlags} from '../../config/featureFlags';
import {saveTarotSpread,type AppLanguage} from '../../api';
import {tarotDeck} from './deck';
import {TarotCard,TarotCardBack} from './TarotCard';
import {TarotDetails} from './TarotDetails';
import {TarotAiInterpretation} from './TarotAiInterpretation';
import {tarotCopy} from './copy';
import {prepareCardChoices,randomIndex} from './draw';
import {createSpreadSession,type SpreadAction,type SpreadKind} from './spreadSession';
import type {TarotSession,TarotAction} from './session';
import {tarotPositions as positions} from './positions';
export function TarotSpread({kind,language,initData,session,dispatch,onContinue,registerBackHandler}:{kind:SpreadKind;language:AppLanguage;initData?:string;session:TarotSession;dispatch:Dispatch<TarotAction>;onContinue?:(id:string)=>void;registerBackHandler:(handler:(()=>void)|null)=>void}){
 const state=session.spreads?.[kind]??createSpreadSession(kind),size=kind==='three'?3:5,en=language==='en',t=tarotCopy[language];
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[zoom,setZoom]=useState<number|null>(null);const pending=useRef(false),choiceLock=useRef(new Set<number>()),alive=useRef(true);
 const send=(action:SpreadAction)=>dispatch({type:'spread',kind,action});
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(state.stage!=='shuffling')return;const timer=window.setTimeout(()=>send({type:'ready'}),matchMedia('(prefers-reduced-motion: reduce)').matches?120:1100);return()=>clearTimeout(timer);},[state.stage]);
 useEffect(()=>{choiceLock.current=new Set(state.selected.map(c=>c.slot));},[state.selected]);
 useEffect(()=>{if(zoom===null)registerBackHandler(()=>dispatch({type:'screen',value:'hub'}));return()=>{if(zoom===null)registerBackHandler(null);};},[zoom,dispatch,registerBackHandler]);
 async function save(generate:boolean){
  if(pending.current||!state.clientReadingId||state.selected.length!==size)return;pending.current=true;setBusy(true);setError('');
  try{const result=await saveTarotSpread({clientReadingId:state.clientReadingId,kind,cards:state.selected.map(({cardId,orientation})=>({cardId,orientation})),intention:state.intention,question:state.question,language:state.language??language,generate},initData);send({type:'saved',reading:result.reading});if(alive.current&&result.reason)setError(result.reason==='access_required'?(en?'Extended readings are not available yet. Your cards are saved.':'Расширенные расклады пока недоступны. Карты сохранены.'):(en?'Luna needs a little time. Your reading is saved.':'Luna нужно немного времени. Расклад сохранён.'));}
  catch{if(alive.current)setError(en?'Could not connect. Your cards remain here.':'Не удалось подключиться. Твои карты остались здесь.');}finally{pending.current=false;if(alive.current)setBusy(false);}
 }
 useEffect(()=>{if(state.stage==='interpretation'&&!state.reading)void save(false);},[state.stage,state.clientReadingId]);
 function choose(slot:number){if(choiceLock.current.has(slot)||choiceLock.current.size>=size)return;choiceLock.current.add(slot);send({type:'choose',slot,orientation:randomIndex(2)?'reversed':'upright'});}
 const zoomed=zoom===null?null:state.selected[zoom],zoomCard=zoomed?tarotDeck.find(c=>c.id===zoomed.cardId):null;
 return <section className="tarot-spread" data-testid={`tarot-spread-${kind}`} data-stage={state.stage}>
  <SectionBack language={language} onBack={()=>dispatch({type:'screen',value:'hub'})}/>
  <header><p className="luna2-eyebrow">LUNA TAROT · {size}</p><h1>{state.stage==='intention'?en?'What is on your mind?':'Что тебя волнует?':state.stage==='choose'?en?`Choose ${size} cards`:`Выбери ${size} ${size===5?'карт':'карты'}`:en?'Your reflection':'Твой расклад'}</h1></header>
  {state.stage==='intention'&&<><div className="tarot-intention-grid">{(['general','love','career','growth'] as const).map(value=><button type="button" key={value} aria-pressed={state.intention===value} onClick={()=>send({type:'intention',value})}><strong>{t.intentions[value].title}</strong><span>{t.intentions[value].description}</span></button>)}</div><div className="tarot-question"><label htmlFor="tarot-spread-question">{t.question}<span>{t.optional}</span></label><textarea id="tarot-spread-question" rows={2} maxLength={240} value={state.question} onChange={e=>send({type:'question',value:e.target.value})} placeholder={t.questionPlaceholder}/></div><button className="tarot-draw-button" onClick={()=>{(document.activeElement as HTMLElement)?.blur();send({type:'shuffle',choices:prepareCardChoices(tarotDeck).map(c=>c.id),clientReadingId:crypto.randomUUID(),language});}}><Sparkles size={19}/>{t.shuffle}</button></>}
  {state.stage==='shuffling'&&<div className="tarot-daily-back is-shuffling" aria-busy="true"><TarotCardBack/></div>}
  {state.stage==='choose'&&<><div className="tarot-choice-grid">{state.choices.map((_,slot)=><button type="button" key={slot} disabled={state.selected.some(c=>c.slot===slot)} aria-pressed={state.selected.some(c=>c.slot===slot)} aria-label={`${t.chooseCard} ${slot+1}`} onClick={()=>choose(slot)}><TarotCardBack/><span>{state.selected.findIndex(c=>c.slot===slot)>=0?`✓ ${state.selected.findIndex(c=>c.slot===slot)+1}`:slot+1}</span></button>)}</div><p className="tarot-hub-note" role="status">{state.selected.length} / {size}</p></>}
  {['reveal','interpretation'].includes(state.stage)&&<><div className={`tarot-spread-cards is-${kind}`}>{state.selected.map((selection,index)=>{const card=tarotDeck.find(c=>c.id===selection.cardId)!;return <article key={`${state.clientReadingId}:${card.id}`}><small>{positions[language][kind][index]}</small><TarotCard card={card} orientation={selection.orientation} language={language} revealed={index<state.revealed} enabled={index<=state.revealed} onFlip={()=>index<state.revealed?setZoom(index):send({type:'reveal',index})}/>{index<state.revealed&&<><strong>{card.name[language]}</strong><span className="tarot-orientation-pill">{selection.orientation==='reversed'&&<RotateCcw size={13}/>} {t[selection.orientation]}</span></>}</article>;})}</div>
   {state.stage==='interpretation'&&<>{state.reading?.status==='safety'?<p className="tarot-error" role="alert">{en?'Your wellbeing matters more than a reading. For immediate danger or a medical emergency, contact your local emergency service and someone you trust.':'Твоё благополучие важнее расклада. При непосредственной опасности или экстренной медицинской ситуации обратись в местную экстренную службу и к человеку, которому доверяешь.'}</p>:state.reading?.status==='ready'?<><TarotAiInterpretation reading={state.reading} language={language} onContinue={onContinue}/>{state.reading.interpretation?.cardInsights?.map((insight,index)=><details className="tarot-spread-insight" key={insight.cardId}><summary>{positions[language][kind][index]}</summary><p>{insight.text}</p></details>)}{state.reading.interpretation?.links&&<article className="tarot-meaning"><h3>{en?'The whole picture':'Общая картина'}</h3><p>{state.reading.interpretation.links}</p></article>}</>:<><button className="tarot-draw-button" disabled={busy||state.reading?.status==='fallback'} onClick={()=>void save(true)}><Sparkles size={19}/>{busy?(en?'Luna is reflecting…':'Luna размышляет…'):(en?'Reflect with Luna AI':'Осмыслить с Luna AI')}</button>{state.selected.map((selection,index)=>{const card=tarotDeck.find(c=>c.id===selection.cardId)!;return <details className="tarot-spread-insight" key={card.id}><summary>{positions[language][kind][index]} · {card.name[language]}</summary><p>{card.meaning[language][selection.orientation]}</p></details>;})}</>}
    {featureFlags.tarot_spreads&&<button className="tarot-text-button" onClick={()=>{choiceLock.current.clear();send({type:'reset'});}}><RotateCcw size={17}/>{t.again}</button>}</>}
  </>}
  {error&&<p className="tarot-error" role="alert">{error}</p>}<p className="tarot-hub-note">{t.disclaimer}</p>
  {zoomed&&zoomCard&&<TarotDetails card={zoomCard} orientation={zoomed.orientation} language={language} onClose={()=>setZoom(null)} registerBackHandler={registerBackHandler}/>}
 </section>;
}
