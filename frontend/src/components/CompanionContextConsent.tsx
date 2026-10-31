import {useEffect,useRef,useState} from 'react';
import {getMeetLuna,getUniverse,saveMeetLuna,writePersonalMemory,type AppLanguage,type UniverseData} from '../api';
import {companionPreference,companionSettingsKey} from '../../../backend/src/companion-policy';

/** Uses the existing atomic consent step. Never changes a financial setting,
 * copies raw birth inputs to AI, or grants permission merely by mounting. */
export function CompanionContextConsent({language,initData,onChanged}:{language:AppLanguage;initData?:string;onChanged?:()=>void}){
 const en=language==='en',pending=useRef(false);
 const [data,setData]=useState<UniverseData|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 const allowed=(value:UniverseData)=>value.memoryEnabled&&value.profile.ai_context_consent&&companionPreference(value.memories).symbolicAiContext;
 useEffect(()=>{let live=true;getUniverse(initData).then(value=>{if(live)setData(value);}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[initData]);
 async function allow(){
  if(pending.current)return;pending.current=true;setBusy(true);setError(false);
  try{
   const [latest,state]=await Promise.all([getUniverse(initData),getMeetLuna(initData)]);
   const row=latest.memories.find(memory=>memory.memory_key===companionSettingsKey),settings=companionPreference(latest.memories);
   if(!settings.symbolicAiContext)await writePersonalMemory({category:'preferences',key:companionSettingsKey,value:JSON.stringify({...settings,symbolicAiContext:true}),confirmed:true,kind:'fact',sensitiveConsent:false,...(row?{revision:row.revision}:{})},initData,row?.id);
   // The existing RPC updates only consent and memory permission, under its
   // owner/revision/idempotency checks; unrelated profile fields are untouched.
   if(!latest.memoryEnabled||!latest.profile.ai_context_consent)await saveMeetLuna({requestId:crypto.randomUUID(),expectedRevision:state.revision,step:'consent',language,answer:true},initData);
   const verified=await getUniverse(initData);if(!allowed(verified))throw Error('Consent not verified');
   setData(verified);window.dispatchEvent(new Event('luna-personal-data-changed'));onChanged?.();
  }catch{const verified=await getUniverse(initData).catch(()=>null);if(verified&&allowed(verified)){setData(verified);window.dispatchEvent(new Event('luna-personal-data-changed'));onChanged?.();}else setError(true);}
  finally{pending.current=false;setBusy(false);}
 }
 if(data&&allowed(data))return <p className="luna-context-consent-confirmed" role="status">{en?'Personal context is enabled. You can review or withdraw it in My Cosmos.':'Личный контекст включён. Проверить или отозвать разрешение можно в «Моём космосе».'}</p>;
 return <details className="luna-context-consent" data-testid="companion-context-consent"><summary>{en?'Let Luna use this in our conversations':'Чтобы Luna учитывала это в разговоре'}</summary>
  <p>{en?'Optional: allow OpenAI to receive your chosen name, interests, preferences, relevant confirmed memories, calculated Sun-sign range and date numbers for personal responses. Your birth date, time and place stay out of these requests. Full charts have a separate permission. You can withdraw this in My Cosmos.':'По желанию разреши передавать OpenAI выбранное имя, интересы, предпочтения, релевантные подтверждённые записи, рассчитанный диапазон знака Солнца и числа даты для личных ответов. Сами дата, время и место рождения в эти запросы не передаются. Для полной карты — отдельное согласие. Разрешение можно отозвать в «Моём космосе».'}</p>
  <button type="button" disabled={busy} onClick={()=>void allow()}>{busy?(en?'Checking permission…':'Проверяем разрешение…'):(en?'Allow personal context':'Разрешить личный контекст')}</button>
  {error&&<p role="alert">{en?'Could not verify all permissions. You can retry or continue without personalization; review current permissions in My Cosmos.':'Не удалось подтвердить все разрешения. Можно повторить или продолжить без персонализации; действующие разрешения видны в «Моём космосе».'}</p>}
 </details>;
}
