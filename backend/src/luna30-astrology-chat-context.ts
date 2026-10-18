import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {symbolicChartFacts,astrologyReportSchema} from './luna30-astrology-report-policy.js';
import {calculateSynastry,type NatalCalculation} from './luna30-astrology-engine.js';
import {astrologyAttachmentSchema,type AstrologyAttachment} from './luna31-consultation.js';
import {compatibilityReflection} from './luna40-compatibility.js';
import {intelligenceReference} from './luna-intelligence-context.js';
export async function verifiedAstrologyChatContext(db:SupabaseClient,owner:number,input:string|AstrologyAttachment){
 const attachment=astrologyAttachmentSchema.parse(typeof input==='string'?{chartId:input}:input);
 const gate=await db.from('luna30_release_settings').select('astrology_enabled,astrology_ai_enabled').eq('id',true).single();
 if(gate.error||!gate.data?.astrology_enabled||!gate.data?.astrology_ai_enabled)throw new FoundationError(503,'astrology_unavailable','Calculated astrology is unavailable.');
 async function chart(id:string){const {data,error}=await db.from('luna30_chart_cache').select('id,profile_id,calculation').eq('telegram_id',owner).eq('id',id).maybeSingle();if(error||!data)throw new FoundationError(404,'chart_not_found','Reopen your calculated chart.');return data;}
 const first=await chart(attachment.chartId),second=attachment.secondChartId?await chart(attachment.secondChartId):null;
 const selectedAspect=attachment.aspect?(first.calculation as NatalCalculation).aspects.find(a=>a.from===attachment.aspect!.from&&a.to===attachment.aspect!.to&&a.type===attachment.aspect!.type):null;
 if(attachment.aspect&&!selectedAspect)throw new FoundationError(422,'aspect_not_found','Select an aspect actually calculated for this chart.');
 if(second?.profile_id===first.profile_id)throw new FoundationError(400,'different_charts_required','Two different profiles are required.');
 const compact=(calculation:NatalCalculation)=>{
  const facts=symbolicChartFacts(calculation);
  const relevant=calculation.aspects.filter(a=>!attachment.planet||a.from===attachment.planet||a.to===attachment.planet).sort((a,b)=>a.orb-b.orb).slice(0,10);
  return {precision:facts.precision,placements:Object.fromEntries(facts.planets.map(p=>[p.planet,p.signs.join('/')+(facts.precision==='exact'?' '+((calculation.planets.find(v=>v.id===p.planet)!.longitude%30+30)%30).toFixed(2)+'°':'')])),ascendant:facts.ascendant,houseSigns:facts.houseSigns.join(','),aspects:relevant,warnings:facts.warnings.join(',')};
 };
 let report:unknown=null;
 if(attachment.reportId){const result=await db.from('luna30_astrology_reports').select('id,first_chart_id,second_chart_id,report').eq('telegram_id',owner).eq('id',attachment.reportId).maybeSingle();if(result.error||!result.data||result.data.first_chart_id!==first.id||(result.data.second_chart_id??null)!==(second?.id??null))throw new FoundationError(404,'report_not_found','Reopen the saved report.');const saved=astrologyReportSchema.parse(result.data.report);report={summary:saved.summary.slice(0,400),sections:saved.sections.map(s=>({id:s.id,title:s.title,text:s.text.slice(0,200)})),question:saved.question};}
 const synastry=second?calculateSynastry(first.calculation,second.calculation):null;
 let reflection=synastry&&attachment.relationship?compatibilityReflection(synastry,attachment.relationship):null;
 if(attachment.comparisonId){const saved=await db.from('ai_messages').select('metadata').eq('telegram_id',owner).eq('id',attachment.comparisonId).eq('role','assistant').maybeSingle();const snapshot=saved.data?.metadata?.astrologyWorkflow?.compatibilitySnapshot;
  if(saved.error||!snapshot||snapshot.firstChartId!==first.id||snapshot.secondChartId!==second?.id||snapshot.reflection?.relationship!==attachment.relationship)throw new FoundationError(404,'report_not_found','Reopen your saved comparison.');reflection=snapshot.reflection;
 }
 return {reference:intelligenceReference({astrology:attachment}),calculationVersion:(first.calculation as {engineVersion?:string}).engineVersion??'astronomy-engine',first:compact(first.calculation),...(second&&synastry?{second:compact(second.calculation),synastry:{...synastry,aspects:synastry.aspects.sort((a,b)=>a.orb-b.orb).slice(0,5)}}:{}),relationship:attachment.relationship??null,relationshipClarificationRequired:Boolean(second&&!attachment.relationship),compatibilityReflection:reflection,comparisonId:attachment.comparisonId??null,selectedPlanet:attachment.planet??null,selectedAspect:selectedAspect??null,savedReport:report};
}
