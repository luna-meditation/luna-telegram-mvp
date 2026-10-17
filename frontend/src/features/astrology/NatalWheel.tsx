import {useState} from 'react';
import type {AppLanguage,NatalCalculation} from '../../api';
import {aspectName,planetTheme,planetGlyphs,planetName,signGlyphs,zodiacNames,zodiacPosition} from './chartCopy';
import {planetLabelAngles} from './planetLayout';
import {noteProgress} from '../progress/evidence';
const point=(degree:number,r:number)=>{const a=(degree-180)*Math.PI/180;return{x:160+r*Math.cos(a),y:160-r*Math.sin(a)};};
export function NatalWheel({chart,language,chartId,initData}:{chart:NatalCalculation;language:AppLanguage;chartId?:string;initData?:string}){
 const [selected,setSelected]=useState('sun');const active=chart.planets.find(p=>p.id===selected);const uncertain=new Set(chart.uncertainPlanets.map(p=>p.id));
 const displayAngles=planetLabelAngles(chart.planets);
 return <section className="luna30-wheel-card" aria-label={language==='en'?'Calculated birth chart':'Рассчитанная натальная карта'}>
  <svg viewBox="0 0 320 320" className="luna30-natal-wheel" role="img" aria-label={language==='en'?'Tropical zodiac chart. All positions are listed below.':'Тропический зодиак. Все положения доступны списком ниже.'}>
   <defs><radialGradient id="luna30-chart-glow"><stop offset="0" stopColor="var(--luna30-wheel-glow)"/><stop offset="1" stopColor="transparent"/></radialGradient></defs>
   <circle cx="160" cy="160" r="159" fill="url(#luna30-chart-glow)"/>
   {[145,116,92].map(r=><circle key={r} cx="160" cy="160" r={r} fill="none" className="luna30-wheel-line"/>)}
   {signGlyphs.map((glyph,i)=>{const outer=point(i*30,145),inner=point(i*30,92),label=point(i*30+15,131);return<g key={glyph}><line x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} className="luna30-wheel-line"/><text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central" className="luna30-wheel-sign">{glyph}</text></g>;})}
   {chart.aspects.slice(0,24).map(a=>{const first=chart.planets.find(p=>p.id===a.from),second=chart.planets.find(p=>p.id===a.to);if(!first||!second)return null;const p=point(first.longitude,84),q=point(second.longitude,84);return<line key={a.from+a.to} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className={`luna30-wheel-aspect ${a.type==='trine'||a.type==='sextile'?'is-harmonious':''}`}/>;})}
   {chart.planets.map(p=>{const location=point(displayAngles[p.id],103),anchor=point(p.longitude,86);return<g key={p.id} opacity={uncertain.has(p.id)?.45:1}><line x1={anchor.x} y1={anchor.y} x2={location.x} y2={location.y} className="luna31-planet-leader"/><circle cx={location.x} cy={location.y} r="11" className="luna30-wheel-planet-bg"/><text x={location.x} y={location.y} textAnchor="middle" dominantBaseline="central" className="luna30-wheel-planet">{planetGlyphs[p.id]}</text></g>;})}
   <circle cx="160" cy="160" r="32" className="luna30-wheel-centre"/><text x="160" y="165" textAnchor="middle" className="luna30-wheel-moon">☾</text>
  </svg>
  <div className="luna30-planet-controls" aria-label={language==='en'?'Choose a planet':'Выбрать планету'}>{chart.planets.map(p=><button key={p.id} type="button" aria-label={planetName(p.id,language)} aria-pressed={selected===p.id} onClick={()=>{setSelected(p.id);noteProgress('placement',chartId,p.id,initData);}}>{planetGlyphs[p.id]}</button>)}</div>
  {active&&<p className="luna30-selected-planet" aria-live="polite"><strong>{planetName(active.id,language)}</strong><span>{uncertain.has(active.id)?chart.uncertainPlanets.find(p=>p.id===active.id)!.signs.map(i=>zodiacNames(language)[i]).join(' / '):chart.timePrecision==='unknown'?zodiacNames(language)[Math.floor(active.longitude/30)]:zodiacPosition(active.longitude,language)}</span></p>}
  {active&&<div className="luna31-planet-detail"><p>{planetTheme(active.id,language)} <small>{language==='en'?'A symbolic theme, not a proven personality trait.':'Символическая тема, а не доказанная черта личности.'}</small></p>{chart.timePrecision==='exact'?<ul>{chart.aspects.filter(a=>a.from===selected||a.to===selected).map(a=><li key={a.from+a.to}><button type="button" onClick={()=>{noteProgress('aspect',chartId,[a.from,a.type,a.to].join(':'),initData);window.dispatchEvent(new CustomEvent('luna-discuss-chart',{detail:{chartId,planet:selected,aspect:{from:a.from,to:a.to,type:a.type}}}));}}>{planetName(a.from===selected?a.to:a.from,language)} · {aspectName(a.type,language)} · {a.orb.toFixed(1)}°</button></li>)}</ul>:<p>{language==='en'?'Exact aspects and houses need a known birth time.':'Для точных аспектов и домов нужно знать время рождения.'}</p>}{chartId&&<button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('luna-discuss-chart',{detail:{chartId,planet:selected}}))}>{language==='en'?`Discuss ${planetName(selected,language)} with Luna`:`Обсудить с Luna: ${planetName(selected,language)}`}</button>}</div>}
 </section>;
}
