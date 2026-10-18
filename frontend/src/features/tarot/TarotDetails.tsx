import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import type {AppLanguage} from '../../api';
import type {TarotCardDefinition,TarotOrientation} from './deck';
import {tarotCopy} from './copy';
import {noteProgress} from '../progress/evidence';

export function TarotDetails({card,orientation,language,position,onClose,registerBackHandler,readingId,initData}:{card:TarotCardDefinition;orientation:TarotOrientation;language:AppLanguage;position?:string;onClose:()=>void;registerBackHandler:(handler:(()=>void)|null)=>void;readingId?:string;initData?:string}){
 const t=tarotCopy[language],dialog=useRef<HTMLDivElement>(null),close=useRef<HTMLButtonElement>(null);
 const handlers=useRef({onClose,registerBackHandler});handlers.current={onClose,registerBackHandler};
 const [failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{noteProgress('card_detail',readingId,card.id,initData);},[readingId,card.id,initData]);
 useEffect(()=>{
  const previousFocus=document.activeElement as HTMLElement|null,previousOverflow=document.body.style.overflow;
  const app=document.querySelector('.app-root'),wasInert=app?.hasAttribute('inert');
  const scrollParents:Array<{element:HTMLElement;top:number;left:number}>=[];
  for(let element=previousFocus?.parentElement;element;element=element.parentElement){if(element.scrollHeight>element.clientHeight)scrollParents.push({element,top:element.scrollTop,left:element.scrollLeft});}
  const register=handlers.current.registerBackHandler,closeViewer=()=>handlers.current.onClose();
  document.body.style.overflow='hidden';app?.setAttribute('inert','');close.current?.focus({preventScroll:true});register(closeViewer);
  function handleKey(event:KeyboardEvent){
   if(event.key==='Escape'){event.preventDefault();closeViewer();}
   if(event.key==='Tab'){
    const buttons=dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),first=buttons?.[0],last=buttons?.[buttons.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  }
  document.addEventListener('keydown',handleKey);
  return ()=>{document.removeEventListener('keydown',handleKey);register(null);document.body.style.overflow=previousOverflow;if(!wasInert)app?.removeAttribute('inert');if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});for(const {element,top,left}of scrollParents)if(element.isConnected)element.scrollTo({top,left,behavior:'instant'});};
 },[]);
 return createPortal(<div className="tarot-details-overlay" onClick={event=>{if(event.target===event.currentTarget)onClose();}}><div className="tarot-details" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="tarot-details-title">
  <header><h2 id="tarot-details-title">{card.name[language]}</h2><button type="button" ref={close} className="luna-icon-button" aria-label={t.close} onClick={onClose}><X size={23}/></button></header>
  <img key={attempt} src={`${card.image}${attempt?`?retry=${attempt}`:''}`} width={card.width} height={card.height} alt={card.name[language]} onError={()=>setFailed(true)} draggable={false}/>
  {failed&&<div className="tarot-error" role="alert"><p>{t.imageError}</p><button type="button" className="tarot-text-button" onClick={()=>{setFailed(false);setAttempt(value=>value+1);}}>{t.retry}</button></div>}
  <p className="tarot-orientation-pill">{t[orientation]}</p>
  {position&&<p className="tarot-details-position">{position}</p>}
  <p className="tarot-details-meaning">{card.meaning[language][orientation]}</p>
  {card.editorialDescription&&<small>{card.editorialDescription[language]}</small>}
 </div></div>,document.body);
}
