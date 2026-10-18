import type {LunaMessage} from '../api';
import {intelligenceUuid,isIntelligenceAttachment,validatedIntelligenceAttachments,type IntelligenceAttachment} from '../../../backend/src/luna-intelligence-contract';
/** Backward compatibility is based exclusively on verified metadata fields.
 * A word such as 'cards' in a title/prose can never select Tarot rendering. */
export function messageAttachments(message:LunaMessage):IntelligenceAttachment[]{
 const metadata=message.metadata;if(message.role!=='assistant'||!metadata||!intelligenceUuid(message.id))return [];
 if(metadata.intelligence?.version===1&&Array.isArray(metadata.intelligence.attachments)&&metadata.intelligence.attachments.length)return validatedIntelligenceAttachments(metadata.intelligence.attachments);
 const base={version:1 as const,id:message.id,operationId:message.id,status:'EXECUTED' as const,access:'user_action' as const};
 let attachment:unknown=null;
 if(metadata.tarot)attachment={...base,type:'tarot_reading',action:'tarot.retrieve',payload:{stage:'saved',kind:metadata.tarot.kind,readingId:metadata.tarot.readingId,clientReadingId:metadata.tarot.clientReadingId,intention:metadata.tarot.reading?.intention??'general',question:metadata.tarot.reading?.question??''}};
 else if(metadata.astrologyWorkflow){const w=metadata.astrologyWorkflow;attachment=w.kind==='compatibility'?{...base,type:'compatibility_report',action:'astrology.compatibility',payload:{stage:w.state==='ready'?'ready':'select',...(w.firstChartId?{chartId:w.firstChartId}:{}),...(w.secondChartId?{secondChartId:w.secondChartId}:{}),...(w.relationship?{relationship:w.relationship}:{})}}:{...base,type:'natal_chart',action:'astrology.natal',payload:{stage:w.state==='ready'?'ready':'select',...(w.firstChartId?{chartId:w.firstChartId}:{})}};}
 else if(metadata.commerce)attachment=metadata.commerce.view==='premium'?{...base,type:'premium_offer',action:'premium.entitlements',payload:{view:'premium'}}:{...base,type:'moon_seeds_offer',action:'commerce.options',payload:{view:metadata.commerce.view}};
 else if((Object.prototype.hasOwnProperty.call(metadata,'meditationAction')?metadata.meditationAction?.meditationId:metadata.recommendedMeditationId))attachment={...base,type:'meditation',action:'meditation.recommend',payload:{meditationId:Object.prototype.hasOwnProperty.call(metadata,'meditationAction')?metadata.meditationAction?.meditationId:metadata.recommendedMeditationId}};
 else if(metadata.breathing&&(metadata.resolvedIntent==='breathing'||metadata.workflowActions?.includes('breathing')))attachment={...base,type:'breathing_session',action:'breathing.start',payload:metadata.breathing};
 return isIntelligenceAttachment(attachment)?[attachment]:[];
}
