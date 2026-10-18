import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Stars,UserRound,UsersRound} from 'lucide-react';
import {getBirthProfiles,type AppLanguage,type BirthProfile} from '../../api';
import {SectionBack} from '../../luna2/ExplorePage';
import AstrologyPage from './AstrologyPage';
import CelestialCalendar from './CelestialCalendar';
import {useEditorialEntries} from '../../editorial';

type Section='home'|'natal'|'compatibility'|'calendar'|'path'|'profiles'|'birth_editor';
export default function AstrologyHub(props:{language:AppLanguage;initData?:string;onBack:()=>void;registerBackHandler?:(handler:(()=>void)|null)=>void;initialSection?:'natal'|'compatibility'|'profiles'|'birth_editor'}){
 const {language,initData,onBack,registerBackHandler}=props,en=language==='en',root=useRef<HTMLDivElement>(null);
 const editorial=useEditorialEntries();
 const [section,setSection]=useState<Section>(props.initialSection??'home'),[subject,setSubject]=useState<'self'|'other'|undefined>();
 const [profiles,setProfiles]=useState<BirthProfile[]|null>(null),[profilesError,setProfilesError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{setSection(props.initialSection??'home');},[props.initialSection]);
 useEffect(()=>{if(section!=='home'&&section!=='calendar')return;registerBackHandler?.(section==='calendar'?()=>setSection('home'):null);return()=>registerBackHandler?.(null);},[section,registerBackHandler]);
 useEffect(()=>{root.current?.scrollIntoView({block:'start',behavior:'auto'});},[section]);
 useEffect(()=>{if(section!=='home')return;let active=true;setProfilesError(false);getBirthProfiles(initData).then(r=>{if(active)setProfiles(r.profiles);}).catch(()=>{if(active){setProfiles(null);setProfilesError(true);}});return()=>{active=false;};},[section,initData,retry]);
 const manage=(kind?:'self'|'other')=>{setSubject(kind);setSection('profiles');};
 if(section==='natal'||section==='compatibility'||section==='path'||section==='profiles'||section==='birth_editor')return <AstrologyPage key={section} {...props} onBack={()=>setSection('home')} experience={section==='birth_editor'?'profiles':section} initialSubjectKind={section==='birth_editor'?'self':subject} startOwnEditor={section==='birth_editor'}/>;
 const categories=[
  {id:'natal' as const,title:en?'My natal chart':'Моя натальная карта',body:en?'Character, relationships and life themes.':'Характер, отношения и жизненные темы.',cta:en?'Open my chart':'Открыть карту'},
  {id:'compatibility' as const,title:en?'Compatibility':'Совместимость',body:en?'Two charts. A closer look at your connection.':'Две карты и новый взгляд на ваши отношения.',cta:en?'Compare two charts':'Сравнить две карты'},
  {id:'calendar' as const,title:en?'Celestial calendar':'Небесный календарь',body:en?'Moon phases, planetary transits and daily reflection.':'Лунные фазы, транзиты и темы для размышления.',cta:en?'Choose a date':'Выбрать дату'},
  {id:'path' as const,title:en?'Path & potential':'Мой путь и потенциал',body:en?'Motivation, strengths and room to grow.':'Мотивация, сильные стороны и развитие.',cta:en?'Explore my path':'Исследовать'}
 ].map(c=>{const e=editorial.find(e=>e.kind==='astrology'&&e.key===c.id);return{...c,title:e?.body.title[language]??c.title,body:e?.body.description[language]??c.body,image:e?.body.image??'/images/astrology/luna32-'+c.id+'.webp'};});
 return <div ref={root} className="luna2-page luna32-astrology-hub" data-testid="astrology-hub">
  <SectionBack language={language} onBack={()=>section==='home'?onBack():setSection('home')}/>
  <header className="luna2-page-heading"><p><Stars size={16}/>{en?'Your celestial space':'Ваше звёздное пространство'}</p><h1>{section==='calendar'?(en?'Celestial calendar':'Небесный календарь'):(en?'Astrology':'Астрология')}</h1><span>{section==='calendar'?(en?'Choose a date. Explore the calculated sky.':'Выберите дату и исследуйте рассчитанное небо.'):(en?'Know yourself. Explore your connections.':'Узнайте себя и свои отношения через звёзды.')}</span></header>
  {section==='calendar'?<CelestialCalendar language={language} initData={initData}/>:<>
   <div className="luna32-astro-categories">{categories.map(({id,title,body,cta,image})=><button type="button" key={id} data-astrology-experience={id} onClick={()=>setSection(id)}>
    <img src={image} width="384" height="384" alt="" loading="lazy" decoding="async"/>
    <span className="luna32-astro-card-copy"><strong>{title}</strong><span>{body}</span><span className="luna32-astro-cta">{cta}<ArrowRight size={16}/></span></span>
   </button>)}</div>
   <section className="luna32-saved-profiles" aria-labelledby="luna32-saved-profiles-title"><header><div><h2 id="luna32-saved-profiles-title">{en?'Saved profiles':'Сохранённые профили'}</h2><p>{en?'Private birth data, in one place.':'Данные рождения — в одном месте.'}</p></div><span>{profiles===null?'—':profiles.length}</span></header>
    {profilesError&&<p role="status">{en?'Profiles could not load.':'Не удалось загрузить профили.'} <button type="button" onClick={()=>setRetry(n=>n+1)}>{en?'Retry':'Повторить'}</button></p>}
    <div><button type="button" onClick={()=>manage('self')}><UserRound size={22}/><strong>{en?'My chart':'Моя карта'}</strong><span>{en?'View or edit':'Открыть или изменить'}</span></button><button type="button" onClick={()=>manage('other')}><UsersRound size={22}/><strong>{en?'Another person':'Другой человек'}</strong><span>{en?'Add or manage':'Добавить или изменить'}</span></button></div>
    <button type="button" className="luna32-manage-profiles" onClick={()=>manage()}>{en?'Manage all profiles':'Управлять всеми профилями'}<ArrowRight size={16}/></button>
   </section>
   <p className="luna32-symbolic-note">{en?'Calculated positions, symbolic meaning — not a scientific personality test or a prediction. Birth details are optional and private.':'Рассчитанные положения, символический смысл — не научный тест личности и не предсказание. Данные рождения необязательны и приватны.'}</p>
  </>}
 </div>;
}
