import type {AppLanguage,SynastryResult} from '../../api';
import {compatibilitySummary} from './compatibilitySummaryPolicy';
import './compatibility42.css';
export function CompatibilitySummary({comparison,language,onFollowUp,disabled=false}:{comparison:SynastryResult;language:AppLanguage;onFollowUp?:(prompt:string)=>void;disabled?:boolean}){
 const en=language==='en',r=comparison.reflection,summary=compatibilitySummary(comparison,language);
 return <section className="compatibility42" data-testid="compatibility-summary">
  <div className="compatibility42-score"><strong>{r?.index??'—'}</strong>{r?.index!==null&&r?.index!==undefined&&<span>/ 100</span>}<small>{en?'Symbolic compatibility index':'Символический индекс совместимости'}</small></div>
  {r?.index===null&&<p className="compatibility42-limitation">{comparison.unknownTime?(en?'Birth time is incomplete: no precise index, houses or Ascendant are used.':'Время рождения неполное: точный индекс, дома и асцендент не используются.'):(en?'There is not enough supported evidence for an index.':'Для индекса недостаточно подтверждённых связей.')}</p>}
  <div className="compatibility42-insights"><article><h4>{en?'Where you connect':'Что вас сближает'}</h4><p>{summary.strength}</p></article><article><h4>{en?'Worth discussing':'Что стоит обсудить'}</h4><p>{summary.challenge}</p></article><article><h4>{en?'Try in everyday life':'Попробуйте в жизни'}</h4><p>{summary.practical}</p></article></div>
  <small>{en?'An editorial astrology framework, not a prediction of relationship success.':'Редакционная астрологическая модель, не прогноз успеха отношений.'}</small>
  {onFollowUp&&<div className="compatibility42-actions">{summary.actions.map(prompt=><button key={prompt} type="button" disabled={disabled} onClick={()=>onFollowUp(prompt)}>{prompt}</button>)}</div>}
 </section>;
}
