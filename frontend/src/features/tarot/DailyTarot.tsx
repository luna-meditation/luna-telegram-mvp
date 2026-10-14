import {useEffect,useRef,useState,type Dispatch} from 'react';
import {RotateCcw,Sparkles} from 'lucide-react';
import {SectionBack} from '../../luna2/ExplorePage';
import {openDailyTarot,ApiRequestError,type AppLanguage} from '../../api';
import {tarotDeck} from './deck';
import {TarotCard,TarotCardBack} from './TarotCard';
import {TarotDetails} from './TarotDetails';
import {TarotAiInterpretation} from './TarotAiInterpretation';
import type {TarotSession,TarotAction} from './session';

export function DailyTarot({language,initData,session,dispatch,onContinue,registerBackHandler}:{language:AppLanguage;initData?:string;session:TarotSession;dispatch:Dispatch<TarotAction>;onContinue?:(id:string)=>void;registerBackHandler:(handler:(()=>void)|null)=>void}){
 const en=language==='en',daily=session.daily,reading=daily?.reading;
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[gone,setGone]=useState(false),[revealed,setRevealed]=useState(reading?.status==='ready'),[zoom,setZoom]=useState(false);
 const lock=useRef(false),alive=useRef(true);
 const card=reading?tarotDeck.find(c=>c.id===reading.card_id):null;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 async function open(generate=false){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{const result=await openDailyTarot(language,generate,initData,generate?daily?.day:undefined);dispatch({type:'daily',value:result});if(alive.current&&daily&&result.day!==daily.day)setRevealed(false);if(alive.current&&result.reason)setError(en?'Luna needs a little time. Your card is saved.':'Luna нужно немного времени. Твоя карта сохранена.');}
  catch(e){if(alive.current){const removed=e instanceof ApiRequestError&&e.status===410;setGone(removed);setError(removed?(en?'This reading was removed. A new daily card arrives at 00:00 UTC.':'Расклад удалён. Новая карта дня появится в 00:00 UTC.'):e instanceof ApiRequestError&&e.status===409?(en?'A new day has begun. Open today’s card.':'Начался новый день. Открой сегодняшнюю карту.'):(en?'Could not connect. Please try again.':'Не удалось подключиться. Попробуй ещё раз.'));}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 useEffect(()=>{if(daily)void open(false);},[]);
 useEffect(()=>{if(reading?.status!=='processing')return;let polls=0;const timer=window.setInterval(()=>{if(++polls>14)window.clearInterval(timer);else void open(false);},2500);return()=>window.clearInterval(timer);},[reading?.status]);
 useEffect(()=>{if(!zoom)registerBackHandler(()=>{dispatch({type:'screen',value:'hub'});});return()=>{if(!zoom)registerBackHandler(null);};},[zoom,dispatch,registerBackHandler]);
 return <section className="tarot-daily" data-testid="tarot-daily">
  <SectionBack language={language} onBack={()=>dispatch({type:'screen',value:'hub'})}/>
  <header><p className="luna2-eyebrow">{en?'CARD OF THE DAY':'КАРТА ДНЯ'}</p><h1>{card&&revealed?card.name[language]:en?'A moment for you.':'Момент для себя.'}</h1><p>{en?'A personal reflection, once each day.':'Личная интерпретация — один раз в день.'}</p></header>
  {!card?<><div className={`tarot-daily-back ${busy?'is-shuffling':''}`}><TarotCardBack/></div><button type="button" className="tarot-draw-button" disabled={busy} onClick={()=>void open()}><Sparkles size={19}/>{busy?(en?'Shuffling…':'Перемешиваем…'):(en?'Open free card':'Открыть бесплатную карту')}</button><small className="tarot-daily-authorship">{en?'Interpretation by Luna AI':'Интерпретация от Luna AI'}</small></>:<>
   <TarotCard key={reading!.client_reading_id} card={card} orientation={reading!.orientation} revealed={revealed} language={language} onFlip={()=>{if(revealed)setZoom(true);else{setRevealed(true);void open(true);}}}/>
   {revealed&&<><span className="tarot-orientation-pill">{reading!.orientation==='reversed'&&<RotateCcw size={14}/>} {reading!.orientation==='upright'?(en?'Upright':'Прямая'):(en?'Reversed':'Перевёрнутая')}</span>
    {reading!.status==='ready'?<><TarotAiInterpretation reading={reading!} language={language} onContinue={onContinue}/><section className="tarot-daily-themes"><h2>{en?'Explore a little further':'Посмотреть немного глубже'}</h2><p>{en?'Start a separate reflection. Your daily card stays the same.':'Начать отдельный расклад. Карта дня останется прежней.'}</p><div>{(['love','career','growth','general'] as const).map((value,index)=><button type="button" key={value} onClick={()=>{dispatch({type:'reset'});dispatch({type:'screen',value:'single'});dispatch({type:'intention',value});}}>{(en?['Love','Career','My path','My question']:['Любовь','Карьера','Мой путь','Мой вопрос'])[index]}</button>)}</div></section></>:<article className="tarot-meaning"><p role="status">{busy||reading!.status==='processing'?(en?'Luna is reflecting…':'Luna размышляет…'):(en?'Luna couldn’t connect. Here is the card’s symbolic meaning.':'Luna не удалось подключиться. Вот символическое значение карты.')}</p><p>{card.meaning[language][reading!.orientation]}</p>{!busy&&reading!.status==='local'&&<button className="tarot-text-button" onClick={()=>void open(true)}>{en?'Try again':'Попробовать ещё'}</button>}</article>}
   </>}
  </>}
  {error&&<div className="tarot-error" role="alert"><p>{error}</p>{!gone&&<button type="button" className="tarot-text-button" disabled={busy} onClick={()=>void open(false)}>{en?'Reopen card':'Открыть карту'}</button>}</div>}
  <p className="tarot-hub-note">{en?'Your daily card resets at 00:00 UTC. The same saved reflection stays available today.':'Новая карта — в 00:00 UTC. Сегодня повторно откроется тот же сохранённый расклад.'}</p>
  <details className="tarot-privacy"><summary>{en?'Privacy & guidance':'Приватность и рекомендации'}</summary><p>{en?'Luna uses OpenAI to interpret this card. Only preferences you consented to share are included. Your result is private in reading history. Tarot is a reflection tool, not a prediction or professional advice.':'Luna использует OpenAI для интерпретации карты. Предпочтения учитываются только с твоего согласия. Результат хранится в приватной истории. Таро — инструмент рефлексии, не предсказание и не профессиональная консультация.'}</p></details>
  {zoom&&card&&reading&&<TarotDetails card={card} orientation={reading.orientation} language={language} onClose={()=>setZoom(false)} registerBackHandler={registerBackHandler}/>}
 </section>;
}
