import type {AppLanguage,UniverseData} from '../api';
import {meetInterestOptions} from '../../../backend/src/luna42-meet-config';
export function MeetLunaSummary({data,name,language}:{data:UniverseData;name:string;language:AppLanguage}){
 const en=language==='en',confirmed=data.memories.filter(m=>m.confirmation_status==='confirmed');
 let interests:string[]=data.profile.interests;
 try{const ids=JSON.parse(confirmed.find(m=>m.memory_key==='meet_interests')?.memory_value??'null');if(Array.isArray(ids)&&ids.every(id=>meetInterestOptions.some(option=>option[0]===id)))interests=ids;}catch{/* Older profile interests remain valid. */}
 const labels=interests.map(id=>meetInterestOptions.find(option=>option[0]===id)?.[en?1:2]).filter(Boolean),priority=confirmed.find(m=>m.memory_key==='meet_priority')?.memory_value;
 const rows=[[en?'Preferred name':'Обращение',name||'—'],[en?'Interests':'Интересы',labels.join(' · ')||(en?'Still exploring':'Пока знакомлюсь')],[en?'Current priority':'Сейчас важно',priority||(en?'Not shared':'Не указано')],[en?'Birth profile':'Данные рождения',data.profile.birth_date?(en?'Saved · time may be unknown':'Сохранены · время может быть неизвестно'):(en?'Optional · not added':'Необязательно · не добавлены')],[en?'Personalization':'Персонализация',data.contextConsent&&data.memoryEnabled?(en?'Enabled by you':'Включена тобой'):(en?'Not enabled':'Не включена')]];
 return <dl className="meet42-summary">{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
