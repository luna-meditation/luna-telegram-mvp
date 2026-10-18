import {useEffect,useState,type MutableRefObject} from 'react';
import {getUniverse,getBirthProfiles,type UniverseData,type AppLanguage} from '../api';
import {MeetLuna,type MeetChatControl} from '../luna2/MeetLuna';
export type {MeetChatControl} from '../luna2/MeetLuna';
/** Same authenticated seven-step state machine, in the actual chat message
 * list. Text and voice share the real composer; no provider call for a step. */
export function ChatMeetLuna({language,initData,control,onClose}:{language:AppLanguage;initData?:string;control:MutableRefObject<MeetChatControl|null>;onClose:()=>void}){
 const [hasOwnBirth,setHasOwnBirth]=useState(false),[data,setData]=useState<UniverseData|null>(null),[error,setError]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{let live=true;Promise.all([getUniverse(initData),getBirthProfiles(initData).catch(()=>({profiles:[]}))]).then(([value,profiles])=>{if(live){setData(value);setHasOwnBirth(profiles.profiles.some(p=>p.subject_kind==='self'));setError(false);}}).catch(()=>{if(live)setError(true);});return()=>{live=false;control.current=null;};},[initData,revision]);
 if(!data)return <div role={error?'alert':'status'}>{error?(language==='ru'?'Не удалось открыть знакомство. Сохранённые ответы в безопасности.':'Could not open the introduction. Saved answers are safe.'):(language==='ru'?'Открываю наше знакомство…':'Opening our introduction…')}{error&&<button type="button" onClick={()=>setRevision(v=>v+1)}>{language==='ru'?'Повторить':'Retry'}</button>}<button type="button" onClick={onClose}>{language==='ru'?'Вернуться к разговору':'Return to conversation'}</button></div>;
 return <MeetLuna inChat hasOwnBirth={hasOwnBirth} control={control} data={data} language={language} initData={initData} onChanged={async()=>setData(await getUniverse(initData))} onClose={onClose} onBirth={()=>window.dispatchEvent(new CustomEvent('luna-open-destination',{detail:{destination:'birth_editor'}}))} onPrivacy={()=>window.dispatchEvent(new CustomEvent('luna-open-destination',{detail:{destination:'memory'}}))}/>;
}
