import {z} from 'zod';
export const relationshipKinds=['romantic','business','friendship','family'] as const;
export const relationshipKind=z.enum(relationshipKinds);
export type RelationshipKind=z.infer<typeof relationshipKind>;
type Aspect={from:string;to:string;type:string;orb:number};
/** Editorial symbolic index, NOT an astronomical measurement or probability.
 * All evidence is calculated separately by the existing engine. AI never scores. */
export function compatibilityReflection(comparison:{aspects:Aspect[];unknownTime:boolean},relationship:RelationshipKind){
 const dimensions=[
  {id:'communication',planets:['mercury'],weight:{romantic:1.5,business:2,friendship:2,family:1.5}},
  {id:'emotional_support',planets:['moon','venus'],weight:{romantic:2,business:.5,friendship:1.5,family:2}},
  {id:'everyday',planets:['moon','saturn'],weight:{romantic:1.5,business:1.5,friendship:1,family:2}},
  {id:relationship==='business'?'work_rhythm':relationship==='friendship'?'shared_interests':relationship==='family'?'shared_time':'romantic_dynamics',planets:relationship==='business'?['sun','mars','mercury']:['venus','mars'],weight:{romantic:2,business:2,friendship:1.5,family:1}},
  {id:'stability',planets:['saturn','jupiter'],weight:{romantic:1.5,business:2,friendship:1,family:1.5}}
 ] as const;
 const personal=new Set(['sun','moon','mercury','venus','mars','jupiter','saturn']);
 const supported=comparison.aspects.filter(a=>personal.has(a.from)&&personal.has(a.to)&&Number.isFinite(a.orb)&&a.orb>=0&&a.orb<=6&&['trine','sextile','square','opposition','conjunction'].includes(a.type));
 const rows=dimensions.map(d=>{const evidence=supported.filter(a=>d.planets.some(p=>p===a.from||p===a.to)).sort((a,b)=>a.orb-b.orb||[a.from,a.to,a.type].join(':').localeCompare([b.from,b.to,b.type].join(':'))).slice(0,6),flow=evidence.filter(a=>a.type==='trine'||a.type==='sextile').length,tension=evidence.filter(a=>a.type==='square'||a.type==='opposition').length;
  const signed=evidence.reduce((sum,a)=>sum+(a.type==='trine'||a.type==='sextile'?1:a.type==='square'||a.type==='opposition'?-1:0)*(1-a.orb/12),0),weight=evidence.reduce((sum,a)=>sum+1-a.orb/12,0);
  return{id:d.id,weight:d.weight[relationship],evidence,flow,tension,conjunctions:evidence.length-flow-tension,score:evidence.length>=2?Math.round(50+35*Math.tanh(signed/weight)):null};});
 const sufficient=!comparison.unknownTime&&supported.length>=6&&rows.filter(d=>d.evidence.length>=2).length>=3;
 const usable=rows.filter(d=>d.score!==null),index=sufficient?Math.round(usable.reduce((sum,d)=>sum+d.score!*d.weight,0)/usable.reduce((sum,d)=>sum+d.weight,0)):null;
 return{version:'luna42-symbolic-index-v2',relationship,index,scale:100,dimensions:rows.map(d=>({...d,score:comparison.unknownTime?null:d.score})),coverage:{birthTime:comparison.unknownTime?'incomplete':'known',supportedAspectCount:supported.length,scoredDimensions:sufficient?usable.length:0},reason:sufficient?null:comparison.unknownTime?'unknown_birth_time':'insufficient_supported_aspects',methodology:'Personal-planet major aspects (orb ≤6°); each dimension uses up to six closest links with stable tie ordering. Flowing +1, contrasting −1, conjunction 0; closeness weight 1 − orb/12. Component = round(50 + 35 × tanh(weighted signed mean)), minimum two links. Overall is the relationship-weighted mean of available components; minimum six supported aspects and three covered dimensions, with known birth times. Editorial convention only, not a percentage, scientific assessment, probability or prediction. Missing evidence never means incompatibility.'};
}
