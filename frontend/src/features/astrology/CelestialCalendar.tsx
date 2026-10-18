import {useEffect,useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {getCelestialMonth,type AppLanguage,type CelestialMonth} from '../../api';
import {aspectName,planetName,zodiacPosition} from './chartCopy';
import {noteProgress} from '../progress/evidence';

function MoonDisc({angle,size=22}:{angle:number;size?:number}){
 const phase=((angle%360)+360)%360,outer=phase<=180?1:0,cos=Math.cos(phase*Math.PI/180),inner=cos>=0?1-outer:outer,radius=Math.max(.001,Math.abs(cos)*10);
 return <svg width={size} height={size} viewBox="-11 -11 22 22" aria-hidden="true"><circle r="10" fill="#414762"/><path d={'M 0 -10 A 10 10 0 0 '+outer+' 0 10 A '+radius+' 10 0 0 '+inner+' 0 -10 Z'} fill="#f0dba8"/><circle r="10" fill="none" stroke="#a69bba" strokeWidth=".5"/></svg>;
}
export default function CelestialCalendar({language,initData}:{language:AppLanguage;initData?:string}){
 const en=language==='en',today=new Date().toISOString().slice(0,10),locale=en?'en-GB':'ru-RU';
 const [month,setMonth]=useState(today.slice(0,7)),[selectedDate,setSelectedDate]=useState(today),[result,setResult]=useState<CelestialMonth|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let alive=true;setResult(null);setError('');setSelectedDate(d=>d.startsWith(month)?d:month+'-01');getCelestialMonth(month,initData).then(v=>{if(alive)setResult(v);}).catch(()=>{if(alive)setError(en?'The calculated calendar could not load. No AI request was made.':'Не удалось загрузить рассчитанный календарь. AI-запрос не выполнялся.');});return()=>{alive=false;};},[month,initData,en,retry]);
 const selected=result?.days.find(d=>d.date===selectedDate)??null;
 useEffect(()=>{if(selected)noteProgress('calendar_date','00000000-0000-4000-8000-000000000034',selected.date,initData);},[selected?.date,initData]);
 const quarterNames=en?['New Moon','First quarter','Full Moon','Last quarter']:['Новолуние','Первая четверть','Полнолуние','Последняя четверть'];
 const phases=en?['New Moon','Waxing crescent','First quarter','Waxing gibbous','Full Moon','Waning gibbous','Last quarter','Waning crescent']:['Новолуние','Растущий серп','Первая четверть','Растущая Луна','Полнолуние','Убывающая Луна','Последняя четверть','Убывающий серп'];
 const questions=en?['What would you like to begin?','What can you gently make room for?','Which small action is within your control?','What would you like to refine?','What deserves your attention?','What have you learned from your recent experience?','What is no longer useful?','Where could you leave a little space to rest?']:['С чего вам хотелось бы начать?','Для чего можно освободить немного пространства?','Какой небольшой шаг зависит от вас?','Что хотелось бы доработать?','Что заслуживает вашего внимания?','Что вы заметили в своём недавнем опыте?','Что больше не приносит пользы?','Где можно оставить немного места для отдыха?'];
 const phaseIndex=selected?Math.floor((selected.moonPhaseDegrees+22.5)/45)%8:0;
 const moveMonth=(delta:number)=>{const d=new Date(month+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+delta);const value=d.toISOString().slice(0,7);if(value>='1800-01'&&value<='2100-12')setMonth(value);};
 const moveDay=(delta:number)=>{const d=new Date(selectedDate+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+delta);const value=d.toISOString().slice(0,10);if(value<'1800-01-01'||value>'2100-12-31')return;setSelectedDate(value);if(value.slice(0,7)!==month)setMonth(value.slice(0,7));};
 const offset=(new Date(month+'-01T12:00:00Z').getUTCDay()+6)%7;
 const dayEvents=result?.events.filter(event=>event.at.slice(0,10)===selectedDate)??[];
 return <section className="luna32-calendar" data-testid="celestial-calendar">
  <div className="luna32-calendar-month"><button type="button" aria-label={en?'Previous month':'Предыдущий месяц'} disabled={month==='1800-01'} onClick={()=>moveMonth(-1)}><ChevronLeft size={20}/></button><label><span>{en?'Month':'Месяц'}</span><input type="month" min="1800-01" max="2100-12" value={month} onChange={e=>{const v=e.target.value;if(/^\d{4}-(0[1-9]|1[0-2])$/.test(v)&&v>='1800-01'&&v<='2100-12')setMonth(v);}}/></label><button type="button" aria-label={en?'Next month':'Следующий месяц'} disabled={month==='2100-12'} onClick={()=>moveMonth(1)}><ChevronRight size={20}/></button></div>
  {error&&<div role="alert"><p>{error}</p><button type="button" className="luna32-analysis-secondary" onClick={()=>setRetry(n=>n+1)}>{en?'Try again':'Попробовать ещё раз'}</button></div>}
  {!result&&!error&&<p role="status">{en?'Calculating the sky…':'Рассчитываем положения небесных тел…'}</p>}
  {result&&<>
   <div className="luna32-calendar-weekdays" aria-hidden="true">{(en?['M','T','W','T','F','S','S']:['Пн','Вт','Ср','Чт','Пт','Сб','Вс']).map((day,i)=><span key={i}>{day}</span>)}</div>
   <div className="luna32-month-grid" role="group" aria-label={en?'Select a date, UTC':'Выберите дату, UTC'}>{Array.from({length:offset},(_,i)=><span key={'blank-'+i} aria-hidden="true"/>)}{result.days.map(day=><button type="button" key={day.date} onClick={()=>setSelectedDate(day.date)} aria-pressed={selectedDate===day.date} aria-label={new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(day.date+'T12:00:00Z'))+', '+Math.round(day.illuminatedFraction*100)+'%'} aria-current={today===day.date?'date':undefined}><span>{Number(day.date.slice(-2))}</span><MoonDisc angle={day.moonPhaseDegrees}/></button>)}</div>
   {selected&&<article className="luna32-selected-day" aria-live="polite">
    <div className="luna32-date-controls"><button type="button" aria-label={en?'Previous date':'Предыдущая дата'} disabled={selectedDate==='1800-01-01'} onClick={()=>moveDay(-1)}><ChevronLeft size={20}/></button><h2>{new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(selectedDate+'T12:00:00Z'))}</h2><button type="button" aria-label={en?'Next date':'Следующая дата'} disabled={selectedDate==='2100-12-31'} onClick={()=>moveDay(1)}><ChevronRight size={20}/></button></div>
    <div className="luna32-selected-moon"><MoonDisc angle={selected.moonPhaseDegrees} size={48}/><div><strong>{phases[phaseIndex]}</strong><span>{en?'Illuminated':'Освещённость'} {Math.round(selected.illuminatedFraction*100)}% · 12:00 UTC</span></div></div>
    {dayEvents.length>0&&<div className="luna3-day-events">{dayEvents.map(event=><p key={event.at}><strong>{quarterNames[event.quarter]}</strong><time dateTime={event.at}>{new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit',timeZone:'UTC'}).format(new Date(event.at))} UTC</time></p>)}</div>}
    <p className="luna32-reflection-question">{questions[phaseIndex]}</p>
    <small>{en?'A symbolic reflection prompt, not a prediction about the day.':'Символический вопрос для размышления, а не прогноз на день.'}</small>
    {Boolean(selected.planets?.length)&&<details className="luna32-transit-snapshot"><summary>{en?'Calculated sky · advanced details':'Рассчитанное небо · подробнее'}</summary><p>{en?'General-sky positions and major aspects at 12:00 UTC. These are not personal natal transits or exact peak times.':'Положения планет и основные аспекты общего неба на 12:00 UTC. Это не персональные транзиты к натальной карте и не точное время пика аспекта.'}</p><details><summary>{en?'Planet positions':'Положения планет'}</summary><dl className="luna30-planet-list">{selected.planets?.map(p=><div key={p.id}><dt>{planetName(p.id,language)}</dt><dd>{zodiacPosition(p.longitude,language)}</dd></div>)}</dl></details><details><summary>{en?'Calculated sky aspects':'Рассчитанные аспекты неба'}</summary>{selected.aspects?.length?<ul className="luna30-aspect-list">{selected.aspects.map(a=><li key={a.from+a.to}>{planetName(a.from,language)} · {planetName(a.to,language)}<span>{aspectName(a.type,language)} · {a.orb.toFixed(1)}°</span></li>)}</ul>:<p>{en?'No supported major aspects within a 6° orb at this instant.':'Основных поддерживаемых аспектов с орбисом до 6° в этот момент не найдено.'}</p>}</details></details>}
   </article>}
   <details className="luna32-lunar-events"><summary>{en?'Exact lunar phase times this month':'Точное время лунных фаз в этом месяце'}</summary>{result.events.map(event=><article key={event.at}><div><strong>{quarterNames[event.quarter]}</strong><time dateTime={event.at}>{new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:'UTC'}).format(new Date(event.at))} UTC</time></div></article>)}</details>
   <p className="luna32-symbolic-note">{en?'Astronomy Engine calculations. Moon discs are schematic. No date selection generates AI responses or spends Moon Seeds.':'Расчёты Astronomy Engine. Диски Луны схематичны. Выбор даты не запускает AI и не расходует Moon Seeds.'}</p>
  </>}
 </section>;
}
