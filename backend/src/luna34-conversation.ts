type Planet='sun'|'moon'|'mercury'|'venus'|'mars'|'jupiter'|'saturn'|'uranus'|'neptune'|'pluto';
type AstrologyAttachment={chartId:string;secondChartId?:string;reportId?:string;comparisonId?:string;relationship?:'romantic'|'business'|'friendship'|'family';planet?:Planet;aspect?:{from:Planet;to:Planet;type:'conjunction'|'sextile'|'square'|'trine'|'opposition'}};
/** Active context is separate from historical attachments. Never infer an ID
 * from a title or expose arbitrary metadata from user-authored messages. */
export function availableConsultationAttachments(messages:Array<{role?:string;metadata?:unknown}>){
 const readings=new Set<string>(),charts=new Map<string,AstrologyAttachment>(),uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
 for(const message of messages){if(message.role!=='assistant'||!message.metadata||typeof message.metadata!=='object')continue;const meta=message.metadata as {readingId?:string;tarot?:{readingId?:string};astrology?:AstrologyAttachment};const reading=meta.tarot?.readingId??meta.readingId;if(typeof reading==='string'&&uuid.test(reading))readings.add(reading);const chart=meta.astrology;if(chart&&uuid.test(chart.chartId)&&(!chart.secondChartId||uuid.test(chart.secondChartId))&&(!chart.reportId||uuid.test(chart.reportId))&&(!chart.comparisonId||uuid.test(chart.comparisonId)))charts.set(JSON.stringify([chart.chartId,chart.secondChartId??null,chart.reportId??null,chart.comparisonId??null,chart.relationship??null,chart.planet??null,chart.aspect??null]),chart);}
 return {readings:[...readings].slice(-12),charts:[...charts.values()].slice(-12)};
}
export function independentReflectionTopic(text:string):'dream'|'companion'|'wellbeing'|null{
 if(/\b(?:tarot|card|chart|compatibility|mercury|venus|natal)\b|таро|расклад|карт[ауы]|совместим|меркур|венер|натальн/i.test(text))return null;
 if(/\b(?:interpret|explore|discuss|understand).{0,30}(?:my|a|this) dream\b|мне приснилось|(?:обсуди|разбери|помоги понять|толкован).{0,30}сон/i.test(text))return 'dream';
 if(/\b(?:change (?:the )?topic|different topic|new topic|something else|just talk|general conversation)\b|сменим тему|другая тема|на другую тему|просто поговорим/i.test(text))return 'companion';
 if(/^(?:i (?:feel|am feeling) (?:anxious|overwhelmed|sad)|мне (?:тревожно|грустно|тяжело)|я чувствую (?:тревогу|грусть))/i.test(text.trim()))return 'wellbeing';
 return null;
}
export function requestedBreathOptions(text:string){
 const lower=text.toLowerCase(),match=lower.match(/\b(1|3|5|10)\s*(?:min|minutes?|мин)/),word=/\b(?:five)\b|пять|пятиминут/.test(lower)?5:/\bten\b|десять|десятиминут/.test(lower)?10:/\bthree\b|три минут|трёхминут|трехминут/.test(lower)?3:1;
 const minutes=match?Number(match[1]):word;
 const practiceId=/4[-– ]7[-– ]8/.test(lower)?'478':/box|квадрат/.test(lower)?'box':/coherent|когерент/.test(lower)?'coherent':/triangle|треуголь/.test(lower)?'triangle':/physiological|sigh|физиолог|двойной вдох/.test(lower)?'sigh':/anxiety reset|перезагрузка при тревоге/.test(lower)?'anxiety_reset':/morning|утрен/.test(lower)?'morning_energy':/wind.down|\bsleep\b|bedtime|настрой на сон|для сна|перед сном/.test(lower)?'sleep':'calm';
 return {practiceId,minutes};
}
/** Side suggestions cannot invalidate an otherwise complete model response. */
export function meaningfulQuickReplies(raw:unknown,previous:string[]=[],max=3){
 if(!Array.isArray(raw))return [];
 const seen=new Set(previous.map(v=>v.trim().toLocaleLowerCase()));return raw.flatMap(value=>{
  if(typeof value!=='string')return [];const text=value.replace(/\s+/g,' ').trim(),key=text.toLocaleLowerCase();if(text.length<3||text.length>110||/[<>\{\}\[\]]|https?:|(?:javascript|data):/i.test(text)||seen.has(key))return [];seen.add(key);return [text];
 }).slice(0,Math.min(3,Math.max(0,max)));
}
export function lastAssistantQuickReplies(messages:Array<{role?:string;metadata?:unknown}>){
 for(let index=messages.length-1;index>=0;index--){const message=messages[index];if(message.role!=='assistant')continue;const metadata=message.metadata as {consultation?:{quickReplies?:unknown}}|null;return meaningfulQuickReplies(metadata?.consultation?.quickReplies);}
 return [];
}
export const luna34ConversationInstructions=`LUNA_CONSULTATION_V3_4
Keep one coherent conversation, not a collection of menu replies. The active task is not the same as available historical attachments. Discuss only the exact current verified reading/chart(s), while preserving previous cards and chart messages as history. Never force Tarot imagery into a clear new topic such as a dream, emotional support or meditation.
When useful provide two or three short quickReplies in the user's voice, each a meaningful next question or a real choice related to this exact answer. The previousQuickReplies field lists the last menu; propose different next steps, not the same choices again. Do not provide generic yes/no menus, invent a completed action, or repeat advice in several phrasings. Localize all visible card orientation labels: in Russian use «прямая» / «перевёрнутая», never the internal English tokens upright/reversed. A narrow question gets a direct concise answer, not a full report. A longer interpretation should have a short personal synthesis, distinct clearly labeled insights grounded in each actual selected card/position or calculated placement/aspect, and one useful reflection question. No speculative feelings of another person, deterministic compatibility, diagnosis, prophecy or pressure to continue. Personal address uses only authorized preferences. Existing real app controls execute actions; prose never does.`;
