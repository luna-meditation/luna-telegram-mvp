import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {calculateCurrentTransits,type NatalCalculation} from './luna30-astrology-engine.js';
import {zodiacFactNames} from './luna30-astrology-report-policy.js';
import {resolvePersonalBirth,numerologyFromBirth} from './personal-context-engine.js';
/** A calculated supplement to the existing consented personal-context service,
 * never a second profile or a model-inferred birth date. */
export async function verifiedNumerologyContext(db:SupabaseClient,owner:number,options:{consented:boolean;chartId?:string;asOf?:string}){
 if(!Number.isSafeInteger(owner)||owner<=0)throw new FoundationError(403,'owner_required','Open Luna inside Telegram.');
 if(!options.consented)return{requiresConsent:true,calculated:false};
 return numerologyFromBirth(await resolvePersonalBirth(db,owner,options.chartId),options.asOf??new Date().toISOString().slice(0,10));
}
export async function verifiedCurrentTransits(db:SupabaseClient,owner:number,chartId:string,now=new Date()){
 const result=await db.from('luna30_chart_cache').select('calculation').eq('telegram_id',owner).eq('id',chartId).maybeSingle();
 if(result.error)throw new FoundationError(503,'context_unavailable','Could not retrieve the selected chart.');
 if(!result.data)throw new FoundationError(404,'chart_not_found','Reopen your calculated chart.');
 // Ten-minute snapshots are stable within a turn/retry and disclosed explicitly.
 const at=new Date(Math.floor(now.getTime()/600000)*600000).toISOString();
 return namedTransitFacts(calculateCurrentTransits(result.data.calculation as NatalCalculation,at));
}
/** Numeric zodiac indices are for renderers, not for a language model to
 * reinterpret. Localized labels are derived from the very same engine values. */
export function namedTransitFacts(snapshot:ReturnType<typeof calculateCurrentTransits>){
 const signsRu=['Овен','Телец','Близнецы','Рак','Лев','Дева','Весы','Скорпион','Стрелец','Козерог','Водолей','Рыбы'];
 const planetsRu:Record<string,string>={sun:'Солнце',moon:'Луна',mercury:'Меркурий',venus:'Венера',mars:'Марс',jupiter:'Юпитер',saturn:'Сатурн',uranus:'Уран',neptune:'Нептун',pluto:'Плутон'};
 const aspectsRu:Record<string,string>={conjunction:'соединение',sextile:'секстиль',square:'квадрат',trine:'трин',opposition:'оппозиция'};
 return{...snapshot,interpretationBoundary:'A snapshot of calculated angular relationships, not a prediction or proof of personality. Current positions and natal positions are distinct.',current:snapshot.current.map(p=>({...p,signName:zodiacFactNames[p.sign],signNameRu:signsRu[p.sign],planetNameRu:planetsRu[p.id]})),aspects:snapshot.aspects.map(a=>({...a,labelEn:`transiting ${a.transiting} — ${a.type} — natal ${a.natal}`,labelRu:`транзит: ${planetsRu[a.transiting]} — ${aspectsRu[a.type]} — натальная карта: ${planetsRu[a.natal]}`}))};
}
