import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {calculatedChart} from './astrology-foundation.js';
import {astrologyEngineMetadata,type NatalCalculation} from './luna30-astrology-engine.js';
/** Current interpretation and live transits must not silently reuse a chart
 * from before a profile correction. Explicit saved products retain history. */
export async function verifiedChartSource(db:SupabaseClient,owner:number,id:string,allowHistorical=false){
 if(!Number.isSafeInteger(owner)||owner<=0)throw new FoundationError(403,'owner_required','Open Luna inside Telegram.');
 const chart=await db.from('luna30_chart_cache').select('id,profile_id,profile_revision,engine,engine_version,calculation,created_at').eq('telegram_id',owner).eq('id',id).maybeSingle();
 if(chart.error)throw new FoundationError(503,'context_unavailable','Could not verify the selected chart.');
 if(!chart.data)throw new FoundationError(404,'chart_not_found','Reopen your calculated chart.');
 const row=chart.data,raw=z.record(z.string(),z.unknown()).safeParse(row.calculation);
 if(!raw.success)throw new FoundationError(503,'chart_source_unverified','The chart source could not be verified.');
 const {houseSystem,uncertainPlanets,warnings,approximatePlanets,...base}=raw.data;
 const calculation=calculatedChart.safeParse(base),extras=z.object({houseSystem:z.literal('whole-sign'),uncertainPlanets:z.array(z.object({id:z.string(),signs:z.array(z.number().int().min(0).max(11))})),warnings:z.array(z.string()),approximatePlanets:z.boolean()}).safeParse({houseSystem,uncertainPlanets,warnings,approximatePlanets});
 if(!calculation.success||!extras.success||!Number.isSafeInteger(row.profile_revision)||row.profile_revision<1||!Number.isFinite(Date.parse(row.created_at)))throw new FoundationError(503,'chart_source_unverified','The chart source could not be verified.');
 const planets=new Set(['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto']),aspects=new Set(['conjunction','sextile','square','trine','opposition']);
 if(calculation.data.planets.length!==10||new Set(calculation.data.planets.map(p=>p.id)).size!==10||calculation.data.planets.some(p=>!planets.has(p.id))||calculation.data.aspects.some(a=>!planets.has(a.from)||!planets.has(a.to)||a.from===a.to||!aspects.has(a.type)||a.orb>6)||calculation.data.timePrecision==='unknown'&&calculation.data.aspects.length>0)throw new FoundationError(503,'chart_source_unverified','The calculated facts could not be verified.');
 if(row.engine!==astrologyEngineMetadata.id||row.engine_version!==astrologyEngineMetadata.version||calculation.data.engine!==row.engine||calculation.data.engineVersion!==row.engine_version)throw new FoundationError(422,'unsupported_chart_version','Recalculate this chart using the supported engine.');
 const profile=await db.from('luna30_birth_profiles').select('display_label,subject_kind,revision').eq('telegram_id',owner).eq('id',row.profile_id).maybeSingle();
 if(profile.error)throw new FoundationError(503,'context_unavailable','Could not verify the birth profile.');
 if(!profile.data)throw new FoundationError(404,'profile_not_found','Reopen the saved birth profile.');
 if(!Number.isSafeInteger(profile.data.revision)||profile.data.revision<1)throw new FoundationError(503,'chart_source_unverified','The profile revision could not be verified.');
 const current=row.profile_revision===profile.data.revision;
 if(!current&&!allowHistorical)throw new FoundationError(409,'chart_source_changed','Birth details changed. Recalculate the chart before a current interpretation.');
 return {...row,calculation:{...calculation.data,...extras.data} as NatalCalculation,subject:{label:String(profile.data.display_label).slice(0,80),kind:profile.data.subject_kind==='self'?'self':'other'},sourceValidity:{state:current?'current' as const:'historical' as const,profileRevision:row.profile_revision,currentProfileRevision:profile.data.revision,calculatedAt:row.created_at as string,engineVersion:row.engine_version as string}};
}
