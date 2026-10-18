import {useEditorialEntries} from '../../editorial';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronRight,LockKeyhole,X} from 'lucide-react';
import type {AppLanguage} from '../../api';
import {luna34AchievementIds,luna34Categories} from '../../../../backend/src/luna34-achievements';
import {LunaShareButton} from '../../features/sharing/LunaShareButton';
import type {ProgressAchievement} from './ProgressExperience';
import './luna34-achievements.css';

export function Luna34Achievements({items:allItems,language,initiallyOpen=false,onClose,registerBackHandler}:{items:ProgressAchievement[];language:AppLanguage;initiallyOpen?:boolean;onClose?:()=>void;registerBackHandler?:(handler:(()=>void)|null)=>void}){
 const editorial=useEditorialEntries();
 const en=language==='en',items=allItems.filter(i=>luna34AchievementIds.has(i.id)).map(i=>{const e=editorial.find(e=>e.kind==='achievement'&&e.key===i.id);return e?{...i,title:e.body.title[language],description:e.body.description[language],art:e.body.image??i.art}:i;}),archive=allItems.filter(i=>!luna34AchievementIds.has(i.id));
 const total=luna34AchievementIds.size;
 const [open,setOpen]=useState(initiallyOpen),[category,setCategory]=useState('all'),[filter,setFilter]=useState('all'),[selected,setSelected]=useState<ProgressAchievement|null>(null),dialog=useRef<HTMLDialogElement>(null),detail=useRef<HTMLDialogElement>(null);
 const close=()=>{setOpen(false);onClose?.();};
 useEffect(()=>{if(open)dialog.current?.showModal();return()=>dialog.current?.close();},[open]);
 useEffect(()=>{if(selected)detail.current?.showModal();return()=>detail.current?.close();},[selected]);
 useEffect(()=>{if(!open&&!selected)return;registerBackHandler?.(selected?()=>setSelected(null):close);return()=>registerBackHandler?.(null);},[open,selected,registerBackHandler]);
 const unlocked=items.filter(i=>i.unlocked),sorted=[...items].sort((a,b)=>Number(b.unlocked)-Number(a.unlocked)||String(b.unlockedAt??'').localeCompare(String(a.unlockedAt??''))||(b.progress??0)-(a.progress??0));
 const visible=(category==='legacy'?archive:sorted).filter(i=>(category==='all'||category==='legacy'||i.category===category)&&(filter==='all'||filter==='unlocked'&&i.unlocked||filter==='locked'&&!i.unlocked||filter==='progress'&&!i.unlocked&&(i.progress??0)>0));
 const tile=(item:ProgressAchievement)=><button type="button" key={item.id} className={`luna34-achievement-tile ${item.unlocked?'is-unlocked':'is-locked'}`} onClick={()=>setSelected(item)} aria-label={`${item.title}. ${item.unlocked?(en?'Unlocked':'Открыто'):`${item.current??0} / ${item.target??1}`}`}>
  <span className="luna34-achievement-art">{item.art?<img src={item.art} sizes="(max-width: 500px) calc((100vw - 62px) / 3), 120px" width="512" height="512" alt="" loading="lazy" decoding="async"/>:<span aria-hidden="true">✧</span>}<i>{item.unlocked?<Check size={12}/>:<LockKeyhole size={12}/>}</i></span>
  <strong>{item.title}</strong><small>{item.unlocked?(en?'Unlocked':'Открыто'):`${item.current??0} / ${item.target??1}`}</small>
 </button>;
 return <section className="luna34-achievements" data-testid="luna34-achievements"><header><div><small>LUNA JOURNEY</small><h2>{en?'Your discoveries':'Ваши открытия'}</h2></div><span>{unlocked.length} / {total}</span></header>
  <div className="luna34-achievement-grid is-preview">{sorted.slice(0,3).map(tile)}</div>
  <button type="button" className="luna34-achievement-open" onClick={()=>setOpen(true)}>{en?`All ${total} achievements`:`Все ${total} достижений`}<ChevronRight size={18}/></button>
  {open&&createPortal(<dialog ref={dialog} className="luna34-achievement-browser" aria-labelledby="luna34-achievements-title" onCancel={close}><header><div><small>{unlocked.length} / {total} {en?'unlocked':'открыто'}</small><h2 id="luna34-achievements-title">{en?'Your Luna journey':'Ваш путь Luna'}</h2></div><button type="button" onClick={close} aria-label={en?'Close achievements':'Закрыть достижения'}><X/></button></header>
   <p>{en?'Small, meaningful moments. Your progress is never tied to a purchase.':'Небольшие осмысленные шаги. Ваш прогресс не зависит от покупок.'}</p>
   <div className="luna34-achievement-filters" role="group" aria-label={en?'Achievement status':'Статус достижений'}>{[['all',en?'All':'Все'],['unlocked',en?'Unlocked':'Открыто'],['locked',en?'Locked':'Закрыто']].map(([id,label])=><button type="button" key={id} aria-pressed={id===filter} onClick={()=>setFilter(id)}>{label}</button>)}</div>
   <label className="luna41-achievement-category">{en?'Direction':'Направление'}<select value={category} onChange={e=>setCategory(e.target.value)}>{[['all',en?'All directions':'Все направления'],...Object.entries(luna34Categories).map(([key,names])=>[key,names[language]]),...(archive.length?[['legacy',en?'Earlier achievements':'Прежние достижения']]:[])].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   {category==='legacy'&&<p>{en?'Your original achievements and dates are preserved here. They are not counted twice in the new collection.':'Прежние достижения и даты сохранены здесь. В новой коллекции они не учитываются повторно.'}</p>}
   <div className="luna34-achievement-grid">{visible.map(tile)}</div>{!visible.length&&<p>{en?'No discoveries in this filter yet.':'В этом фильтре пока нет достижений.'}</p>}
  </dialog>,document.body)}
  {selected&&createPortal(<dialog ref={detail} className="luna34-achievement-detail" aria-labelledby="luna34-achievement-detail-title" onCancel={()=>setSelected(null)}><button type="button" className="luna34-detail-close" onClick={()=>setSelected(null)} aria-label={en?'Close details':'Закрыть подробности'}><X/></button>{selected.art&&<img src={selected.art} width="512" height="512" alt="" className={selected.unlocked?'':'is-locked'}/>}
   <small>{selected.unlocked?(en?'UNLOCKED':'ОТКРЫТО'):(en?'YOUR NEXT DISCOVERY':'СЛЕДУЮЩЕЕ ОТКРЫТИЕ')}</small><h2 id="luna34-achievement-detail-title">{selected.title}</h2><p>{selected.description}</p>
   <div className="luna34-achievement-progress"><span>{en?'Verified progress':'Подтверждённый прогресс'}<strong>{selected.current??0} / {selected.target??1}</strong></span><progress value={Math.min(selected.target??1,selected.current??0)} max={selected.target??1}/></div>
   {selected.unlockedAt&&<time dateTime={selected.unlockedAt}>{new Date(selected.unlockedAt).toLocaleDateString(en?'en-GB':'ru-RU',{day:'numeric',month:'long',year:'numeric'})}</time>}
   {selected.unlocked&&<LunaShareButton language={language} registerBackHandler={registerBackHandler} content={{kind:'achievement',title:selected.title,subtitle:en?'A meaningful moment on my Luna journey.':'Осмысленный шаг на моём пути Luna.',...(selected.art?{image:selected.art}:{})}}/>}
  </dialog>,document.body)}
 </section>;
}
