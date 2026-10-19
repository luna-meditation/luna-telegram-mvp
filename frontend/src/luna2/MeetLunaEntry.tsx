import {useEffect,useState} from 'react';
import {Stars,ChevronRight} from 'lucide-react';
import {getUniverse,type AppLanguage} from '../api';
import {featureFlags} from '../config/featureFlags';
export function MeetLunaEntry({language,initData}:{language:AppLanguage;initData?:string}){
 const [known,setKnown]=useState<boolean|null>(null),en=language==='en';
 useEffect(()=>{if(!featureFlags.cosmos_v2)return;let active=true;getUniverse(initData).then(r=>{if(active)setKnown(Boolean(r.profile.display_name||r.memories.some(m=>m.confirmation_status==='confirmed'&&m.memory_key!=='companion_settings')));}).catch(()=>{});return()=>{active=false;};},[initData]);
 if(!featureFlags.cosmos_v2||known===null)return null;
 return <button type="button" className="meet42-home-entry" onClick={()=>window.dispatchEvent(new CustomEvent('luna-open-destination',{detail:{destination:known?'cosmos':'meet'}}))}><Stars size={20}/><span>{known?(en?'My Universe':'Мой космос'):(en?'Meet Luna':'Познакомиться с Луной')}</span><ChevronRight size={18}/></button>;
}
