import {Sparkles} from 'lucide-react';
import type {AppLanguage,ProfileStats} from '../../api';
export function JourneyV3Hero({status,language,onOpen}:{status:NonNullable<ProfileStats['journeyV3']>;language:AppLanguage;onOpen:()=>void}){
 const en=language==='en',name=status.current?.names[language]??(en?'Your first step':'Ваш первый шаг'),next=status.next;
 const remaining=next?[[next.remaining.days,en?'more active days':'активных дней осталось'],[next.remaining.moments,en?'more meaningful moments':'осмысленных действий осталось'],[next.remaining.directions,en?'more directions to explore':'направлений осталось попробовать']] as const:[];
 return <button type="button" className="progress-v5-status progress-v3-enter" onClick={onOpen} aria-label={en?`Journey status: ${name}. Open all statuses.`:`Статус пути: ${name}. Открыть все статусы.`}>
  <div className="progress-v5-status-heading"><span className="progress-v5-status-seal" aria-hidden="true"><Sparkles size={27}/></span><div className="progress-v5-status-copy"><p className="progress-v3-eyebrow">{en?'Your status':'Ваш статус'}</p><h2>{name}</h2><p>{en?'Your own rhythm of self-discovery.':'Ваш собственный ритм самопознания.'}</p></div><span className="progress-v5-status-rank">{Math.max(0,status.rank+1)} / 10</span></div>
  {next?<div className="progress-v5-status-progress"><div className="progress-v5-status-progress-label"><span>{en?'Next status':'Следующий статус'}</span><strong>{next.names[language]}</strong><b>{next.progressPercent}%</b></div><div className="progress-v5-status-progress-track" aria-label={`${next.progressPercent}%`}><span style={{width:`${next.progressPercent}%`}}/></div><div className="progress-v5-status-requirements">{remaining.filter(([n])=>n>0).map(([n,label])=><span key={label}>{n} {label}</span>)}</div></div>:<p className="progress-v5-status-complete"><Sparkles size={14}/>{en?'Your constellation is complete':'Ваше созвездие собрано'}</p>}
 </button>;
}
