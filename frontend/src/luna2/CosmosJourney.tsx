import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Clock3,Feather,Flower2,Orbit,Stars} from 'lucide-react';
import {getHistory,getDiscoveries,listTarotReadings,openDiscovery,type AppLanguage,type PersonalPortrait,type TarotReading,type PlaybackHistory,type Discovery} from '../api';

import {cosmosPosition} from './cosmosNavigation';

/** Existing history sources, progressively revealed with cursor-based Tarot loading. */
export function CosmosJourney({portrait,readings,language,initData,onReading,onObservation,onPractice}:{portrait:PersonalPortrait;readings:TarotReading[];language:AppLanguage;initData?:string;onReading?:(id:string)=>void;onObservation?:(id:string)=>void;onPractice?:(id:string)=>void}){
 const position=cosmosPosition(initData??'local'),[visible,setVisible]=useState(position.journeyVisible),[tarot,setTarot]=useState(readings),[nextOffset,setNextOffset]=useState<number|null>(null),[loadingMore,setLoadingMore]=useState(false),pending=useRef(false);
 const en=language==='en',[history,setHistory]=useState<PlaybackHistory[]|null>(null),[bookmarks,setBookmarks]=useState<Discovery[]>([]),[partial,setPartial]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let live=true;void Promise.allSettled([getHistory(initData),getDiscoveries(initData),listTarotReadings(0,initData)]).then(([practices,saved,cards])=>{if(!live)return;setHistory(practices.status==='fulfilled'?practices.value:[]);setBookmarks(saved.status==='fulfilled'?saved.value.discoveries:[]);if(cards.status==='fulfilled'){setTarot(cards.value.readings);setNextOffset(cards.value.nextOffset);}setPartial(practices.status==='rejected'||saved.status==='rejected'||cards.status==='rejected');});return()=>{live=false;};},[initData,portrait]);
 const privateIds=new Set(Object.values(portrait.sections).flat().filter(item=>item.private).map(item=>item.id));
 const journey=()=>window.dispatchEvent(new CustomEvent('luna-open-destination',{detail:{destination:'journey'}}));
 const entries=[
  ...portrait.timeline.filter(item=>!privateIds.has(item.id)).map(item=>({id:'memory:'+item.id,at:item.at,label:item.text,kind:'memory' as const,referenceId:item.id,Icon:Feather})),
  ...tarot.filter(reading=>reading.interpretation).map(reading=>({id:'tarot:'+reading.id,at:reading.created_at,label:reading.question||(en?'Saved Tarot reading':'Сохранённый расклад Таро'),kind:'tarot' as const,referenceId:reading.id,Icon:Stars})),
  ...bookmarks.filter(item=>item.kind==='astrology').map(item=>({id:'astrology:'+item.id,at:item.created_at,label:item.title,kind:'astrology' as const,referenceId:item.id,Icon:Orbit})),
  ...(history??[]).filter(item=>item.completed).map(item=>({id:'meditation:'+item.id,at:item.last_played,label:item.meditation?.translations?.[language]?.title??item.meditation?.title??(en?'Completed meditation':'Завершённая медитация'),kind:'meditation' as const,referenceId:item.id,meditationId:item.meditation_id,Icon:Flower2}))
 ].filter(item=>Number.isFinite(Date.parse(item.at))).sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id));
 async function open(item:typeof entries[number]){
  setError('');
  if(item.kind==='tarot')onReading?.(item.referenceId);
  else if(item.kind==='memory'){if(onObservation)onObservation(item.referenceId);else window.dispatchEvent(new CustomEvent('luna-open-destination',{detail:{destination:'memory'}}));}
  else if(item.kind==='meditation'){if(onPractice)onPractice(item.meditationId);else window.dispatchEvent(new Event('luna-open-activity'));}
  else try{const saved=await openDiscovery(item.referenceId,initData);if(saved.conversationId)window.dispatchEvent(new CustomEvent('luna-open-conversation',{detail:{id:saved.conversationId}}));}catch{setError(en?'This saved source is unavailable. Reopen your collection.':'Источник недоступен. Открой сохранённую коллекцию заново.');}
 }
 async function more(){
  if(pending.current)return;setError('');
  if(visible>=entries.length&&nextOffset!==null){pending.current=true;setLoadingMore(true);try{const page=await listTarotReadings(nextOffset,initData);setTarot(current=>[...new Map([...current,...page.readings].map(row=>[row.id,row])).values()]);setNextOffset(page.nextOffset);}catch{setError(en?'More history could not be loaded. Try again.':'Не удалось загрузить продолжение. Попробуй ещё раз.');}finally{pending.current=false;setLoadingMore(false);}}
  setVisible(current=>{position.journeyVisible=current+8;return current+8;});
 }
 return <section className="cosmos-journey" data-testid="cosmos-journey"><header className="cosmos-section-heading"><div><h2>{en?'My journey':'Мой путь'}</h2></div></header>
  {entries.length?<ol>{entries.slice(0,visible).map(item=><li key={item.id}><item.Icon size={16}/><button type="button" onClick={()=>void open(item)}><span>{item.label}</span><small>{en?{memory:'Saved observation',tarot:'Tarot',astrology:'Astrology',meditation:'Completed practice'}[item.kind]:{memory:'Сохранённое наблюдение',tarot:'Таро',astrology:'Астрология',meditation:'Завершённая практика'}[item.kind]}</small></button><time dateTime={item.at}>{new Date(item.at).toLocaleDateString(en?'en-GB':'ru-RU',{day:'numeric',month:'short'})}</time></li>)}</ol>:<p className="cosmos-muted">{history===null?(en?'Opening your saved moments…':'Открываем сохранённые моменты…'):(en?'Your saved reflections, readings and completed practices will appear here.':'Здесь появятся сохранённые наблюдения, расклады и завершённые практики.')}</p>}
  {(entries.length>visible||nextOffset!==null)&&<button type="button" className="cosmos-text-link" disabled={loadingMore} onClick={()=>void more()}>{loadingMore?(en?'Loading…':'Загружаем…'):(en?'Earlier moments':'Более ранние моменты')}<Clock3 size={15}/></button>}
  <button type="button" className="cosmos-text-link" onClick={journey}>{en?'Practice progress & achievements':'Прогресс практик и достижения'}<ArrowUpRight size={15}/></button>
  {partial&&<small>{en?'Some history could not be loaded. You can retry in Journey.':'Часть истории недоступна. Повтори в разделе «Мой путь».'}</small>}{error&&<p role="alert">{error}</p>}
 </section>;
}
