import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import type {AppLanguage} from '../../api';
import type {TarotCardDefinition,TarotOrientation} from './deck';
import {tarotCopy} from './copy';

export function TarotDetails({card,orientation,language,onClose,registerBackHandler}:{card:TarotCardDefinition;orientation:TarotOrientation;language:AppLanguage;onClose:()=>void;registerBackHandler:(handler:(()=>void)|null)=>void;}){
 const t=tarotCopy[language],dialog=useRef<HTMLDivElement>(null),close=useRef<HTMLButtonElement>(null);
 const [failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const previousFocus=document.activeElement as HTMLElement|null,previousOverflow=document.body.style.overflow;
  const app=document.querySelector('.app-root'),wasInert=app?.hasAttribute('inert');
  document.body.style.overflow='hidden';app?.setAttribute('inert','');close.current?.focus();registerBackHandler(onClose);
  function handleKey(event:KeyboardEvent){
   if(event.key==='Escape'){event.preventDefault();onClose();}
   if(event.key==='Tab'){
    const buttons=dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),first=buttons?.[0],last=buttons?.[buttons.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  }
  document.addEventListener('keydown',handleKey);
  return ()=>{document.removeEventListener('keydown',handleKey);registerBackHandler(null);document.body.style.overflow=previousOverflow;if(!wasInert)app?.removeAttribute('inert');if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});};
 },[onClose,registerBackHandler]);
 return createPortal(<div className="tarot-details-overlay" onClick={event=>{if(event.target===event.currentTarget)onClose();}}><div className="tarot-details" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="tarot-details-title">
  <header><h2 id="tarot-details-title">{card.name[language]}</h2><button type="button" ref={close} className="luna-icon-button" aria-label={t.close} onClick={onClose}><X size={23}/></button></header>
  <img key={attempt} src={`${card.image}${attempt?`?retry=${attempt}`:''}`} width={card.width} height={card.height} alt={card.name[language]} onError={()=>setFailed(true)} draggable={false}/>
  {failed&&<div className="tarot-error" role="alert"><p>{t.imageError}</p><button type="button" className="tarot-text-button" onClick={()=>{setFailed(false);setAttempt(value=>value+1);}}>{t.retry}</button></div>}
  <p className="tarot-orientation-pill">{t[orientation]}</p>
 </div></div>,document.body);
}
