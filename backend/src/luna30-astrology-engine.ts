import {createRequire} from 'node:module';
import {Temporal} from '@js-temporal/polyfill';
import {birthCalculationInput,calculatedChart,chartCacheKey} from './astrology-foundation.js';
import type {z} from 'zod';
// 2.1.19's import entry lacks type:module; use its official CommonJS entry on Node 22.
const {Body,Ecliptic,GeoVector,MakeTime,SiderealTime,e_tilt,MoonPhase,SearchMoonQuarter,NextMoonQuarter}=createRequire(import.meta.url)('astronomy-engine') as typeof import('astronomy-engine');

export const astrologyEngineMetadata=Object.freeze({id:'astronomy-engine',version:'2.1.19',license:'MIT',ephemeris:'VSOP87/NOVAS; Astronomy Engine',tzdb:process.versions.tz??'unavailable',houseSystem:'whole-sign'});
const bodies=[Body.Sun,Body.Moon,Body.Mercury,Body.Venus,Body.Mars,Body.Jupiter,Body.Saturn,Body.Uranus,Body.Neptune,Body.Pluto];
const normalize=(n:number)=>((n%360)+360)%360;
export const zodiacSign=(longitude:number)=>Math.floor(normalize(longitude)/30);
export function aspectBetween(from:number,to:number){const angle=Math.abs(((normalize(from)-normalize(to)+540)%360)-180);const choices=[['conjunction',0],['sextile',60],['square',90],['trine',120],['opposition',180]] as const;const nearest=choices.map(([type,degrees])=>({type,orb:Math.abs(angle-degrees)})).sort((a,b)=>a.orb-b.orb)[0];return nearest.orb<=6?nearest:null;}
function planetsAt(date:Date){return bodies.map(body=>({id:body.toLowerCase(),longitude:normalize(Ecliptic(GeoVector(body,date,true)).elon)}));}
/** Requires a location resolved/validated by a trusted server adapter, not arbitrary client coordinates. */
export function calculateNatalChart(raw:z.infer<typeof birthCalculationInput>){
 const input=birthCalculationInput.parse(raw),birth=Temporal.PlainDate.from(input.date);
 if(birth.year<1800||birth.year>2100)throw new Error('Birth date outside the supported calculation interval.');
 if(astrologyEngineMetadata.tzdb==='unavailable')throw new Error('A versioned IANA timezone database is required.');
 const exact=input.time!==null,zone=input.location.timezone;
 // reject, not guess, a DST gap/fold; the user needs to clarify ambiguous exact times.
 const instant=exact?Temporal.PlainDateTime.from(`${input.date}T${input.time}`).toZonedDateTime(zone,{disambiguation:'reject'}).toInstant():null;
 const start=birth.toZonedDateTime(zone).toInstant(),end=birth.add({days:1}).toZonedDateTime(zone).toInstant();
 const sample=instant??Temporal.Instant.fromEpochMilliseconds(Math.floor((start.epochMilliseconds+end.epochMilliseconds)/2));
 const date=new Date(sample.epochMilliseconds),planets=planetsAt(date);
 const uncertainPlanets:Array<{id:string;signs:number[]}>=[];
 if(!exact){const signs=new Map<string,Set<number>>(bodies.map(b=>[b.toLowerCase(),new Set<number>()]));for(let i=0;i<=24;i++){const time=new Date(start.epochMilliseconds+(end.epochMilliseconds-start.epochMilliseconds-1)*i/24);for(const p of planetsAt(time))signs.get(p.id)!.add(zodiacSign(p.longitude));}for(const [id,set]of signs)if(set.size>1)uncertainPlanets.push({id,signs:[...set].sort((a,b)=>a-b)});}
 let ascendant:number|null=null;const warnings:string[]=[];
 if(exact&&Math.abs(input.location.latitude)<66){const rad=Math.PI/180,theta=(SiderealTime(date)*15+input.location.longitude)*rad,epsilon=e_tilt(MakeTime(date)).tobl*rad,latitude=input.location.latitude*rad;ascendant=normalize(Math.atan2(-Math.cos(theta),Math.sin(theta)*Math.cos(epsilon)+Math.tan(latitude)*Math.sin(epsilon))/rad+180);}
 else warnings.push(exact?'polar_angles_not_validated':'birth_time_unknown');
 const houses=ascendant===null?[]:Array.from({length:12},(_,i)=>normalize(Math.floor(ascendant!/30)*30+i*30));
 // No precise natal aspects for an unknown time: a noon sample must not look exact.
 const aspects: Array<{from:string;to:string;type:string;orb:number}>=[];
 if(exact)for(let i=0;i<planets.length;i++)for(let j=i+1;j<planets.length;j++){const aspect=aspectBetween(planets[i].longitude,planets[j].longitude);if(aspect)aspects.push({from:planets[i].id,to:planets[j].id,...aspect});}
 const chart=calculatedChart.parse({engine:astrologyEngineMetadata.id,engineVersion:astrologyEngineMetadata.version,ephemeris:astrologyEngineMetadata.ephemeris,timezoneDatabaseVersion:astrologyEngineMetadata.tzdb,timePrecision:exact?'exact':'unknown',utcInstant:instant?.toString()??null,ascendant,houses,planets,aspects});
 return {...chart,houseSystem:'whole-sign' as const,uncertainPlanets,warnings,approximatePlanets:!exact};
}
export type NatalCalculation=ReturnType<typeof calculateNatalChart>;
/** Geocentric, UTC astronomical facts only. No natal data or AI request. */
export function calculateCelestialMonth(month:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))<1800||Number(month.slice(0,4))>2100)throw new Error('Unsupported calendar month.');
 const start=new Date(month+'-01T00:00:00Z'),end=new Date(start);end.setUTCMonth(end.getUTCMonth()+1);
 const events:Array<{quarter:number;at:string}>=[];
 for(let phase=SearchMoonQuarter(start);phase.time.date<end;phase=NextMoonQuarter(phase)){if(events.length>6)throw new Error('Calendar search boundary exceeded.');events.push({quarter:phase.quarter,at:phase.time.date.toISOString()});}
 const days=[];for(let day=new Date(start);day<end;day=new Date(day.getTime()+86400000)){
  const noon=new Date(day.getTime()+43200000),phaseAngle=MoonPhase(noon),planets=planetsAt(noon);
  // General-sky transit snapshots at a declared UTC instant, not personalized
  // predictions or exact aspect-peak/ingress times. Reuse the natal engine.
  const aspects:Array<{from:string;to:string;type:string;orb:number}>=[];
  for(let i=0;i<planets.length;i++)for(let j=i+1;j<planets.length;j++){const aspect=aspectBetween(planets[i].longitude,planets[j].longitude);if(aspect)aspects.push({from:planets[i].id,to:planets[j].id,...aspect});}
  days.push({date:day.toISOString().slice(0,10),at:noon.toISOString(),moonPhaseDegrees:phaseAngle,illuminatedFraction:(1-Math.cos(phaseAngle*Math.PI/180))/2,planets,aspects});
 }
 return{month,timezone:'UTC' as const,engine:astrologyEngineMetadata,events,days,personalPrediction:false as const,transitScope:'general_sky_at_12_utc' as const};
}
export function natalCacheKey(userId:number,input:z.infer<typeof birthCalculationInput>){return chartCacheKey(userId,input,astrologyEngineMetadata);}
export function calculateSynastry(first:NatalCalculation,second:NatalCalculation){
 const aspects:Array<{from:string;to:string;type:string;orb:number}>=[];
 const excludedA=new Set(first.timePrecision==='unknown'?['moon',...first.uncertainPlanets.map(p=>p.id)]:[]),excludedB=new Set(second.timePrecision==='unknown'?['moon',...second.uncertainPlanets.map(p=>p.id)]:[]);
 for(const a of first.planets)for(const b of second.planets){if(excludedA.has(a.id)||excludedB.has(b.id))continue;const aspect=aspectBetween(a.longitude,b.longitude);if(aspect)aspects.push({from:a.id,to:b.id,...aspect});}
 return {aspects,unknownTime:first.timePrecision==='unknown'||second.timePrecision==='unknown',excluded:{first:[...excludedA],second:[...excludedB]},percentage:null,disclaimer:'Symbolic relationship reflection, not a scientific prediction.'};
}
