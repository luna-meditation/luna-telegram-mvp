import type {AppLanguage,UniverseData} from '../api';
import {meetInterestLabels} from './meetInterests';
export function MeetLunaSummary({data,name,language}:{data:UniverseData;name:string;language:AppLanguage}){
 const en=language==='en',confirmed=data.memories.filter(m=>m.confirmation_status==='confirmed');
 const labels=meetInterestLabels(data,language),priority=confirmed.find(m=>m.memory_key==='meet_priority')?.memory_value;
 const rows=[[en?'Preferred name':'Обращение',name||'—'],[en?'Interests':'Интересы',labels.join(' · ')||(en?'Still exploring':'Пока знакомлюсь')],[en?'Current priority':'Сейчас важно',priority||(en?'Not shared':'Не указано')],[en?'Birth profile':'Данные рождения',data.profile.birth_date?(en?'Saved · time may be unknown':'Сохранены · время может быть неизвестно'):(en?'Optional · not added':'Необязательно · не добавлены')],[en?'Personalization':'Персонализация',data.contextConsent&&data.memoryEnabled?(en?'Enabled by you':'Включена тобой'):(en?'Not enabled':'Не включена')]];
 return <dl className="meet42-summary">{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
