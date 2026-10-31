import {useEffect,useState} from 'react';
import {calculateBirthChart,getBirthProfiles,previewBirthDiscovery,confirmBirthDiscovery,type AppLanguage,type BirthProfile,type BirthDiscoveryPreview} from '../api';
import {BirthProfileEditor} from '../features/astrology/BirthProfileEditor';
import {explicitBirthDate} from '../../../backend/src/birth-discovery-policy';

/** Edits the existing canonical owner-bound record, inside My Cosmos. */
export function CosmosBirthEditor({language,initData,initialDate,onDone}:{language:AppLanguage;initData?:string;initialDate?:string|null;onDone:()=>void}){
 const en=language==='en';
 const [profiles,setProfiles]=useState<BirthProfile[]|null>(null),[selected,setSelected]=useState<string|undefined>(),[error,setError]=useState(false),[attempt,setAttempt]=useState(0),[calculating,setCalculating]=useState(false),[savedId,setSavedId]=useState<string|null>(null),[calculationError,setCalculationError]=useState(false);
 const [fullDetails,setFullDetails]=useState(false),[dateDraft,setDateDraft]=useState(initialDate??''),[dateSource,setDateSource]=useState<BirthDiscoveryPreview|null>(null),[dateError,setDateError]=useState(false),[dateBusy,setDateBusy]=useState(false);
 useEffect(()=>{let live=true;setError(false);getBirthProfiles(initData).then(result=>{if(!live)return;setProfiles(result.profiles);const own=result.profiles.filter(profile=>profile.subject_kind==='self');setSelected(own.length===1?own[0].id:undefined);}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[initData,attempt]);
 const own=profiles?.filter(profile=>profile.subject_kind==='self')??[];
 const dateOnly=Boolean(profiles&&!own.length&&initialDate&&!fullDetails);
 useEffect(()=>{if(!dateOnly||!initialDate)return;let live=true;setDateSource(null);setDateError(false);previewBirthDiscovery(initialDate,initData).then(value=>{if(live){if(!value.saved)setDateError(true);else setDateSource(value);}}).catch(()=>{if(live)setDateError(true);});return()=>{live=false;};},[dateOnly,initialDate,initData]);
 async function saveDate(){if(!dateSource||dateBusy||!explicitBirthDate(dateDraft))return;setDateBusy(true);setDateError(false);try{await confirmBirthDiscovery(dateDraft,dateSource.expectedUpdatedAt,initData);window.dispatchEvent(new Event('luna-personal-data-changed'));onDone();}catch{setDateError(true);}finally{setDateBusy(false);}}
 async function recalculate(id:string){setCalculating(true);setCalculationError(false);try{await calculateBirthChart(id,initData);window.dispatchEvent(new Event('luna-personal-data-changed'));onDone();}catch{setCalculationError(true);}finally{setCalculating(false);}}
 return <section className="cosmos-birth-editor" data-testid="cosmos-birth-editor">
  <header className="cosmos-detail-heading"><p>{en?'My Cosmos':'Мой космос'}</p><h1>{en?'My birth details':'Мои данные рождения'}</h1></header>
  <p>{en?'Change the original details here. Luna will recalculate your chart from the saved profile. Exact time is optional; rising and houses need both time and place.':'Измени исходные данные здесь. Luna пересчитает карту по сохранённому профилю. Точное время необязательно; для асцендента и домов нужны и время, и место.'}</p>
  {error&&<p role="alert">{en?'Could not load the profiles. No details were changed.':'Не удалось загрузить профили. Данные не изменены.'}<button type="button" onClick={()=>setAttempt(value=>value+1)}>{en?'Retry':'Повторить'}</button></p>}
  {!profiles&&!error&&<p role="status">{en?'Opening your details…':'Открываем твои данные…'}</p>}
  {profiles&&own.length>1&&!selected&&<div>{own.map(profile=><button type="button" key={profile.id} onClick={()=>setSelected(profile.id)}>{profile.display_label} · {profile.birth_date}</button>)}</div>}
  {dateOnly&&<form className="luna30-birth-form" data-testid="cosmos-date-only-editor" onSubmit={event=>{event.preventDefault();void saveDate();}}>
   <p>{en?'Saved date':'Сохранённая дата'}: {initialDate?.split('-').reverse().join('.')}</p>
   <label>{en?'Birth date':'Дата рождения'}<input type="date" required min="1800-01-01" max={new Date().toISOString().slice(0,10)} disabled={dateBusy} value={dateDraft} onChange={event=>setDateDraft(event.target.value)}/></label>
   <p>{en?'Time and place are optional. You can correct the date on its own.':'Время и место необязательны. Дату можно исправить отдельно.'}</p>
   {dateError&&<p role="alert">{en?'The saved details changed or could not be verified. Return to your portrait and reopen before saving.':'Данные изменились или их не удалось проверить. Вернись к портрету и открой редактор заново перед сохранением.'}</p>}
   <button type="submit" disabled={!dateSource||dateError||dateBusy||!explicitBirthDate(dateDraft)}>{en?'Confirm birth date':'Подтвердить дату рождения'}</button>
   <button type="button" disabled={dateBusy} onClick={()=>setFullDetails(true)}>{en?'Add time & birthplace':'Добавить время и место'} →</button>
  </form>}
  {profiles&&(own.length<=1||selected)&&!savedId&&!dateOnly&&<BirthProfileEditor key={selected??'new'} profile={own.find(profile=>profile.id===selected)??null} profiles={profiles} subjectKind="self" initialDate={dateDraft||initialDate||undefined} language={language} initData={initData} onCancel={onDone} onSaved={async profile=>{
   setSavedId(profile.id);window.dispatchEvent(new Event('luna-personal-data-changed'));await recalculate(profile.id);
  }}/>}
  {calculating&&<p role="status">{en?'Details saved. Calculating your chart…':'Данные сохранены. Рассчитываем карту…'}</p>}
  {calculationError&&savedId&&<div role="alert"><p>{en?'Your details are saved. The chart could not be calculated yet.':'Данные сохранены. Карту пока не удалось рассчитать.'}</p><button type="button" disabled={calculating} onClick={()=>void recalculate(savedId)}>{en?'Retry calculation':'Повторить расчёт'}</button><button type="button" onClick={onDone}>{en?'Return to my portrait':'Вернуться к портрету'}</button></div>}
 </section>;
}
