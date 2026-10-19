import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {deepAnalysisResultSchema} from './luna43-commerce-policy.js';
import {FoundationError} from './foundation-error.js';
/** An exact owner-selected paid deliverable, never a Tarot or natal attachment.
 * Reading it cannot claim a generation lease or touch the wallet. */
export async function readPersonalReportContext(db:SupabaseClient,owner:number,id:string){
 z.string().uuid().parse(id);
 const r=await db.from('luna43_seed_purchases').select('id,product,state,result,created_at').eq('telegram_id',owner).eq('id',id).eq('product','deep_analysis').maybeSingle();
 if(r.error)throw new FoundationError(503,'report_unavailable','Could not open the selected report.');
 if(!r.data||r.data.state!=='ready'||!r.data.result)throw new FoundationError(404,'report_not_found','Choose a completed personal report from this account.');
 const result=deepAnalysisResultSchema.parse(r.data.result);
 if(JSON.stringify(result).length>14000)throw new FoundationError(422,'report_too_large','Choose a specific section to discuss.');
 return{id:r.data.id,source:'saved_paid_personal_report',createdAt:r.data.created_at,...result,grounding:'A saved interpretation, not confirmed personal facts. Discuss the selected report without drawing cards, recalculating or charging again.'};
}
export function recordedPersonalReportConsent(messages:Array<{role?:string;metadata?:unknown}>,id:string){
 for(const message of [...messages].reverse()){
  if(message.role!=='assistant')continue;
  const meta=message.metadata as {contextReset?:boolean;personalReport?:{id?:string;consented?:boolean}}|null;
  if(meta?.contextReset)return false;
  if(meta?.personalReport)return meta.personalReport.id===id&&meta.personalReport.consented===true;
 }
 return false;
}
export function retainsPersonalReport(message:string,selected=false){
 if(/(?:сменим тему|другая тема|не об этом|кстати|new topic|change the subject)|(?:таро|расклад|натальн|астролог|нумеролог|медитац|подыш|дыхани|moon seeds|баланс|\b(?:tarot|spread|birth chart|astrology|numerology|meditat|breathe|breathing|wallet)\b)/iu.test(message))return false;
 return selected||message.length<500&&/(?:разбор|отч[её]т|отношен|сильн|мотивац|цель|общен|дальше|это|знач|подробнее|почему|как |что |да$|\b(?:report|analysis|relationship|strength|goal|communicat\w*|this|mean|deeper|why|how|what|yes)\b)/iu.test(message);
}
