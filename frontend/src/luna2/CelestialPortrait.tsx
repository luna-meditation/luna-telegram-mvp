import {useId} from 'react';
import type {AppLanguage,PersonalPortrait} from '../api';
import {zodiacNames} from '../features/astrology/chartCopy';

/** Decorative constellation of verified sources, NOT a natal chart wheel. */
export function CelestialPortrait({portrait,language,onExplore}:{portrait:PersonalPortrait;language:AppLanguage;onExplore:()=>void}){
 const en=language==='en',id=useId().replace(/:/g,''),names=zodiacNames(language),english=zodiacNames('en');
 const sign=(value:string)=>names[english.indexOf(value)]??value;
 const sun=portrait.chart?.facts.planets.find(p=>p.planet.toLowerCase()==='sun'),moon=portrait.chart?.facts.planets.find(p=>p.planet.toLowerCase()==='moon');
 const nodes=[{symbol:'☉',label:en?'Sun':'Солнце',value:sun?.signs.map(sign).join(' / ')??portrait.dateOnlySun?.sunSigns.map(n=>names[n]).join(' / ')},{symbol:'☽',label:en?'Moon':'Луна',value:moon?.signs.map(sign).join(' / ')},{symbol:'↗',label:en?'Rising':'Асцендент',value:portrait.chart?.facts.ascendant?sign(portrait.chart.facts.ascendant):null}];
 return <section className="celestial-portrait" aria-label={en?'A constellation of your sources, not planetary positions':'Созвездие твоих источников, не положения планет'}>
  <svg viewBox="0 0 360 190" aria-hidden="true"><defs><radialGradient id={id}><stop stopColor="#aa8bdf" stopOpacity=".28"/><stop offset="1" stopColor="#aa8bdf" stopOpacity="0"/></radialGradient></defs><ellipse cx="180" cy="95" rx="165" ry="95" fill={`url(#${id})`}/><ellipse cx="180" cy="99" rx="133" ry="51" fill="none" stroke="#b49dd1" strokeOpacity=".25" transform="rotate(-18 180 99)"/><ellipse cx="180" cy="99" rx="101" ry="75" fill="none" stroke="#dbbf87" strokeOpacity=".25" transform="rotate(25 180 99)"/><path d="M52 136L125 48L236 51L306 132L180 151Z" fill="none" stroke="#ddc594" strokeOpacity=".3"/>{[[52,136],[125,48],[236,51],[306,132],[180,151],[85,35],[278,27],[321,72],[35,77],[210,16],[151,177]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i<5?2.6:1.2} fill="#e9d7af" opacity={i<5?.8:.45}/>)}<circle cx="180" cy="99" r="30" fill="#191c38" stroke="#dec38c" strokeOpacity=".6"/><text x="180" y="108" textAnchor="middle" fill="#ead3a2" fontSize="29" fontFamily="Georgia,serif">{portrait.numerology.calculated?portrait.numerology.lifePath:'✦'}</text></svg>
  <button type="button" className="celestial-center" onClick={onExplore} aria-label={en?'Explore the calculated sources of my portrait':'Исследовать расчётные источники портрета'}><span>{portrait.numerology.calculated?(en?'Life path':'Жизненный путь'):(en?'Your story':'Твоя история')}</span><small>{en?'Explore sources ↗':'Открыть источники ↗'}</small></button>
  <div className="celestial-source-row">{nodes.map(node=><button type="button" key={node.label} onClick={onExplore}><span aria-hidden="true">{node.symbol}</span><small>{node.label}</small><strong>{node.value||(en?'Not calculated':'Не рассчитан')}</strong></button>)}</div>
 </section>;
}
