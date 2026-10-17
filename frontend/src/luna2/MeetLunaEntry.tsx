import {useEffect,useState} from 'react';
import {Stars,ChevronRight} from 'lucide-react';
import {getMeetLuna,type AppLanguage,type MeetLunaState} from '../api';
import {featureFlags} from '../config/featureFlags';
export function MeetLunaEntry({language,initData}:{language:AppLanguage;initData?:string}){
 const [state,setState]=useState<MeetLunaState|null>(null),en=language==='en';
 useEffect(()=>{if(!featureFlags.cosmos_v2)return;let active=true;getMeetLuna(initData).then(r=>{if(active)setState(r);}).catch(()=>{});return()=>{active=false;};},[initData]);
 if(!featureFlags.cosmos_v2||!state)return null;const done=Boolean(state.meet.finishedAt),started=Boolean(state.meet.completed?.length||state.meet.skipped?.length);
 return <button type="button" className="meet42-home-entry" onClick={()=>window.dispatchEvent(new CustomEvent('luna-open-destination',{detail:{destination:done?'cosmos':'meet'}}))}><Stars size={20}/><span>{done?(en?'My Universe':'Мой космос'):started?(en?'Continue meeting Luna':'Продолжить знакомство'):(en?'Meet Luna':'Познакомиться с Луной')}</span><ChevronRight size={18}/></button>;
}
