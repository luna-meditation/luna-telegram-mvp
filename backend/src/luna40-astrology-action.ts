import type {SupabaseClient} from '@supabase/supabase-js';
import {createAstrologyService} from './luna30-astrology-service.js';
/** A real calculation/UI preparation, not permission to send birth facts to AI.
 * Reuses the existing owner-scoped cache and never returns raw birth details. */
export async function prepareAstrologyAction(db:SupabaseClient,owner:number,kind:'natal'|'compatibility',enabled:()=>boolean){
 const service=createAstrologyService(db,enabled),{profiles}=await service.list(owner),personal=profiles.filter(p=>p.subject_kind==='self');
 if(kind==='natal'&&personal.length===1){const {chart}=await service.calculate(owner,personal[0].id);return{workflow:{version:1 as const,kind,state:'ready' as const,firstProfileId:personal[0].id as string,firstChartId:chart.id as string},attachment:{chartId:chart.id as string},providerResult:{action:'natal_chart',state:'calculated',requiresSelection:false,requiresSeparateAiConsent:true,note:'The real chart card is attached in the app. No chart positions or birth data are sent in this tool output. Do not claim playback, a reading or an interpretation was generated.'}};}
 return{workflow:{version:1 as const,kind,state:'selecting' as const},attachment:null,providerResult:{action:kind==='natal'?'natal_chart':'compatibility',state:'selecting',requiresSelection:true,profileCount:profiles.length,requiresSeparateAiConsent:true,note:profiles.length?'The actual profile selector is attached. Ask only for the missing selection, not repeated permission.':'No saved birth profiles. The actual add-profile control is attached. Birth details are optional and should be entered in the secure form, not ordinary chat.'}};
}
