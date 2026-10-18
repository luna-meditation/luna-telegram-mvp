import {useEffect,useRef,useState} from 'react';
import {ApiRequestError,openLunaTarot,savePendingCommerceAction,type AppLanguage,type LunaMessage} from '../../api';
import type {IntelligenceAttachment,IntelligenceSpread} from '../../../../backend/src/luna-intelligence-contract';
import {TarotChoiceGrid} from './TarotChoiceGrid';
import {tarotCopy} from './copy';
type Attachment=Extract<IntelligenceAttachment,{type:'tarot_reading'}>;
type Draft={kind:IntelligenceSpread|null;intention:'general'|'love'|'career'|'growth';question:string;selected:number[];snapshot?:Parameters<typeof openLunaTarot>[0]};
const drafts=new Map<string,Draft>();
export function EmbeddedTarotChooser({attachment,messageId,conversationId,language,initData,onResult,onPending}:{attachment:Attachment;messageId:string;conversationId:string;language:AppLanguage;initData?:string;onResult:(result:{conversationId:string;message:LunaMessage})=>void;onPending:()=>void}){
 const p=attachment.payload,key=initData?`${initData}:${attachment.id}`:attachment.id,cached=drafts.get(key),en=language==='en';
 const [kind,setKind]=useState<IntelligenceSpread|null>(cached?.kind??p.kind),[intention,setIntention]=useState(cached?.intention??p.intention),[question,setQuestion]=useState(cached?.question??p.question),[selected,setSelected]=useState<number[]>(cached?.selected??[]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const choices=useRef(selected),lock=useRef(false),snapshot=useRef(cached?.snapshot),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{drafts.set(key,{kind,intention,question,selected,snapshot:snapshot.current});if(drafts.size>32)drafts.delete(drafts.keys().next().value!);},[key,kind,intention,question,selected,busy]);
 const count=kind==='five'?5:kind==='three'?3:1;
 async function create(next:number[]){
  if(!kind||!p.clientReadingId||lock.current||next.length!==count)return;lock.current=true;setBusy(true);setError('');
  snapshot.current??={clientReadingId:p.clientReadingId,conversationId,kind,intention,question:question.trim(),language,actionMessageId:messageId,choiceSlots:next};
  const input=snapshot.current;drafts.set(key,{kind,intention,question,selected:next,snapshot:input});
  try{const result=await openLunaTarot(input,initData);drafts.delete(key);onResult(result);}
  catch(error){
   if(error instanceof ApiRequestError&&error.status===402){
    try{await savePendingCommerceAction({id:input.clientReadingId,conversationId,language:input.language,action:{type:'tarot',kind:input.kind,intention:input.intention,question:input.question,actionMessageId:input.actionMessageId,choiceSlots:input.choiceSlots}},initData);onPending();if(alive.current)setError(en?'Your exact reading is saved. Review the actual access options below; nothing was charged.':'Запрос расклада сохранён. Проверь доступные варианты ниже — списания не было.');}
    catch{if(alive.current)setError(en?'Could not save this request. Retry the same selection; nothing was charged.':'Не удалось сохранить запрос. Повтори тот же выбор — списания не было.');}
   }else if(alive.current)setError(en?'Could not open your cards. Retry this same selection; a saved draw will be reused.':'Не удалось открыть карты. Повтори этот же выбор — сохранённый расклад будет использован повторно.');
  }finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 function choose(slot:number){if(busy||lock.current||choices.current.includes(slot)||choices.current.length>=count)return;const next=[...choices.current,slot];choices.current=next;setSelected(next);if(next.length===count)void create(next);}
 return <section className="luna-intelligence-tarot" data-testid="embedded-tarot-selector" data-spread={kind??'choose'} aria-busy={busy}>
  <header><small>LUNA TAROT</small><h3>{kind?(en?`Choose ${count} ${count===1?'card':'cards'}`:`Выбери ${count===1?'одну карту':count===3?'три карты':'пять карт'}`):(en?'Which spread would you like?':'Какой расклад выберем?')}</h3></header>
  {!kind?<div className="luna30-quick-replies">{(['single','three','five'] as const).map(value=><button type="button" key={value} onClick={()=>setKind(value)}>{value==='single'?(en?'One card':'Одна карта'):value==='three'?(en?'Three cards':'Три карты'):(en?'Five cards':'Пять карт')}</button>)}</div>:<>
   <details className="luna-intelligence-tarot-question"><summary>{en?'Add an intention or question · optional':'Намерение и вопрос · необязательно'}</summary><label>{en?'Intention':'Намерение'}<select value={intention} disabled={selected.length>0||busy} onChange={e=>setIntention(e.target.value as Draft['intention'])}>{(['general','love','career','growth'] as const).map(value=><option key={value} value={value}>{tarotCopy[language].intentions[value].title}</option>)}</select></label><label>{en?'Your question':'Твой вопрос'}<textarea value={question} maxLength={240} rows={2} disabled={selected.length>0||busy} onChange={e=>setQuestion(e.target.value)}/></label></details>
   <TarotChoiceGrid language={language} slots={5} selected={selected} disabled={busy||selected.length===count} onChoose={choose}/>
   <p role="status">{busy?(en?'Saving your reading…':'Сохраняем расклад…'):`${selected.length} / ${count}`}</p>
   {!busy&&selected.length===count&&<button type="button" className="luna-button-primary" onClick={()=>void create(selected)}>{en?'Open my saved selection':'Открыть мой сохранённый выбор'}</button>}
  </>}
  {error&&<p role="alert">{error}</p>}<small>{en?'Choosing cards never charges Moon Seeds. Any payment needs your separate confirmation.':'Выбор карт не списывает Moon Seeds. Оплата — только после отдельного подтверждения.'}</small>
 </section>;
}
