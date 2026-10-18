import {useEffect,useState} from 'react';
import {ArrowUpRight,BookOpen,NotebookPen,Sparkles,Smile} from 'lucide-react';
import {getUniverse,listTarotReadings,type PersonalMemory,type AppLanguage,type Meditation,type PlaybackHistory,type TarotReading,type WellnessSummary} from '../api';
import {featureFlags} from '../config/featureFlags';
import {SectionBack} from './ExplorePage';
import {useTarotDeck} from '../features/tarot/editorialDeck';
import {TarotImage as OptimizedImage} from '../features/tarot/TarotImage';

export function JournalPage({language,history,meditations,wellness,onBack,onOpen,initData,onReading}:{language:AppLanguage;history:PlaybackHistory[];meditations:Meditation[];wellness:WellnessSummary|null;onBack:()=>void;onOpen:(m:Meditation)=>void;initData?:string;onReading:(r:TarotReading)=>void}){
 const tarotDeck=useTarotDeck();
 const en=language==='en';
 const [filter,setFilter]=useState('all'),[readings,setReadings]=useState<TarotReading[]>([]),[next,setNext]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 const [reflections,setReflections]=useState<PersonalMemory[]>([]);
 useEffect(()=>{let active=true;if(featureFlags.personal_memory)void getUniverse(initData).then(result=>{if(active)setReflections(result.memories.filter(m=>m.category==='reflections'&&m.confirmation_status==='confirmed'));}).catch(()=>undefined);return()=>{active=false;};},[initData]);
 useEffect(()=>{let active=true;if(!featureFlags.tarot_history)return;setBusy(true);listTarotReadings(0,initData).then(r=>{if(active){setReadings(r.readings);setNext(r.nextOffset);}}).catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[initData]);
 async function more(){if(next===null||busy)return;setBusy(true);setError(false);try{const r=await listTarotReadings(next,initData);setReadings(current=>[...current,...r.readings.filter(row=>!current.some(c=>c.id===row.id))]);setNext(r.nextOffset);}catch{setError(true);}finally{setBusy(false);}}
 const moods=en?{calm:'Calm',stressed:'Stressed',tired:'Tired',anxious:'Anxious',focused:'Focused',low_energy:'Low energy'}:{calm:'Спокойствие',stressed:'Напряжение',tired:'Усталость',anxious:'Тревога',focused:'Собранность',low_energy:'Мало энергии'};
 const date=(value:string)=>new Intl.DateTimeFormat(en?'en-US':'ru-RU',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value));
 const entries=[
 ...reflections.map(memory=>({key:`reflection:${memory.id}`,kind:'reflection',timestamp:memory.created_at,title:memory.memory_key.replace(/_/g,' '),body:memory.memory_value,open:()=>window.dispatchEvent(new Event('luna-open-universe')),card:null})),
 ...history.map(h=>{const m=meditations.find(m=>m.id===h.meditation_id)??h.meditation;return {key:`practice:${h.id}`,kind:'practice',timestamp:h.last_played,title:m?.translations?.[language]?.title||m?.title||(en?'Meditation':'Медитация'),body:`${Math.round((m?.duration??h.last_position)/60)} ${en?'min':'мин'} · ${h.completed?(en?'Completed':'Завершено'):(en?'In progress':'В процессе')}`,open:m?()=>onOpen(m):undefined,card:null};}),
 ...(wellness?.weeklyCheckins??[]).map(c=>({key:`mood:${c.id??c.local_date}`,kind:'mood',timestamp:c.created_at??`${c.local_date}T12:00:00`,title:moods[c.mood],body:en?'Mood check-in':'Отметка настроения',open:undefined,card:null})),
 ...readings.map(r=>{const card=tarotDeck.find(c=>c.id===r.card_id);const label=r.reading_kind==='three'?(en?'3-card reading':'Расклад на 3 карты'):r.reading_kind==='five'?(en?'5-card reading':'Расклад на 5 карт'):r.reading_kind==='daily'?(en?'Card of the day':'Карта дня'):(en?'One-card reflection':'Одна карта');return {key:`tarot:${r.id}`,kind:'tarot',timestamp:r.created_at,title:label,body:r.interpretation?.summary||card?.name[language]||'',open:()=>onReading(r),card};})
 ].filter(row=>filter==='all'||row.kind===filter).sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp));
 const filters=en?[['all','All'],['tarot','Tarot'],['reflection','Reflections'],['practice','Practices'],['mood','Mood']]:[['all','Все'],['tarot','Таро'],['reflection','Размышления'],['practice','Практики'],['mood','Настроение']];
 return <div className="luna2-page luna2-activity" data-testid="journal-activity"><SectionBack language={language} onBack={onBack}/><header className="luna2-page-heading"><p>LUNA JOURNAL</p><h1>{en?'My journal':'Мой дневник'}</h1><span>{en?'Small moments, one personal story.':'Твои моменты. Твоя история.'}</span></header>
 <nav className="journal-filters" aria-label={en?'Journal filters':'Фильтры дневника'}>{filters.map(([id,label])=><button key={id} onClick={()=>setFilter(id)} aria-pressed={filter===id}>{label}</button>)}</nav>
 <div className="journal-timeline">{entries.map(row=>{const Icon=row.kind==='tarot'?Sparkles:row.kind==='mood'?Smile:BookOpen;const content=<>{row.card?<OptimizedImage src={row.card.image} sizes="40px" alt=""/>:<Icon size={21}/>}<span><time dateTime={row.timestamp}>{date(row.timestamp)}</time><strong>{row.title}</strong><small>{row.body.length>150?row.body.slice(0,147)+'…':row.body}</small></span>{row.open&&<ArrowUpRight size={18}/>}</>;return row.open?<button className="luna2-activity-row" key={row.key} onClick={row.open}>{content}</button>:<article className="luna2-activity-row" key={row.key}>{content}</article>;})}</div>
 {busy&&<p role="status">{en?'Loading saved moments…':'Загружаем сохранённые моменты…'}</p>}
 {!entries.length&&!busy&&<div className="luna2-empty"><NotebookPen size={24}/><p>{filter==='reflection'?(en?'Private AI conversations are not added automatically. No explicitly saved reflections are available yet.':'Приватные разговоры с AI не добавляются автоматически. Явно сохранённых размышлений пока нет.'):(en?'Your moments will appear here.':'Здесь появятся твои записи.')}</p></div>}
 {error&&<p role="alert">{en?'Reading history could not load. Other journal entries remain available.':'История раскладов не загрузилась. Остальные записи доступны.'}</p>}
 {next!==null&&['all','tarot'].includes(filter)&&<button className="tarot-text-button" disabled={busy} onClick={()=>void more()}>{en?'Load earlier readings':'Загрузить более ранние расклады'}</button>}
 <p className="luna2-journal-note">{en?'Mood: last 7 days. Practices: latest recorded session per meditation. Full Tarot history is available above. Private chats stay private.':'Настроение: последние 7 дней. Практики: последняя запись по каждой медитации. История Таро доступна выше. Личные разговоры остаются личными.'}</p></div>;
}
