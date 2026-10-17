import {useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import {Check, Crown, Pause, Play, X} from 'lucide-react';
import type {AppLanguage} from '../../api';
import './soundscape-sheet.css';

type Sound={id:string;title:Record<AppLanguage,string>;subtitle:Record<AppLanguage,string>;description:Record<AppLanguage,string>;access:'free'|'premium'};
export function SoundscapeSheet({scenes,selectedId,playing,language,hasPremium,onSelect,onToggle,onClose,registerBackHandler}:{scenes:Sound[];selectedId?:string;playing:boolean;language:AppLanguage;hasPremium:boolean;onSelect:(id:string)=>void;onToggle:()=>void;onClose:()=>void;registerBackHandler?:(handler:(()=>void)|null)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),startY=useRef<number|null>(null),en=language==='en';
 const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();registerBackHandler?.(()=>close.current());return()=>{dialog.current?.close();registerBackHandler?.(null);previous?.focus({preventScroll:true});};},[registerBackHandler]);
 return createPortal(<dialog ref={dialog} className="luna34-sounds" aria-labelledby="luna34-sounds-title" onCancel={onClose} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
  <div className="luna34-sheet-handle" onTouchStart={e=>{startY.current=e.touches[0]?.clientY??null;}} onTouchEnd={e=>{if(startY.current!==null&&(e.changedTouches[0]?.clientY??0)-startY.current>65)onClose();startY.current=null;}} aria-hidden="true"><i/></div>
  <header><div><small>LUNA</small><h2 id="luna34-sounds-title">{en?'Sounds':'Звуки'}</h2></div><button type="button" onClick={onClose} aria-label={en?'Close sounds':'Закрыть звуки'}><X size={22}/></button></header>
  <p>{en?'Choose an atmosphere. Playback starts only when you press play.':'Выберите атмосферу. Звук включится только по нажатию на воспроизведение.'}</p>
  <div className="luna34-sound-list">{scenes.map((scene,index)=>{const active=scene.id===selectedId,locked=scene.access==='premium'&&!hasPremium;return <article key={scene.id} className={active?'is-selected':''}>
   <button type="button" className="luna34-sound-select" aria-pressed={active} onClick={()=>onSelect(scene.id)}><span className={`luna34-sound-art sound-${index}`} aria-hidden="true">{active?<Check size={21}/>:<span/>}</span><span><strong>{scene.title[language]}</strong><small>{scene.subtitle[language]}</small>{locked&&<em><Crown size={12}/>Premium</em>}</span></button>
   {active&&!locked&&<button type="button" className="luna34-sound-play" onClick={onToggle} aria-label={playing?(en?'Pause sound':'Приостановить звук'):(en?'Play sound':'Включить звук')}>{playing?<Pause size={20}/>:<Play size={20}/>}</button>}
  </article>;})}</div>
  <small className="luna34-sound-note">{en?'Sounds pause when a meditation starts. Returning Home never starts audio automatically.':'Звуки приостанавливаются при запуске медитации. Возврат на Главную не включает их автоматически.'}</small>
 </dialog>,document.body);
}
