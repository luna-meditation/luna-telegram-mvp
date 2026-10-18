import {memo,useCallback,useRef,useState} from 'react';
import {revealLunaTarot,type AppLanguage,type LunaMessage} from '../../api';
import {useTarotDeck} from './editorialDeck';
import {TarotCard} from './TarotCard';
import {TarotDetails} from './TarotDetails';
import {TarotAiInterpretation} from './TarotAiInterpretation';
import {tarotPositions} from './positions';
import {LunaShareButton} from '../sharing/LunaShareButton';
import {publicTarotTakeaway} from './publicTakeaway';
import {SaveDiscoveryButton} from '../../luna2/MyDiscoveries';
import './tarot.css';

const shortPositions={en:{1:['Main perspective'],3:['Situation','Focus','Direction'],5:['Question','Influences','Obstacles','Opportunities','Next step']},ru:{1:['Основной взгляд'],3:['Ситуация','Внимание','Направление'],5:['Суть','Факторы','Препятствия','Возможности','Следующий шаг']}};
export const ChatTarotReading=memo(function ChatTarotReading({message,language,initData,onUpdate,registerBackHandler}:{message:LunaMessage;language:AppLanguage;initData?:string;onUpdate:(message:LunaMessage)=>void;registerBackHandler?:(handler:(()=>void)|null)=>void}){
 const tarotDeck=useTarotDeck();
 const state=message.metadata?.tarot,reading=state?.reading,en=language==='en';
 const cards=reading?(reading.cards?.length?reading.cards:[{cardId:reading.card_id,orientation:reading.orientation}]):[];
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[zoom,setZoom]=useState<number|null>(null),lock=useRef(false);
 const closeViewer=useCallback(()=>setZoom(null),[]);
 if(!state)return null;if(!reading)return <p role="status">{en?'This reading was removed or is unavailable. It will not be regenerated.':'Расклад удалён или недоступен. Он не будет создан повторно.'}</p>;
 const complete=state.revealed>=cards.length,count=cards.length as 1|3|5;
 async function reveal(index:number){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{const r=await revealLunaTarot(message.id,index,initData);onUpdate(r.message);}catch{setError(en?'Could not save the reveal. Retry the same card; your reading remains saved.':'Не удалось сохранить открытие. Повтори ту же карту — расклад сохранён.');}finally{lock.current=false;setBusy(false);}}
 const selected=zoom===null?null:cards[zoom],selectedCard=selected?tarotDeck.find(c=>c.id===selected.cardId):null;
 return <section className="luna24-chat-reading" data-testid="chat-tarot-reading" aria-busy={busy}>
  <header><span>LUNA TAROT</span><strong>{cards.length===1?(en?'A new perspective':'Новый взгляд'):en?`${cards.length}-card reflection`:`Расклад: ${cards.length} ${cards.length===5?'карт':'карты'}`}</strong>{reading.question&&<p>{reading.question}</p>}</header>
  {!complete&&<p className="luna25-reveal-progress" role="status">{busy?(en?'Saving your card…':'Сохраняем карту…'):en?`Open card ${state.revealed+1} of ${count}`:`Открой карту ${state.revealed+1} из ${count}`}</p>}
  {complete&&<p className="luna251-reading-complete" role="status">✓ {en?'Reading revealed · saved':'Карты открыты · расклад сохранён'}</p>}
  <div className={`luna24-chat-cards is-${count}`} role="group" aria-label={en?'Reading cards':'Карты расклада'}>{cards.map((c,i)=>{
   const card=tarotDeck.find(v=>v.id===c.cardId);if(!card)return null;
   return <article key={`${reading.id}-${i}`} aria-label={`${en?'Card':'Карта'} ${i+1}`}><TarotCard card={card} orientation={c.orientation} language={language} revealed={i<state.revealed} enabled={i<state.revealed||!busy&&i===state.revealed} onFlip={()=>i<state.revealed?setZoom(i):void reveal(i)}/><small className="luna25-card-position"><b>{i+1}</b>{shortPositions[language][count][i]}</small>{count===1&&i<state.revealed&&<div className="luna25-single-caption"><strong>{card.name[language]}</strong><span>{c.orientation==='reversed'?(en?'Reversed':'Перевёрнутая'):(en?'Upright':'Прямая')}</span></div>}{count>1&&i<state.revealed&&<span className="luna251-orientation">{c.orientation==='reversed'?(en?'↶ Reversed':'↶ Перевёрнутая'):(en?'Upright':'Прямая')}</span>}{i<state.revealed&&<button type="button" className="luna251-inspect-card" aria-label={`${en?'Inspect':'Рассмотреть'} ${card.name[language]}`} onClick={()=>setZoom(i)}>{en?'View larger':'Увеличить'} ↗</button>}</article>;
  })}</div>
  {complete&&reading.status==='ready'?<TarotAiInterpretation reading={reading} language={language}/>:complete&&<div className="luna24-local-meaning"><p>{reading.status==='processing'?(en?'Luna is preparing your saved interpretation. Reopen the conversation in a moment.':'Luna готовит сохранённую интерпретацию. Открой разговор чуть позже.'):(en?'Traditional meanings · AI is unavailable or limited. No Moon Seeds charged.':'Традиционные значения · AI недоступен или достигнут лимит. Moon Seeds не списаны.')}</p>{cards.map(c=>{const card=tarotDeck.find(v=>v.id===c.cardId);return card?<details key={card.id}><summary>{card.name[language]}</summary><p>{card.meaning[language][c.orientation]}</p></details>:null;})}</div>}
  {error&&<p role="alert">{error}</p>}<small>{en?'Symbolic reflection, not a prediction.':'Символическое размышление, не предсказание.'}</small>
  {complete&&<SaveDiscoveryButton kind="tarot" referenceId={reading.id} title={reading.question||(en?'Tarot reflection':'Размышление с Таро')} language={language} initData={initData}/>}
  {complete&&<LunaShareButton language={language} registerBackHandler={registerBackHandler} content={{kind:'tarot',reference:reading.id,tarot:cards.flatMap(c=>{const card=tarotDeck.find(d=>d.id===c.cardId);return card?[{image:card.image,title:card.name[language],orientation:c.orientation}]:[];}),title:count===1?(tarotDeck.find(c=>c.id===cards[0].cardId)?.name[language]??'Luna Tarot'):(en?`${count} cards · a moment of reflection`:`${count} ${count===3?'карты':'карт'} · момент размышления`),subtitle:publicTarotTakeaway(cards,tarotDeck,language),image:tarotDeck.find(c=>c.id===cards[0].cardId)?.image,badge:en?'Symbolic reflection · not a prediction':'Символическое размышление · не предсказание'}}/>}
  {selected&&selectedCard&&zoom!==null&&<TarotDetails readingId={reading.id} initData={initData} card={selectedCard} orientation={selected.orientation} position={`${zoom+1}. ${tarotPositions[language][count===1?'single':count===3?'three':'five'][zoom]}`} language={language} onClose={closeViewer} registerBackHandler={registerBackHandler??(()=>{})}/>}
 </section>;
});
