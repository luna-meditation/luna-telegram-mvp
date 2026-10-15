import {useEffect,useState} from 'react';
import {getPersonalProfile,savePersonalProfile,deletePersonalProfile,type PersonalProfile,type AppLanguage} from '../api';
import {featureFlags} from '../config/featureFlags';
const empty:PersonalProfile={display_name:null,interests:[],preferences:'',birth_date:null,birth_time:null,birth_place:null,ai_context_consent:false};
type Feedback='loaded-error'|'saved'|'save-error'|'deleted'|'delete-error'|null;

export function PersonalizationSettings({language,firstName,initData,onClose,onLanguageChange}:{language:AppLanguage;firstName:string;initData?:string;onClose:()=>void;onLanguageChange?:(language:AppLanguage)=>void}){
 const en=language==='en';
 const [data,setData]=useState<PersonalProfile>(empty);
 const [busy,setBusy]=useState(true),[ready,setReady]=useState(false),[feedback,setFeedback]=useState<Feedback>(null);
 // Switching language must not discard an unfinished optional setup.
 useEffect(()=>{let active=true;getPersonalProfile(initData).then(value=>{if(active){setData({...empty,...value});setReady(true);}}).catch(()=>{if(active)setFeedback('loaded-error');}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[initData]);
 async function save(){setBusy(true);setFeedback(null);try{setData(await savePersonalProfile(data,initData));setFeedback('saved');}catch{setFeedback('save-error');}finally{setBusy(false);}}
 async function remove(){if(!window.confirm(en?'Delete your optional profile and withdraw AI context consent?':'Удалить необязательный профиль и отозвать согласие на AI-контекст?'))return;setBusy(true);try{await deletePersonalProfile(initData);setData(empty);setFeedback('deleted');}catch{setFeedback('delete-error');}finally{setBusy(false);}}
 const messages:Record<Exclude<Feedback,null>,string>={
  'loaded-error':en?'Could not load your profile. Please return and try again.':'Не удалось загрузить профиль. Вернись и попробуй снова.',
  saved:en?'Saved. You can change or delete this anytime.':'Сохранено. Данные можно изменить или удалить в любой момент.',
  'save-error':en?'Could not save. Your existing data is unchanged.':'Не удалось сохранить. Прежние данные не изменены.',
  deleted:en?'Optional profile deleted. Reading history is managed separately.':'Необязательный профиль удалён. История раскладов удаляется отдельно.',
  'delete-error':en?'Could not delete. Please try again.':'Не удалось удалить. Попробуй снова.'
 };
 const interests=en?['Tarot','Astrology','Self-discovery','Meditation']:['Таро','Астрология','Самопознание','Медитация'];
 return <section className="personalization-settings" data-testid="personalization-settings">
  <p>{en?'Make Luna yours, at your own pace. Everything here is optional.':'Настрой Luna под себя, в своём темпе. Все поля необязательны.'}</p>
  <div className="personalization-identity"><strong>{firstName}</strong><span>{en?'Your Telegram identity stays unchanged.':'Твой аккаунт Telegram остаётся прежним.'}</span></div>
  <fieldset disabled={busy||!ready}><legend>{en?'A little about you':'Немного о тебе'}</legend>
   <label>{en?'What should Luna call you?':'Как Luna к тебе обращаться?'}<input autoComplete="nickname" maxLength={60} placeholder={firstName} value={data.display_name??''} onChange={event=>setData({...data,display_name:event.target.value||null})}/><small>{en?'Used exactly as written. No automatic nicknames.':'Используем именно это имя, без уменьшительных обращений.'}</small></label>
   {onLanguageChange&&<label>{en?'Preferred language':'Предпочитаемый язык'}<select value={language} onChange={event=>onLanguageChange(event.target.value as AppLanguage)}><option value="en">English</option><option value="ru">Русский</option></select></label>}
   <h3>{en?'Your interests':'Твои интересы'}</h3>
   <div className="personalization-interests">{(['tarot','astrology','wellbeing','meditation'] as const).map((interest,index)=><button key={interest} type="button" aria-pressed={data.interests.includes(interest)} onClick={()=>setData({...data,interests:data.interests.includes(interest)?data.interests.filter(i=>i!==interest):[...data.interests,interest]})}>{interests[index]}</button>)}</div>
   <label>{en?'What matters to you right now?':'Какая тема сейчас для тебя важна?'}<textarea maxLength={500} placeholder={en?'A question, a life theme, or how you prefer to talk. You can leave this blank.':'Вопрос, жизненная тема или твои пожелания к общению. Можно оставить пустым.'} value={data.preferences} onChange={event=>setData({...data,preferences:event.target.value})}/></label>
   {(featureFlags.astrology||featureFlags.personal_memory)&&<>
    <h3>{en?'Birth details — optional':'Данные рождения — необязательно'}</h3><p>{en?'No chart is calculated here. Birth details are excluded from AI personalization.':'Здесь карта не рассчитывается. Данные рождения не используются для персонализации AI.'}</p>
    <label>{en?'Birth date':'Дата рождения'}<input type="date" value={data.birth_date??''} onChange={event=>setData({...data,birth_date:event.target.value||null})}/></label>
    <label>{en?'Birth time, if known':'Время рождения, если известно'}<input type="time" value={data.birth_time??''} onChange={event=>setData({...data,birth_time:event.target.value||null})}/></label>
    <label>{en?'Birth place (city, country)':'Место рождения (город, страна)'}<input maxLength={120} value={data.birth_place??''} onChange={event=>setData({...data,birth_place:event.target.value||null})}/></label>
   </>}
   <label className="personalization-consent"><input type="checkbox" checked={data.ai_context_consent} onChange={event=>setData({...data,ai_context_consent:event.target.checked})}/><span>{en?'I allow Luna to send my chosen name, interests, preferences and (when enabled) relevant confirmed memories to its AI provider (OpenAI) for personalized responses. Birth details are excluded.':'Разрешаю Luna отправлять выбранное имя, интересы, предпочтения и (при включении памяти) релевантные подтверждённые записи AI-провайдеру OpenAI для персональных ответов. Данные рождения исключены.'}</span></label>
   <button type="button" className="tarot-draw-button" onClick={()=>void save()}>{en?'Save preferences':'Сохранить предпочтения'}</button><button type="button" className="tarot-text-button" onClick={()=>void remove()}>{en?'Delete optional profile':'Удалить необязательный профиль'}</button>
  </fieldset>
  {feedback&&<p role="status">{messages[feedback]}</p>}
  <button type="button" className="tarot-text-button" onClick={onClose}>{en?'Skip / return to Profile':'Пропустить / вернуться в профиль'}</button>
 </section>;
}
