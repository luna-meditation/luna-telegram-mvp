import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {X,Sparkles,Orbit,Heart,Headphones,Wind,Moon,Compass,NotebookPen,Hash,type LucideIcon} from 'lucide-react';
import type {AppLanguage} from '../api';
type Action='tarot'|'natal'|'compatibility'|'numerology'|'meditation'|'breathing'|'dream'|'cosmos'|'journal';
export function LunaActionSheet({language,onClose,onAction,availability}:{language:AppLanguage;onClose:()=>void;onAction:(action:Action)=>void;availability:{tarot:boolean;astrology:boolean;cosmos:boolean}}){
 const en=language==='en',dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const focus=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{dialog.current?.close();focus?.focus({preventScroll:true});};},[]);
 const items:Array<{id:Action;icon:LucideIcon;title:string;body:string;show?:boolean}>=[
  {id:'tarot',icon:Sparkles,title:en?'Tarot reading':'Расклад Таро',body:en?'A new perspective on your question':'Новый взгляд на твой вопрос',show:availability.tarot},
  {id:'natal',icon:Orbit,title:en?'Natal chart':'Натальная карта',body:en?'Explore your saved birth chart':'Исследуй свою карту рождения',show:availability.astrology},
  {id:'compatibility',icon:Heart,title:en?'Compatibility':'Совместимость',body:en?'Two charts, one conversation':'Две карты, один разговор',show:availability.astrology},
  {id:'numerology',icon:Hash,title:en?'Numerology':'Нумерология',body:en?'Your saved date, calculated numbers':'Сохранённая дата и точные числа',show:availability.cosmos},
  {id:'meditation',icon:Headphones,title:en?'Meditation':'Медитация',body:en?'Choose a practice from the library':'Выбери практику в библиотеке'},
  {id:'breathing',icon:Wind,title:en?'Breathe together':'Подышать вместе',body:en?'A quiet minute, right here':'Спокойная минута прямо здесь'},
  {id:'dream',icon:Moon,title:en?'Dream reflection':'Размышление о сне',body:en?'Explore the images that stayed with you':'Исследуй образы, которые запомнились'},
  {id:'cosmos',icon:Compass,title:en?'My Universe':'Мой космос',body:en?'Your interests, goals and discoveries':'Твои интересы, цели и открытия',show:availability.cosmos},
  {id:'journal',icon:NotebookPen,title:en?'My journal':'Мой дневник',body:en?'Return to a meaningful moment':'Вернись к важному моменту'}
 ];
 return createPortal(<dialog ref={dialog} className="luna3-action-sheet" aria-labelledby="luna3-actions-title" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="luna3-sheet-handle" aria-hidden="true"/><header><div><small>{en?'A MOMENT FOR YOU':'МОМЕНТ ДЛЯ СЕБЯ'}</small><h2 id="luna3-actions-title">{en?'Where shall we begin?':'С чего начнём?'}</h2></div><button type="button" onClick={onClose} aria-label={en?'Close actions':'Закрыть действия'}><X size={22}/></button></header><div className="luna3-action-list">{items.filter(item=>item.show!==false).map(({id,icon:Icon,title,body})=><button type="button" key={id} data-chat-action={id} onClick={()=>{onClose();onAction(id);}}><span><Icon size={22}/></span><span><strong>{title}</strong><small>{body}</small></span><span aria-hidden="true">↗</span></button>)}</div></dialog>,document.body);
}
