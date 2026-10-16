import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {symbolicChartFacts} from './luna30-astrology-report-policy.js';
import type {NatalCalculation} from './luna30-astrology-engine.js';
export async function verifiedAstrologyChatContext(db:SupabaseClient,owner:number,id:string){
 const gate=await db.from('luna30_release_settings').select('astrology_enabled,astrology_ai_enabled').eq('id',true).single();
 if(gate.error||!gate.data?.astrology_enabled||!gate.data?.astrology_ai_enabled)throw new FoundationError(503,'astrology_unavailable','Calculated astrology is unavailable.');
 const {data,error}=await db.from('luna30_chart_cache').select('id,calculation').eq('telegram_id',owner).eq('id',id).maybeSingle();
 if(error||!data)throw new FoundationError(404,'chart_not_found','Reopen your calculated chart.');
 const facts=symbolicChartFacts(data.calculation as NatalCalculation);
 // Object rather than array: the existing bounded chat context keeps all ten
 // planets without weakening its limits for other modes or private memories.
 return {precision:facts.precision,placements:Object.fromEntries(facts.planets.map(p=>[p.planet,p.signs.join('/') ])),ascendant:facts.ascendant,houseSigns:facts.houseSigns.join(','),aspects:facts.aspects.map(a=>`${a.from}:${a.type}:${a.to}`).join(';').slice(0,500),warnings:facts.warnings.join(',')};
}
