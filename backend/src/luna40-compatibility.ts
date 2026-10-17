import {z} from 'zod';
export const relationshipKinds=['romantic','business','friendship','family'] as const;
export const relationshipKind=z.enum(relationshipKinds);
export type RelationshipKind=z.infer<typeof relationshipKind>;
type Aspect={from:string;to:string;type:string;orb:number};
/** Editorial symbolic index, NOT an astronomical measurement or probability.
 * All evidence is calculated separately by the existing engine. AI never scores. */
export function compatibilityReflection(comparison:{aspects:Aspect[];unknownTime:boolean},relationship:RelationshipKind){
 const dimensions=[{id:'communication',planets:['mercury'],weight:{romantic:1,business:2,friendship:2,family:1.5}},{id:'emotional_support',planets:['moon','venus'],weight:{romantic:2,business:.5,friendship:1,family:2}},{id:'initiative',planets:['sun','mars'],weight:{romantic:1.5,business:2,friendship:1,family:1}},{id:'stability',planets:['saturn','jupiter'],weight:{romantic:1,business:1.5,friendship:1,family:1.5}}] as const;
 const personal=new Set(['sun','moon','mercury','venus','mars','jupiter','saturn']);
 const supported=comparison.aspects.filter(a=>personal.has(a.from)&&personal.has(a.to)&&Number.isFinite(a.orb)&&a.orb>=0&&a.orb<=6&&['trine','sextile','square','opposition','conjunction'].includes(a.type));
 const rows=dimensions.map(d=>{const evidence=supported.filter(a=>d.planets.some(p=>p===a.from||p===a.to)).sort((a,b)=>a.orb-b.orb).slice(0,6),flow=evidence.filter(a=>a.type==='trine'||a.type==='sextile').length,tension=evidence.filter(a=>a.type==='square'||a.type==='opposition').length;return{id:d.id,weight:d.weight[relationship],evidence,flow,tension,conjunctions:evidence.length-flow-tension};});
 const sufficient=!comparison.unknownTime&&supported.length>=6&&rows.filter(d=>d.evidence.length>=2).length>=3;
 const usable=rows.filter(d=>d.evidence.length),mean=usable.reduce((sum,d)=>sum+(d.flow-d.tension)/d.evidence.length*d.weight,0)/Math.max(1,usable.reduce((sum,d)=>sum+d.weight,0));
 return{version:'luna40-symbolic-index-v1',relationship,index:sufficient?Math.round(50+35*Math.tanh(mean)):null,scale:100,dimensions:rows,reason:sufficient?null:comparison.unknownTime?'unknown_birth_time':'insufficient_supported_aspects',methodology:'Personal-planet major aspects (orb ≤6°); each dimension uses up to six closest links. Flowing +1, contrasting −1, conjunction 0. Relationship-specific dimension weights; 50 + 35 × tanh(weighted mean). Editorial convention only, not a percentage, scientific assessment, probability or prediction. Missing evidence never means incompatibility.'};
}
