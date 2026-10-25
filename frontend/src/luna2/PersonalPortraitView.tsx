import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Sparkles,ArrowUpRight,Shield,Orbit,Feather,ChevronDown,Compass,Heart,Sun,Mountain,X,Route} from 'lucide-react';
import {getPersonalPortrait,type PersonalPortrait,type AppLanguage,type UniverseData,type TarotReading} from '../api';
import type {PortraitSection,PortraitEvidence} from '../../../backend/src/personal-portrait-policy';
import {CompanionPreferences} from './CompanionPreferences';
import {CelestialPortrait} from './CelestialPortrait';
import {WeeklyReflection} from './WeeklyReflection';
import {planetName,zodiacNames} from '../features/astrology/chartCopy';
import {DateNumberExplorer} from '../features/astrology/DateNumberExplorer';
import {ConfirmedDiscoveries} from './ConfirmedDiscoveries';
import {CosmosJourney} from './CosmosJourney';
import {NatalWheelDiagram} from '../features/astrology/NatalWheelDiagram';
import {cosmosPosition,type CosmosView} from './cosmosNavigation';
import './personal-portrait.css';
import './cosmos-premium.css';
import './cosmos-simple.css';
const chapters=[{id:'essence',icon:Sun,en:'Who I am',ru:'Кто я',enHint:'What feels true to me',ruHint:'То, в чём я узнаю себя'},{id:'strengths',icon:Sparkles,en:'My strengths',ru:'Мои сильные стороны',enHint:'Grounded in real experience',ruHint:'С опорой на реальный опыт'},{id:'growth',icon:Mountain,en:'My challenges',ru:'Мои сложности',enHint:'What I want to understand',ruHint:'То, с чем хочется разобраться'},{id:'relationships',icon:Heart,en:'My relationships',ru:'Мои отношения',enHint:'Connection and communication',ruHint:'Близость и общение'},{id:'direction',icon:Compass,en:'My path',ru:'Мой путь',enHint:'Values, goals and direction',ruHint:'Ценности, цели и направление'},{id:'discoveries',icon:Feather,en:'My discoveries',ru:'Мои открытия',enHint:'Perspectives I chose to keep',ruHint:'Мысли, которые хочется сохранить'}] as const;
type Chapter=typeof chapters[number]['id']|'astrology';
type Props={data:UniverseData;readings:TarotReading[];language:AppLanguage;firstName:string;initData?:string;onSetup:()=>void;onManage:()=>void;onAstrology?:()=>void;onReading?:(id:string)=>void;onPractice?:(id:string)=>void;onDiscoveries?:()=>void;goalOptions?:Array<{id:string;en:string;ru:string}>;registerBack?:(handler:(()=>boolean)|null)=>void};
export function PersonalPortraitView({data,readings,language,firstName,initData,onSetup,onManage,onAstrology,onReading,onPractice,onDiscoveries,registerBack}:Props){
 const en=language==='en',name=data.profile.display_name??data.identity?.firstName??firstName;
 const position=cosmosPosition(initData??'local');
 const [portrait,setPortrait]=useState<PersonalPortrait|null>(null),[error,setError]=useState(false),[revision,setRevision]=useState(0);
 const [view,setViewValue]=useState<CosmosView>(position.view),[chapter,setChapterValue]=useState<Chapter|null>(position.chapter);
 const setChapter=(value:Chapter|null)=>{position.chapter=value;setChapterValue(value);};
 const setView=(value:CosmosView)=>{position.view=value;setViewValue(value);};
 const detail=useRef<HTMLElement|null>(null),root=useRef<HTMLDivElement|null>(null),discoveryBack=useRef<(()=>boolean)|null>(null);
 useEffect(()=>{let live=true;setError(false);getPersonalPortrait(initData).then(value=>{if(live)setPortrait(value);}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[initData,data,revision]);
 useEffect(()=>{registerBack?.(()=>{if(chapter){setChapter(null);return true;}if(view==='discoveries'&&discoveryBack.current?.())return true;if(view!=='overview'){setView('overview');return true;}return false;});return()=>registerBack?.(null);},[chapter,view,registerBack]);
 useLayoutEffect(()=>{
  if(!portrait)return;const shell=root.current?.closest('.app-shell');if(!shell)return;
  shell.scrollTop=position.scroll[view]??0;
  const capture=()=>{position.scroll[view]=shell.scrollTop;position.scrollTop=shell.scrollTop;};
  shell.addEventListener('scroll',capture,{passive:true});return()=>{capture();shell.removeEventListener('scroll',capture);};
 },[view,Boolean(portrait)]);
 useEffect(()=>{if(chapter)detail.current?.focus({preventScroll:true});},[chapter]);
 const discuss=(section:PortraitSection|'astrology'|'overview'='overview')=>window.dispatchEvent(new CustomEvent('luna-portrait-discuss',{detail:{section}}));
 const openNatal=()=>onAstrology?window.dispatchEvent(new CustomEvent('luna-open-astrology',{detail:{section:'natal'}})):onSetup();
 const rows=(id:Chapter):PortraitEvidence[]=>!portrait||id==='astrology'?[]:id==='direction'?[...portrait.sections.direction,...portrait.sections.motivations]:portrait.sections[id];
 const labels=zodiacNames(language),english=zodiacNames('en'),localized=(name:string)=>labels[english.indexOf(name)]??name;
 const solar=portrait?.chart?.facts.planets.find(p=>p.planet.toLowerCase()==='sun')?.signs.map(localized).join(' / ')??portrait?.dateOnlySun?.sunSigns.map(n=>labels[n]).join(' / ');
 const selected=chapters.find(c=>c.id===chapter),selectedRows=chapter?rows(chapter):[];
 function evidence(item:PortraitEvidence){return <article className="portrait-evidence" key={item.id}><p>{item.text}</p><details><summary>{item.private?(en?'Private entry · source':'Личная запись · источник'):item.kind==='user_fact'?(en?'Confirmed by you':'Подтверждено тобой'):item.kind==='symbolic_reflection'?(en?'Symbolic interpretation':'Символическая интерпретация'):(en?'Your reflection':'Твоё размышление')}</summary><small>{item.kind==='user_fact'?(en?'Your saved statement, not an inferred trait.':'Твоя сохранённая запись, не предположение о характере.'):(en?'A perspective you chose to save, not a biographical fact.':'Сохранённый тобой взгляд, не биографический факт.')} · {new Date(item.updatedAt).toLocaleDateString(en?'en-GB':'ru-RU')}</small><button type="button" onClick={onManage}>{en?'Correct or remove':'Изменить или удалить'} →</button></details></article>;}
 const destinations=[{id:'chart',Icon:Orbit,title:en?'My Chart':'Моя карта',hint:en?'Your natal sky':'Твоё натальное небо'},{id:'discoveries',Icon:Feather,title:en?'Discoveries':'Открытия',hint:en?'What you choose to keep':'То, что хочется сохранить'},{id:'journey',Icon:Route,title:en?'My Journey':'Мой путь',hint:en?'Moments along the way':'Моменты твоего пути'}] as const;
 return <div ref={root} className="personal-portrait portrait-book cosmos-premium cosmos-simple" data-testid="universe-overview" data-cosmos-view={view}>
  {error?<div className="portrait-load-error" role="alert"><p>{en?'Your portrait could not be verified. Your saved data are unchanged.':'Не удалось проверить портрет. Сохранённые данные не изменены.'}</p><button type="button" onClick={()=>setRevision(v=>v+1)}>{en?'Retry':'Повторить'}</button></div>:!portrait?<p role="status">{en?'Opening your space…':'Открываем твоё пространство…'}</p>:<>
   {view==='overview'?<>
    <header className="cosmos-quiet-header"><h1>{name}</h1></header>
    <button type="button" className="cosmos-universe-entry" data-testid="cosmos-chart-entry" onClick={()=>setView('chart')} aria-label={en?'Open My Chart':'Открыть мою карту'}>
     {portrait.chart?.calculation?<NatalWheelDiagram chart={portrait.chart.calculation} language={language} interactive={false}/>:<span className="cosmos-neutral-sky" aria-hidden="true"><img src="/assets/luna-ux/lunar-jewel-v1-384.webp" width={220} height={220} alt="" decoding="async"/><i/><i/><i/><b>✧</b></span>}
     <span className="cosmos-entry-caption">{portrait.chart?.calculation?(en?'Your sky, a closer look':'Твоё небо — ближе'):(en?'Begin with your birth chart':'Начни со своей карты рождения')}<ArrowUpRight size={14}/></span>
    </button>
    <nav className="cosmos-three-doors" aria-label={en?'My Cosmos destinations':'Разделы моего космоса'}>{destinations.map(({id,Icon,title,hint})=><button type="button" data-cosmos-destination={id} key={id} onClick={()=>setView(id)}><Icon size={21} strokeWidth={1.2}/><span><strong>{title}</strong><small>{hint}</small></span><ArrowUpRight size={17}/></button>)}</nav>
   </>:chapter?<section className="portrait-focused-chapter" ref={detail} tabIndex={-1} aria-labelledby="portrait-detail-title"><header><span className="portrait-kicker">{en?'ONE PART OF YOUR STORY':'ОДНА ГЛАВА ТВОЕЙ ИСТОРИИ'}</span><button type="button" onClick={()=>setChapter(null)} aria-label={en?'Close chapter':'Закрыть главу'}><X size={20}/></button></header><h2 id="portrait-detail-title">{selected?.[language]??(en?'My cosmic sources':'Мои космические источники')}</h2>
    {chapter==='astrology'?<><p>{en?'Calculated placements and traditional symbolism are sources for reflection, not confirmed traits.':'Расчётные положения и традиционная символика — источники для размышления, не доказанные черты личности.'}</p>{portrait.chart?<div className="portrait-chart-facts"><dl>{portrait.chart.facts.planets.filter(p=>['sun','moon','mercury','venus','mars'].includes(p.planet.toLowerCase())).map(p=><div key={p.planet}><dt>{planetName(p.planet,language)}</dt><dd>{p.signs.map(localized).join(' / ')}</dd></div>)}{portrait.chart.facts.ascendant&&<div><dt>{en?'Rising':'Асцендент'}</dt><dd>{localized(portrait.chart.facts.ascendant)}</dd></div>}</dl><small>{en?'Source: the current saved calculated chart.':'Источник: актуальная сохранённая рассчитанная карта.'}</small>{portrait.chart.facts.precision==='unknown'&&<p>{en?'Birth time is unknown: possible sign ranges are shown. No ascendant or houses are inferred.':'Время рождения неизвестно: показаны возможные диапазоны знаков. Асцендент и дома не угадываются.'}</p>}</div>:<p>{solar?(en?`Sun by date: ${solar}. No precise Moon, ascendant or houses without the required birth details.`:`Солнце по дате: ${solar}. Без необходимых данных нет точной Луны, асцендента и домов.`):(en?'Optional birth details can unlock calculated sources. You can keep using Luna without them.':'По желанию добавь данные рождения, чтобы открыть расчётные источники. Luna работает и без них.')}</p>}
    {portrait.numerology.calculated&&<><h3>{en?'Numbers as symbolic themes':'Числа как символические темы'}</h3><DateNumberExplorer data={portrait.numerology} language={language} className="portrait-numbers"/></>}
    <button type="button" className="portrait-primary-link" onClick={openNatal}><Orbit size={18}/>{portrait.birth.available?(en?'Open my calculated chart':'Открыть рассчитанную карту'):(en?'Add optional birth details':'Добавить данные рождения')}</button><button type="button" className="portrait-primary-link" onClick={()=>discuss('astrology')}>{en?'Explore with Luna':'Исследовать с Луной'} <ArrowUpRight size={16}/></button></>:<>
     {chapter==='growth'&&<p>{en?'These are things you chose to explore or change, not flaws assigned to you by Luna.':'Это то, что тебе хочется исследовать или изменить, а не недостатки, которые тебе приписывает Luna.'}</p>}
     {selectedRows.length?selectedRows.slice(0,3).map(evidence):<p>{chapter==='strengths'?(en?'What have you handled well in real life? A goal or zodiac sign is not proof of a strength.':'С чем тебе удаётся справляться в реальной жизни? Цель или знак зодиака не доказывают наличие таланта.'):(en?'This chapter is still open. We can explore it together, one useful question at a time.':'Эта глава ещё открыта. Можем исследовать её вместе, по одному полезному вопросу.')}</p>}
     {selectedRows.length>3&&<details><summary>{en?'More saved observations':'Другие сохранённые наблюдения'}</summary>{selectedRows.slice(3).map(evidence)}</details>}
     <button type="button" className="portrait-primary-link" onClick={()=>discuss(chapter)}>{en?'Explore with Luna':'Исследовать с Луной'} <ArrowUpRight size={16}/></button>
     {chapter==='discoveries'&&<>{readings.filter(r=>r.interpretation).slice(0,2).map(r=><button className="portrait-saved-reading" key={r.id} type="button" onClick={()=>onReading?.(r.id)}>{r.question||(en?'Saved Tarot reflection':'Сохранённое размышление Таро')} <ArrowUpRight size={16}/></button>)}{onDiscoveries&&<button type="button" className="portrait-primary-link" onClick={onDiscoveries}>{en?'All my discoveries':'Все мои открытия'} →</button>}<WeeklyReflection language={language} initData={initData}/></>}
    </>}
   </section>:<>
    {view==='chart'&&<><header className="cosmos-detail-heading"><h1>{en?'My Chart':'Моя карта'}</h1></header><CelestialPortrait key={initData??'local'} portrait={portrait} language={language} initData={initData} onExplore={()=>setChapter('astrology')} onNatal={openNatal}/></>}
    {view==='discoveries'&&<><ConfirmedDiscoveries data={data} language={language} initData={initData} onCollection={onDiscoveries} onBackChange={handler=>{discoveryBack.current=handler;}}/>
     <details className="cosmos-portrait-chapters"><summary><span>{en?'Explore my portrait':'Исследовать мой портрет'}</span><ChevronDown size={17}/></summary><nav className="portrait-editorial-chapters" aria-label={en?'Chapters of my portrait':'Главы моего портрета'}>{chapters.map(item=><button type="button" key={item.id} onClick={()=>setChapter(item.id)}><item.icon size={20}/><span><strong>{item[language]}</strong></span><ArrowUpRight size={16}/></button>)}</nav></details>
     <details className="portrait-privacy"><summary><Shield size={17}/>{en?'My data & privacy':'Мои данные и приватность'}<ChevronDown size={16}/></summary><button type="button" onClick={onManage}>{en?'Review, correct or delete memories':'Посмотреть, изменить или удалить память'} →</button><button type="button" onClick={onSetup}>{en?'Name, birth details & consent':'Имя, данные рождения и согласия'} →</button><CompanionPreferences memories={data.memories} language={language} initData={initData} onSaved={()=>window.dispatchEvent(new CustomEvent('luna-personal-data-changed'))}/></details>
    </>}
    {view==='journey'&&<CosmosJourney portrait={portrait} readings={readings} language={language} initData={initData} onReading={onReading} onPractice={onPractice} onObservation={id=>{position.expandedDiscovery=id;setView('discoveries');}}/>}
   </>}
  </>}
 </div>;
}
