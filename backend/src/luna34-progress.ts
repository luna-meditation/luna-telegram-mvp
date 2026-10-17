import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {FoundationError} from './foundation-error.js';
import {luna34Achievements,type Luna34Metrics} from './luna34-achievements.js';
import {tarotCatalog} from './tarot-policy.js';
import {calculateCelestialMonth,calculateSynastry,type NatalCalculation} from './luna30-astrology-engine.js';

export const progressEventSchema=z.object({kind:z.enum(['reading_reveal','card_detail','natal_detail','placement','aspect','comparison','compatibility_theme','calendar_date','path_theme']),entityId:z.string().uuid(),detail:z.string().max(100).default(''),secondChartId:z.string().uuid().optional()}).strict();
const unavailable=()=>new FoundationError(503,'progress_unavailable','Your saved progress remains unchanged.');
export function createLuna34Progress(db:SupabaseClient,onReadingComplete?:(owner:number,readingId:string)=>Promise<unknown>){
 const service={
  async snapshot(owner:number){const result=await db.rpc('luna34_sync_achievements',{p_owner:owner});if(result.error){if(result.error.code==='PGRST202')return null;throw unavailable();}if(!result.data?.enabled)return null;
   const stored=new Map<string,{unlockedAt:string|null;progress:number;current:number;target:number;celebrationPending:boolean}>((result.data.items??[]).map((r:{id:string})=>[r.id,r]));
   const items=luna34Achievements.map(definition=>{const row=stored.get(definition.id);if(!row)throw unavailable();return {id:definition.id,title:definition.title.en,description:definition.description.en,category:definition.category,art:definition.art,unlocked:Boolean(row.unlockedAt),...row};});
   return {version:34 as const,metrics:result.data.metrics as Luna34Metrics,unlocked:items.filter(i=>i.unlocked).length,total:50,items};
  },
  async record(owner:number,body:unknown){
   const input=progressEventSchema.parse(body);let detail=input.detail;
   const enabled=await db.from('luna34_progress_settings').select('enabled').eq('id',true).maybeSingle();if(enabled.error||!enabled.data?.enabled)return {recorded:false};
   if(input.kind==='reading_reveal'||input.kind==='card_detail'){
    const r=await db.from('luna_tarot_readings').select('id,card_id,cards,reading_kind,status').eq('telegram_id',owner).eq('id',input.entityId).maybeSingle();if(r.error)throw unavailable();if(!r.data)throw new FoundationError(404,'reading_not_found','Reading not found.');
    const cards=[r.data.card_id,...(Array.isArray(r.data.cards)?r.data.cards.map((c:{cardId:string})=>c.cardId):[])];
    if(detail!=='complete'&&(!cards.includes(detail)||!tarotCatalog.some(c=>c.id===detail)))throw new FoundationError(422,'invalid_progress_evidence','Open a card in this saved reading.');
    if(input.kind==='card_detail'&&detail==='complete')throw new FoundationError(422,'invalid_progress_evidence','Choose a specific revealed card.');
    if(input.kind==='reading_reveal'&&detail==='complete'){
     const expected=new Set(cards),evidence=await db.from('luna34_progress_events').select('detail').eq('telegram_id',owner).eq('entity_id',input.entityId).eq('kind','reading_reveal');if(evidence.error)throw unavailable();
     if(!['local','ready','fallback'].includes(r.data.status)||![...expected].every(card=>evidence.data?.some(e=>e.detail===card)))throw new FoundationError(409,'reading_not_revealed','Reveal every card before completing the reading.');
    }
    if(input.kind==='card_detail'){
     const evidence=await db.from('luna34_progress_events').select('detail').eq('telegram_id',owner).eq('entity_id',input.entityId).eq('kind','reading_reveal');if(evidence.error)throw unavailable();
     if(!['ready','fallback'].includes(r.data.status)&&!evidence.data?.some(e=>e.detail===detail||e.detail==='complete'))throw new FoundationError(409,'card_not_revealed','Reveal this card first.');
    }
   }else if(input.kind==='calendar_date'){
    if(input.entityId!=='00000000-0000-4000-8000-000000000034'||!/^\d{4}-\d{2}-\d{2}$/.test(detail)||detail<'1800-01-01'||detail>'2100-12-31'||!calculateCelestialMonth(detail.slice(0,7)).days.some(d=>d.date===detail))throw new FoundationError(422,'invalid_progress_evidence','Choose a calculated calendar date.');
   }else{
    const chart=await db.from('luna30_chart_cache').select('id,calculation').eq('telegram_id',owner).eq('id',input.entityId).maybeSingle();if(chart.error)throw unavailable();if(!chart.data)throw new FoundationError(404,'chart_not_found','Select your saved chart.');const calculation=chart.data.calculation as NatalCalculation;
    if(input.kind==='placement'&&!calculation.planets.some(p=>p.id===detail))throw new FoundationError(422,'invalid_progress_evidence','Placement not present in chart.');
    if(input.kind==='aspect'&&!calculation.aspects.some(a=>[a.from,a.type,a.to].join(':')===detail))throw new FoundationError(422,'invalid_progress_evidence','Aspect not present in chart.');
    if(input.kind==='natal_detail')detail='opened';
    if(input.kind==='path_theme'&&!['strengths','motivation','growth','relationships','work'].includes(detail))throw new FoundationError(422,'invalid_progress_evidence','Unknown path theme.');
    if(input.kind==='comparison'||input.kind==='compatibility_theme'){
     if(!input.secondChartId||input.secondChartId===input.entityId)throw new FoundationError(422,'invalid_progress_evidence','Choose two charts.');
     const second=await db.from('luna30_chart_cache').select('id,profile_id,calculation').eq('telegram_id',owner).eq('id',input.secondChartId).maybeSingle();if(second.error)throw unavailable();if(!second.data)throw new FoundationError(404,'chart_not_found','Select the second chart.');
     calculateSynastry(calculation,second.data.calculation as NatalCalculation);
     if(input.kind==='compatibility_theme'&&!['relationship','emotions','communication','strengths','challenges'].includes(detail))throw new FoundationError(422,'invalid_progress_evidence','Unknown calculated theme.');
     detail=input.secondChartId+(input.kind==='compatibility_theme'?':'+detail:'');
    }
   }
   const result=await db.from('luna34_progress_events').upsert({telegram_id:owner,kind:input.kind,entity_id:input.entityId,detail},{onConflict:'telegram_id,kind,entity_id,detail',ignoreDuplicates:true});if(result.error)throw unavailable();if(input.kind==='reading_reveal'&&detail==='complete')await onReadingComplete?.(owner,input.entityId).catch(()=>undefined);return {recorded:true};
  },
  async acknowledge(owner:number,raw:unknown){const {ids}=z.object({ids:z.array(z.string().regex(/^[ATSRMGC]\d{2}$/)).min(1).max(50)}).strict().parse(raw);const r=await db.rpc('luna34_acknowledge_achievements',{p_owner:owner,p_ids:ids});if(r.error||r.data!==true)throw unavailable();return {acknowledged:true};}
 };return service;
}
