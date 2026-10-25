import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {ArrowUpRight,Check,Feather,LockKeyhole,Plus,X,MoreHorizontal,ChevronDown} from 'lucide-react';
import {writePersonalMemory,removePersonalMemory,type AppLanguage,type PersonalMemory,type UniverseData} from '../api';
import {cosmosPosition} from './cosmosNavigation';
import {validMemorySource} from '../../../backend/src/personal-memory-policy';

export const discoveryTitle=(memory:PersonalMemory)=>memory.memory_key.replace(/^discovery_/,'').replace(/_/g,' ');
export const confirmedDiscoveries=(memories:PersonalMemory[])=>memories.filter(memory=>memory.category==='reflections'&&validMemorySource(memory)).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));

/** A view and editor of canonical user_memories, never a second discovery store. */
export function ConfirmedDiscoveries({data,language,initData,onCollection,onBackChange}:{data:UniverseData;language:AppLanguage;initData?:string;onCollection?:()=>void;onBackChange?:(handler:(()=>boolean)|null)=>void}){
 const position=cosmosPosition(initData??'local');
 const en=language==='en',items=confirmedDiscoveries(data.memories),id=useId();
 const [visible,setVisible]=useState(8),[expanded,setExpandedValue]=useState<string|null>(position.expandedDiscovery),[editing,setEditing]=useState<PersonalMemory|'new'|null>(null);
 const [title,setTitle]=useState(''),[value,setValue]=useState(''),[confirmed,setConfirmed]=useState(false),[sensitive,setSensitive]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const pending=useRef(false),form=useRef<HTMLFormElement|null>(null);
 const setExpanded=(value:string|null)=>{position.expandedDiscovery=value;setExpandedValue(value);};
 useEffect(()=>{onBackChange?.(()=>{if(editing){setEditing(null);return true;}if(expanded){setExpanded(null);return true;}return false;});return()=>onBackChange?.(null);},[editing,expanded,onBackChange]);
 useEffect(()=>{if(expanded&&!items.some(memory=>memory.id===expanded))setExpanded(null);},[data,expanded]);
 const changed=()=>window.dispatchEvent(new CustomEvent('luna-personal-data-changed'));
 function edit(memory:PersonalMemory|'new'){
  setEditing(memory);setTitle(memory==='new'?'':discoveryTitle(memory));setValue(memory==='new'?'':memory.memory_value);
  setSensitive(memory==='new'?false:memory.is_sensitive);setConfirmed(false);setError('');setNotice('');
 }
 // Focus after the editor commits, before a user can type into another field.
 // A deferred animation-frame focus could move typed text back into the title.
 useLayoutEffect(()=>{if(editing){form.current?.querySelector<HTMLInputElement>('input[type=text]')?.focus({preventScroll:true});form.current?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}},[editing]);
 async function save(){
  if(pending.current||!editing||!confirmed)return;pending.current=true;setBusy(true);setError('');
  const memory=editing==='new'?null:editing;
  try{
   await writePersonalMemory({category:'reflections',key:memory&&title===discoveryTitle(memory)?memory.memory_key:'discovery_'+title.trim(),value:value.trim(),confirmed:true,kind:memory?.memory_kind??'fact',sensitiveConsent:sensitive,...(memory?{revision:memory.revision}:{}),...(memory?.source_message_id?{sourceMessageId:memory.source_message_id}:{})},initData,memory?.id);
   setEditing(null);setNotice(en?'Your observation is confirmed and saved.':'Твоё наблюдение подтверждено и сохранено.');changed();
  }catch{setError(en?'Saving could not be confirmed. Check for a matching topic, privacy permission or an edit in another window. Your draft is still here.':'Не удалось подтвердить сохранение. Проверь совпадающую тему, согласие на чувствительные сведения или изменение в другом окне. Черновик остаётся здесь.');}
  finally{pending.current=false;setBusy(false);}
 }
 async function remove(memory:PersonalMemory){
  if(pending.current||!window.confirm(en?'Delete this observation from personal memory? Its original conversation or reading stays in history.':'Удалить это наблюдение из личной памяти? Исходный разговор или расклад останется в истории.'))return;
  pending.current=true;setBusy(true);setError('');
  try{await removePersonalMemory(initData,memory.id);setExpanded(null);setNotice(en?'Observation deleted from personal memory.':'Наблюдение удалено из личной памяти.');changed();}
  catch{setError(en?'Deletion could not be confirmed. Refresh your saved information before trying again.':'Не удалось подтвердить удаление. Обнови сохранённые сведения перед повтором.');}
  finally{pending.current=false;setBusy(false);}
 }
 const source=(memory:PersonalMemory)=>memory.source_type==='user_saved_ai_reflection'?(en?'Saved Luna reflection':'Сохранённое размышление Луны'):memory.source_type==='user_message'?(en?'Your message to Luna':'Твоё сообщение Луне'):(en?'Your own observation':'Твоё наблюдение');
 const canReflect=data.memoryEnabled&&data.contextConsent;
 return <section className="cosmos-discoveries" aria-labelledby={id+'-heading'} data-testid="confirmed-discoveries">
  <header className="cosmos-section-heading"><div><h2 id={id+'-heading'}>{en?'Discoveries':'Открытия'}</h2></div>{!editing&&!expanded&&<button type="button" className="cosmos-icon-button" onClick={()=>edit('new')} aria-label={en?'Add an observation':'Добавить наблюдение'} disabled={busy}><Plus size={20}/></button>}</header>
  {!editing&&(expanded&&items.find(memory=>memory.id===expanded)?items.filter(memory=>memory.id===expanded).map(memory=><article className="cosmos-discovery-detail" key={memory.id} data-discovery-id={memory.id}>
   <div className="cosmos-discovery-toolbar"><details className="cosmos-overflow"><summary aria-label={en?'Observation actions':'Действия с наблюдением'}><MoreHorizontal size={21}/></summary><div><button type="button" disabled={busy} onClick={()=>edit(memory)}>{en?'Edit or correct':'Изменить'}</button><button type="button" disabled={busy} onClick={()=>void remove(memory)}>{en?'Delete observation':'Удалить наблюдение'}</button></div></details></div>
   <span className="cosmos-record-meta">{memory.is_sensitive?<><LockKeyhole size={13}/>{en?'Private':'Личное'}</>:<><Check size={13}/>{en?'Confirmed by you':'Подтверждено тобой'}</>}</span>
   <h3>{discoveryTitle(memory)}</h3><p>{memory.memory_value}</p>
   <details className="cosmos-source-detail"><summary>{en?'Source & context':'Источник и контекст'}<ChevronDown size={15}/></summary><p>{source(memory)}</p><p>{memory.memory_kind==='symbolic'?(en?'A perspective you saved, not a personal fact.':'Сохранённый взгляд, не личный факт.'):(en?'An observation you confirmed, not an AI assessment.':'Подтверждённое тобой наблюдение, не оценка AI.')}</p><time dateTime={memory.confirmed_at??memory.updated_at}>{new Date(memory.confirmed_at??memory.updated_at).toLocaleDateString(en?'en-GB':'ru-RU')}</time></details>
   {!memory.is_sensitive&&(canReflect?<button type="button" className="cosmos-discovery-reflect" disabled={busy} onClick={()=>window.dispatchEvent(new CustomEvent('luna-portrait-discuss',{detail:{section:'discoveries',memory:{id:memory.id,updatedAt:memory.updated_at}}}))}>{en?'Reflect with Luna':'Обсудить с Луной'}<ArrowUpRight size={16}/></button>:<button type="button" className="cosmos-text-link" onClick={()=>window.dispatchEvent(new CustomEvent('luna-open-destination',{detail:{destination:'memory'}}))}>{en?'Review AI memory permission':'Проверить разрешение для AI'}</button>)}
  </article>):items.length?<div className="cosmos-discovery-list">{items.slice(0,visible).map(memory=><button type="button" className="cosmos-discovery-card" key={memory.id} data-discovery-id={memory.id} onClick={()=>setExpanded(memory.id)} disabled={busy}>
   <span className="cosmos-discovery-row-icon" aria-hidden="true">{memory.is_sensitive?<LockKeyhole size={18}/>:<Feather size={18}/>}</span><span className="cosmos-discovery-row-copy"><strong>{memory.is_sensitive?(en?'A private observation':'Личное наблюдение'):discoveryTitle(memory)}</strong><span className="cosmos-discovery-preview">{memory.is_sensitive?(en?'Only visible when opened':'Текст виден после открытия'):memory.memory_value}</span><time dateTime={memory.confirmed_at??memory.updated_at}>{new Date(memory.confirmed_at??memory.updated_at).toLocaleDateString(en?'en-GB':'ru-RU',{day:'numeric',month:'short'})}</time></span><ArrowUpRight size={16}/>
  </button>)}</div>:<div className="cosmos-useful-empty"><p>{en?'Keep a thought that feels true to you.':'Сохрани мысль, в которой узнаёшь себя.'}</p><button type="button" onClick={()=>edit('new')}>{en?'Save my first observation':'Сохранить первое наблюдение'}<Plus size={16}/></button></div>)}
  {!editing&&!expanded&&items.length>visible&&<button type="button" className="cosmos-text-link" onClick={()=>setVisible(n=>n+8)}>{en?'Show more':'Показать ещё'}<Plus size={15}/></button>}
  {!editing&&!expanded&&onCollection&&<button type="button" className="cosmos-text-link" onClick={onCollection}>{en?'Saved readings & reflections':'Сохранённые расклады и размышления'}<ArrowUpRight size={15}/></button>}
  {editing&&<form className="cosmos-discovery-editor" data-testid="discovery-editor" ref={form} onSubmit={event=>{event.preventDefault();void save();}}>
   <header><h3>{editing==='new'?(en?'An observation to keep':'Наблюдение, которое хочется сохранить'):(en?'Review your observation':'Проверь своё наблюдение')}</h3><button type="button" className="cosmos-icon-button" disabled={busy} onClick={()=>setEditing(null)} aria-label={en?'Close editor':'Закрыть редактор'}><X size={20}/></button></header>
   <label htmlFor={id+'-title'}>{en?'A short title':'Короткое название'}<input id={id+'-title'} type="text" required minLength={2} maxLength={50} value={title} disabled={busy} onChange={event=>{setTitle(event.target.value);setConfirmed(false);}}/></label>
   <label htmlFor={id+'-text'}>{en?'What did you notice about yourself?':'Что удалось заметить о себе?'}<textarea id={id+'-text'} required minLength={2} maxLength={500} rows={4} value={value} disabled={busy} onChange={event=>{setValue(event.target.value);setConfirmed(false);}}/></label>
   <small>{value.length} / 500</small>
   <label className="cosmos-check"><input type="checkbox" checked={sensitive} disabled={busy} onChange={event=>{setSensitive(event.target.checked);setConfirmed(false);}}/><span>{en?'Keep sensitive information private and excluded from AI.':'Чувствительные сведения: хранить приватно, без передачи AI.'}</span></label>
   <label className="cosmos-check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event=>setConfirmed(event.target.checked)}/><span>{en?'I have reviewed and confirm these words.':'Я проверил(а) и подтверждаю эти слова.'}</span></label>
   <button type="submit" className="cosmos-confirm" disabled={busy||!confirmed||title.trim().length<2||value.trim().length<2}>{busy?(en?'Saving…':'Сохраняем…'):(en?'Confirm & save':'Подтвердить и сохранить')}<Check size={17}/></button>
  </form>}
  {error&&<p className="cosmos-inline-error" role="alert">{error}</p>}{notice&&<p className="cosmos-save-notice" role="status">{notice}</p>}
 </section>;
}
