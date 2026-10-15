import {TarotImage as OptimizedImage} from './TarotImage';
import {useEffect,useRef,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import type {AppLanguage} from '../../api';
import type {TarotCardDefinition,TarotOrientation} from './deck';
import {tarotCopy} from './copy';
import cover from './cover-asset.json';

export function TarotCardBack({attempt=0,onReady,onError}:{attempt?:number;onReady?:()=>void;onError?:()=>void}){
 return <OptimizedImage className="tarot-card-back-art" src={`${cover.image}${attempt?`?retry=${attempt}`:''}`} width={cover.width} height={cover.height} alt="" aria-hidden="true" draggable={false} loading="eager" decoding="async" onLoad={event=>{const image=event.currentTarget;void image.decode().then(()=>onReady?.(),()=>image.naturalWidth?onReady?.():onError?.());}} onError={onError}/>;
}
export function TarotCard({card,orientation,revealed,language,onFlip,enabled=true}:{card:TarotCardDefinition;orientation:TarotOrientation;revealed:boolean;language:AppLanguage;onFlip:()=>void;enabled?:boolean;}){
 const [frontReady,setFrontReady]=useState(false),[backReady,setBackReady]=useState(false),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 const [settled,setSettled]=useState(revealed);
 const [pending,setPending]=useState(false),action=useRef(onFlip);action.current=onFlip;
 const ready=frontReady&&backReady,t=tarotCopy[language];
 // Keep one intentional tap while decoding; never ask the user to tap again.
 useEffect(()=>{if(pending&&ready&&enabled&&!failed){setPending(false);action.current();}},[pending,ready,enabled,failed]);
 useEffect(()=>{if(!revealed)return;const timer=setTimeout(()=>setSettled(true),matchMedia('(prefers-reduced-motion: reduce)').matches?0:480);return()=>clearTimeout(timer);},[revealed]);
 function retry(){setFrontReady(false);setBackReady(false);setFailed(false);setAttempt(value=>value+1);}
 return <div className="tarot-card-stage">
  <button type="button" className={`tarot-card-flip ${revealed?'is-revealed':''} ${settled?'is-settled':''}`} disabled={failed||!enabled} aria-busy={pending||!ready} aria-pressed={revealed} aria-label={revealed?`${t.details}: ${card.name[language]}`:t.reveal} onClick={()=>{if(ready)onFlip();else setPending(true);}} data-card-id={card.id} data-orientation={orientation} data-ready={ready}>
   <span className="tarot-card-rotator" onTransitionEnd={event=>{if(event.target===event.currentTarget&&event.propertyName==='transform'&&revealed)setSettled(true);}}>
    <span className="tarot-card-face tarot-card-back" aria-hidden={revealed}><TarotCardBack key={attempt} attempt={attempt} onReady={()=>setBackReady(true)} onError={()=>setFailed(true)}/></span>
    <span className="tarot-card-face tarot-card-front" aria-hidden={!revealed}><OptimizedImage key={attempt} src={`${card.image}${attempt?`?retry=${attempt}`:''}`} width={card.width} height={card.height} alt={revealed?card.name[language]:''} loading="eager" decoding="async" draggable={false} onLoad={event=>{const image=event.currentTarget;void image.decode().then(()=>setFrontReady(true),()=>image.naturalWidth?setFrontReady(true):setFailed(true));}} onError={()=>setFailed(true)}/></span>
   </span>
  </button>
  {failed?<div className="tarot-error" role="alert"><p>{t.imageError}</p><button type="button" className="tarot-text-button" onClick={retry}><RefreshCw size={17}/>{t.retry}</button></div>:!revealed&&<p className="tarot-reveal-hint" role="status">{ready?t.tap:t.preparing}</p>}
 </div>;
}
