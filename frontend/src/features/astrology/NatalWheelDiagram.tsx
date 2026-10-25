import {useId} from 'react';
import type {AppLanguage,NatalCalculation} from '../../api';
import {planetGlyphs,planetName,signGlyphs,zodiacNames,zodiacPosition} from './chartCopy';
import {planetTouchAngles} from './planetLayout';
import './natal-wheel-diagram.css';

export const natalPoint=(degree:number,r:number)=>{const a=(degree-180)*Math.PI/180;return{x:180+r*Math.cos(a),y:180-r*Math.sin(a)};};
function sector(index:number){const a=natalPoint(index*30,178),b=natalPoint((index+1)*30,178),c=natalPoint((index+1)*30,128),d=natalPoint(index*30,128);return`M${a.x},${a.y} A178,178 0 0,0 ${b.x},${b.y} L${c.x},${c.y} A128,128 0 0,1 ${d.x},${d.y} Z`;}

/** Presentation only: no ephemeris, coordinate, house or aspect calculation. */
export function NatalWheelDiagram({chart,language,selectedPlanet,selectedSign,onPlanet,onSign,interactive=true}:{chart:NatalCalculation;language:AppLanguage;selectedPlanet?:string;selectedSign?:number;onPlanet?:(id:string)=>void;onSign?:(index:number)=>void;interactive?:boolean}){
 const id=useId().replace(/:/g,''),en=language==='en',names=zodiacNames(language),angles=planetTouchAngles(chart.planets);
 const exact=chart.timePrecision==='exact'&&!chart.approximatePlanets;
 const activate=(event:React.KeyboardEvent<SVGGElement>,action:()=>void)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();action();}};
 return <svg viewBox="0 0 360 360" className="natal-orbit" role={interactive?'group':undefined} aria-hidden={!interactive||undefined} aria-label={interactive?(en?'Interactive tropical zodiac. Choose a planet or zodiac sign.':'Интерактивный тропический зодиак. Выбери планету или знак.'):undefined} data-testid="cosmos-natal-wheel" data-precision={chart.timePrecision}>
  <defs><radialGradient id={id+'-sky'}><stop stopColor="#3b365f" stopOpacity=".45"/><stop offset="1" stopColor="#0a1429" stopOpacity=".05"/></radialGradient></defs>
  <circle cx="180" cy="180" r="178" fill={`url(#${id}-sky)`}/>
  <g className="natal-zodiac-sectors">{signGlyphs.map((glyph,index)=>{const p=natalPoint(index*30+15,153);return <g key={index} role={interactive?'button':undefined} tabIndex={interactive?0:undefined} aria-label={interactive?names[index]:undefined} aria-pressed={interactive?selectedSign===index:undefined} onClick={interactive?()=>onSign?.(index):undefined} onKeyDown={interactive?event=>activate(event,()=>onSign?.(index)):undefined} data-sign-index={index}>
   <path d={sector(index)} className="natal-sector-target"/><text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central">{glyph}</text>
  </g>;})}</g>
  {[178,128,82].map(r=><circle key={r} cx="180" cy="180" r={r} className="natal-ring"/>)}
  {Array.from({length:72},(_,i)=>{const a=natalPoint(i*5,177),b=natalPoint(i*5,i%6===0?165:173);return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="natal-tick"/>;})}
  {exact&&<g className="natal-aspects" aria-hidden="true">{chart.aspects.map(a=>{const p=chart.planets.find(p=>p.id===a.from),q=chart.planets.find(p=>p.id===a.to);if(!p||!q)return null;const first=natalPoint(p.longitude,79),second=natalPoint(q.longitude,79),active=a.from===selectedPlanet||a.to===selectedPlanet;return <line key={a.from+':'+a.type+':'+a.to} x1={first.x} y1={first.y} x2={second.x} y2={second.y} data-from={a.from} data-to={a.to} data-aspect={a.type} className={`natal-aspect ${a.type==='trine'||a.type==='sextile'?'is-flow':'is-tension'} ${active?'is-selected':''}`}/>;})}</g>}
  {exact&&chart.ascendant!==null&&(()=>{const a=natalPoint(chart.ascendant,123),b=natalPoint(chart.ascendant,129);return <g aria-hidden="true" className="natal-ascendant"><line x1={a.x} y1={a.y} x2={b.x} y2={b.y}/></g>;})()}
  <g className="natal-centre" aria-hidden="true"><circle cx="180" cy="180" r="27"/><path d="M184 165a16 16 0 1 0 9 27 18 18 0 0 1-9-27Z"/><circle cx="195" cy="167" r="1.2"/><path className="natal-centre-star" d="M176 176v7m-3.5-3.5h7"/></g>
  {exact&&chart.planets.map(planet=>{const p=natalPoint(angles[planet.id],102),anchor=natalPoint(planet.longitude,82);return <g key={planet.id} role={interactive?'button':undefined} tabIndex={interactive?0:undefined} aria-label={interactive?`${planetName(planet.id,language)} · ${zodiacPosition(planet.longitude,language)}`:undefined} aria-pressed={interactive?selectedPlanet===planet.id:undefined} className="natal-planet-target" onClick={interactive?()=>onPlanet?.(planet.id):undefined} onKeyDown={interactive?event=>activate(event,()=>onPlanet?.(planet.id)):undefined} data-planet={planet.id} data-longitude={planet.longitude}>
   <line x1={anchor.x} y1={anchor.y} x2={p.x} y2={p.y} className="natal-leader"/><circle cx={anchor.x} cy={anchor.y} r="2" className="natal-anchor"/><circle cx={p.x} cy={p.y} r="25" className="natal-hit"/><circle cx={p.x} cy={p.y} r="15" className="natal-planet-halo"/><text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central">{planetGlyphs[planet.id]}</text>
  </g>;})}
 </svg>;
}
