import {Sun,Moon,Orbit} from 'lucide-react';
import type {AppLanguage,NatalChart} from '../../api';
import {natalCorePlacements} from './natalOverviewModel';
export function NatalOverview({chart,language,onDiscuss}:{chart:NatalChart;language:AppLanguage;onDiscuss:(planet?:string)=>void}){
 const en=language==='en',icons=[Sun,Moon,Orbit];
 return <section className="luna3-natal-overview" aria-label={en?'Your chart at a glance':'Твоя карта в главном'}><h3>{en?'Your celestial signature':'Твой звёздный портрет'}</h3><div className="luna3-big-three">{natalCorePlacements(chart.calculation,language).map((placement,i)=>{const Icon=icons[i];return <article key={placement.id} className={'tone-'+placement.id}><Icon size={26} aria-hidden="true"/><span>{placement.label}</span><strong>{placement.sign}</strong><small>{placement.theme}</small>{placement.uncertain&&<small>{en?'Two possible signs · time unknown':'Два возможных знака · время неизвестно'}</small>}</article>;})}</div><p>{en?'These are calculated placements. Their meanings are symbolic prompts for reflection, not fixed traits or predictions.':'Это рассчитанные положения. Их смысл — символическая тема для размышления, а не неизменные черты или предсказание.'}</p><button type="button" className="luna32-analysis-primary" onClick={()=>onDiscuss()}>{en?'Explore my chart with Luna':'Обсудить мою карту с Луной'} →</button></section>;
}
