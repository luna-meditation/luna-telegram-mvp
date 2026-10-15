import {useEffect,useRef,useState} from 'react';
import {revealLunaTarot,type AppLanguage,type LunaMessage} from '../../api';
import {tarotDeck} from './deck';
import {TarotCard} from './TarotCard';
import {TarotDetails} from './TarotDetails';
import {TarotAiInterpretation} from './TarotAiInterpretation';
import './tarot.css';
export function ChatTarotReading({message,language,initData,onUpdate,registerBackHandler}:{message:LunaMessage;language:AppLanguage;initData?:string;onUpdate:(message:LunaMessage)=>void;registerBackHandler?:(handler:(()=>void)|null)=>void}){
 const state=message.metadata?.tarot,reading=state?.reading,en=language==='en';
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[zoom,setZoom]=useState<number|null>(null);const lock=useRef(false);
 const strip=useRef<HTMLDivElement>(null);
 useEffect(()=>{const next=state?.revealed??0;strip.current?.children[next]?.scrollIntoView({block:'nearest',inline:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},[state?.revealed]);
 if(!state)return null;if(!reading)return <p role="status">{en?'This reading was removed or is unavailable. It will not be regenerated.':'Расклад удалён или недоступен. Он не будет создан повторно.'}</p>;
 const cards=reading.cards?.length?reading.cards:[{cardId:reading.card_id,orientation:reading.orientation}],complete=state.revealed>=cards.length;
 async function reveal(index:number){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{const r=await revealLunaTarot(message.id,index,initData);onUpdate(r.message);}catch{setError(en?'Could not save the reveal. Retry the same card; your reading remains saved.':'Не удалось сохранить открытие. Повтори ту же карту — расклад сохранён.');}finally{lock.current=false;setBusy(false);}}
 const selected=zoom===null?null:cards[zoom],selectedCard=selected?tarotDeck.find(c=>c.id===selected.cardId):null;
 return <section className="luna24-chat-reading" data-testid="chat-tarot-reading" aria-busy={busy}>
  <header><span>LUNA TAROT</span><strong>{cards.length===1?(en?'A new perspective':'Новый взгляд'):en?`${cards.length}-card reflection`:`Расклад: ${cards.length} карты`}</strong>{reading.question&&<p>{reading.question}</p>}</header>
  <div ref={strip} className={`luna24-chat-cards is-${cards.length}`}>{cards.map((c,i)=>{const card=tarotDeck.find(v=>v.id===c.cardId);if(!card)return null;return <article key={card.id}><small>{en?'Card':'Карта'} {i+1}</small><TarotCard card={card} orientation={c.orientation} language={language} revealed={i<state.revealed} enabled={!busy&&i<=state.revealed} onFlip={()=>i<state.revealed?setZoom(i):void reveal(i)}/>{i<state.revealed&&<><strong>{card.name[language]}</strong><span>{c.orientation==='reversed'?(en?'Reversed':'Перевёрнутая'):(en?'Upright':'Прямая')}</span></>}</article>;})}</div>
  {complete&&reading.status==='ready'?<><TarotAiInterpretation reading={reading} language={language}/>{reading.interpretation?.cardInsights?.map((v,i)=><details key={v.cardId}><summary>{en?'Card':'Карта'} {i+1}</summary><p>{v.text}</p></details>)}{reading.interpretation?.links&&<p>{reading.interpretation.links}</p>}</>:complete&&<div className="luna24-local-meaning"><p>{reading.status==='processing'?(en?'Luna is preparing your saved interpretation. Reopen the conversation in a moment.':'Luna готовит сохранённую интерпретацию. Открой разговор чуть позже.'):(en?'Traditional meanings · AI is unavailable or limited. No Moon Seeds charged.':'Традиционные значения · AI недоступен или достигнут лимит. Moon Seeds не списаны.')}</p>{cards.map(c=>{const card=tarotDeck.find(v=>v.id===c.cardId);return card?<details key={card.id}><summary>{card.name[language]}</summary><p>{card.meaning[language][c.orientation]}</p></details>:null;})}</div>}
  {error&&<p role="alert">{error}</p>}<small>{en?'Symbolic reflection, not a prediction.':'Символическое размышление, не предсказание.'}</small>
  {selected&&selectedCard&&<TarotDetails card={selectedCard} orientation={selected.orientation} language={language} onClose={()=>setZoom(null)} registerBackHandler={registerBackHandler??(()=>{})}/>}
 </section>;
}
