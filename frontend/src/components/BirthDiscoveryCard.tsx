import {useEffect,useState} from 'react';
import {Moon,Check,X} from 'lucide-react';
import {previewBirthDiscovery,confirmBirthDiscovery,getBirthProfiles,calculateBirthChart,type BirthDiscoveryPreview,type BirthProfile,type NatalChart,type AppLanguage} from '../api';
import {numerologyThemes} from '../../../backend/src/symbolic-interpretation-knowledge';
import {solarDailyReflection} from '../../../backend/src/daily-personal-entry';
import {BirthProfileEditor} from '../features/astrology/BirthProfileEditor';
import {NatalOverview} from '../features/astrology/NatalOverview';
import {CompanionContextConsent} from './CompanionContextConsent';
const signs={en:['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'],ru:['Овен','Телец','Близнецы','Рак','Лев','Дева','Весы','Скорпион','Стрелец','Козерог','Водолей','Рыбы']};
export function BirthDiscoveryCard({date,language,initData,onSaved,onClose,onReflect}:{date:string;language:AppLanguage;initData?:string;onSaved?:()=>void;onClose:()=>void;onReflect?:(text:string)=>void}){
 const en=language==='en';
 const [preview,setPreview]=useState<BirthDiscoveryPreview|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[profiles,setProfiles]=useState<BirthProfile[]|null>(null),[editor,setEditor]=useState(false),[chart,setChart]=useState<NatalChart|null>(null);
 const [selectedProfile,setSelectedProfile]=useState<string|undefined>();
 useEffect(()=>{let live=true;previewBirthDiscovery(date,initData).then(value=>{if(live)setPreview(value);}).catch(()=>{if(live)setError(en?'This date could not be verified. Nothing was saved.':'Не удалось проверить дату. Ничего не сохранено.');});return()=>{live=false;};},[date,initData,en]);
 async function save(){
  if(!preview||busy)return;setBusy(true);setError('');
  try{await confirmBirthDiscovery(date,preview.expectedUpdatedAt,initData);setPreview(value=>value?{...value,saved:true}:value);window.dispatchEvent(new Event('luna-personal-data-changed'));onSaved?.();}
  catch{const latest=await previewBirthDiscovery(date,initData).catch(()=>null);if(latest?.saved){setPreview(latest);window.dispatchEvent(new Event('luna-personal-data-changed'));onSaved?.();}else setError(en?'The date was not confirmed. Reopen to check existing details; no saved date was overwritten.':'Дата не подтверждена. Открой карточку заново, чтобы проверить сведения; сохранённая дата не перезаписана.');}
  finally{setBusy(false);}
 }
 async function more(){
  if(busy)return;setBusy(true);setError('');
  try{const result=await getBirthProfiles(initData);setProfiles(result.profiles);const own=result.profiles.filter(profile=>profile.subject_kind==='self');setSelectedProfile(own.length===1?own[0].id:undefined);setEditor(true);}
  catch{setError(en?'Birth profiles could not load. Your confirmed date is preserved.':'Не удалось открыть профили рождения. Подтверждённая дата сохранена.');}
  finally{setBusy(false);}
 }
 const number=preview?.numerology.lifePath;
 const theme=number?numerologyThemes[number]?.[language]:'';
 const reflection=preview?solarDailyReflection({language,localDate:date,sunSigns:preview.sun.sunSigns,source:'date_only_sun'}):null;
 const numberText=number===11?(en?'Inspiration and sensitivity.':'Вдохновение и восприимчивость.'):number===22?(en?'Giving a meaningful idea a workable shape.':'Как придать важной идее реальную форму.'):number===33?(en?'Care and sharing experience, with room for your own needs.':'Забота и передача опыта с вниманием к своим потребностям.'):theme;
 return <section className="luna4-personal-space luna4-birth-discovery" data-testid="birth-discovery" aria-busy={busy}>
  <header><Moon size={20}/><h3>{en?'A first glimpse of you':'Первый штрих к твоему портрету'}</h3><button type="button" onClick={onClose} aria-label={en?'Continue conversation':'Продолжить разговор'}><X size={20}/></button></header>
  {!preview&&!error&&<p role="status">{en?'Checking your date…':'Проверяем твою дату…'}</p>}
  {preview&&<>
   <p className="luna-birth-date">{new Date(date+'T12:00:00Z').toLocaleDateString(en?'en-GB':'ru-RU')}</p>
   <p>{preview.sun.sunSigns.length===1?(en?`Your birth date places the Sun in ${signs[language][preview.sun.sunSigns[0]]}.`:`По твоей дате Солнце находится в знаке ${signs[language][preview.sun.sunSigns[0]]}.`):(en?`Your date falls near a Sun-sign boundary: ${preview.sun.sunSigns.map(n=>signs[language][n]).join(' / ')}. Time and birthplace can clarify it.`:`Твоя дата — на границе знаков: ${preview.sun.sunSigns.map(n=>signs[language][n]).join(' / ')}. Время и место рождения помогут уточнить.`)}</p>
   {reflection&&<p>{reflection.text}</p>}
   <div className="luna-birth-number"><strong>{number}</strong><p><small>{en?'Your life-path number':'Твоё число жизненного пути'}</small>{numberText}</p></div>
   <small>{en?'These are symbolic ways to reflect, not conclusions about your personality. You decide what fits.':'Это символические взгляды для размышления, а не выводы о твоём характере. Ты решаешь, что тебе близко.'}</small>
   {onReflect&&<div className="luna-guided-actions"><button type="button" disabled={busy} onClick={()=>onReflect(en?'I want to understand what gives me support and what gets in my way. Start with one question about a real situation.':'Хочу понять, что даёт мне опору и что мешает. Начни с одного вопроса о реальной ситуации.')}>{en?'Explore what feels true to me':'Разобраться, что мне близко'}</button><button type="button" disabled={busy} onClick={()=>onReflect(en?'This first reflection does not feel like me. Help me explore my strengths through my actual experience instead.':'Этот первый разбор не похож на меня. Помоги понять мои сильные стороны через мой реальный опыт.')}>{en?'It doesn’t feel like me':'Не похоже на меня'}</button></div>}
   {preview.saved?<p role="status"><Check size={16}/>{en?'Your date is saved. You won’t need to enter it again.':'Дата сохранена. Повторно вводить её не нужно.'}</p>:preview.requiresCorrection?<p>{en?'Another birth date is saved. Correct the original profile below; this preview has not replaced it.':'Сохранена другая дата. Исправь исходный профиль ниже; этот просмотр её не заменил.'}</p>:<button type="button" className="luna-button-primary" disabled={busy} onClick={()=>void save()}>{en?'Save my date':'Сохранить мою дату'}</button>}
   {preview.saved&&<CompanionContextConsent language={language} initData={initData} onChanged={onSaved}/>}
   <p>{en?'Want a closer look? Add your birthplace and, if known, exact birth time. They make the Moon more precise; rising and houses require both. You can do this later in My Cosmos.':'Хочешь глубже? Добавь место и, если знаешь, точное время рождения. Так можно уточнить Луну; для асцендента и домов нужны оба значения. Это можно сделать позже в «Моём космосе».'}</p>
   <button type="button" disabled={busy} onClick={()=>void more()}>{en?'Add time & birthplace':'Добавить время и место'} →</button>
   <details className="luna-birth-method"><summary>{en?'What this is based on':'На чём основан разбор'}</summary><p>{en?'The existing astrology engine checks possible Sun positions across time zones, without guessing your birthplace. Date numerology uses the existing Pythagorean calculation. Neither establishes psychological traits.':'Существующий астрологический движок проверяет возможные положения Солнца с учётом часовых поясов, не угадывая место рождения. Числа даты рассчитаны по принятому в Luna пифагорейскому методу. Эти методы не доказывают психологические черты.'}</p></details>
   {editor&&profiles&&profiles.filter(profile=>profile.subject_kind==='self').length>1&&!selectedProfile?<div className="luna-guided-actions"><p>{en?'Choose which of your birth profiles to review.':'Выбери, какие из своих данных рождения проверить.'}</p>{profiles.filter(profile=>profile.subject_kind==='self').map(profile=><button type="button" key={profile.id} onClick={()=>setSelectedProfile(profile.id)}>{profile.display_label} · {profile.birth_date}</button>)}</div>:editor&&profiles&&<BirthProfileEditor profile={profiles.find(p=>p.id===selectedProfile)??null} profiles={profiles} subjectKind="self" initialDate={date} language={language} initData={initData} onCancel={()=>setEditor(false)} onSaved={async profile=>{setBusy(true);try{const result=await calculateBirthChart(profile.id,initData);setChart(result.chart);setEditor(false);window.dispatchEvent(new Event('luna-personal-data-changed'));onSaved?.();}catch{setError(en?'Your details are saved. The chart could not be calculated; retry in My Cosmos.':'Данные сохранены. Карту не удалось рассчитать; повтори в «Моём космосе».');}finally{setBusy(false);}}}/>}
  </>}
  {chart&&<NatalOverview initData={initData} chart={chart} language={language} onDiscuss={()=>{onClose();window.dispatchEvent(new CustomEvent('luna-discuss-chart',{detail:{chartId:chart.id}}));}}/>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
