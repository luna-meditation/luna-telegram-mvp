/** Reject observable identity/placement contradictions before an AI response
 * is persisted. This is a conservative evidence guard, not proof that free
 * prose is factual. No silent repair, extra provider call, or quota consumption.
 */
type Chart={subject:{label:string;kind:string};placements:Record<string,string>;ascendant:string|null;aspects:Array<{from:string;to:string;type:string}>};
import type {calculateDateNumerology} from './luna-intelligence-numerology.js';
/** Check observable numeric assertions and keep an initial symbolic overview
 * distinct from a requested technical-method explanation. No prose repair. */
export function assertGroundedNumerologyProse(text:string,facts:ReturnType<typeof calculateDateNumerology>,request:string){
 const labels={lifePath:'life path|жизненн\\p{L}* пут\\p{L}*',birthday:'birthday(?: number)?|число (?:дня )?рождения',personalYear:'personal year|личн\\p{L}* год\\p{L}*',personalMonth:'personal month|личн\\p{L}* месяц\\p{L}*',personalDay:'personal day|личн\\p{L}* д(?:ень|ня|не)'} as const;
 for(const [key,label] of Object.entries(labels))for(const match of text.matchAll(new RegExp(`(?:${label})[ \\t*]*(?:(?:is|equals|—|–|:|равен|это)[ \\t*]*)?(\\d{1,2})(?!\\d)`,'giu'))){if(Number(match[1])!==facts[key as keyof typeof labels])throw new Error('ungrounded_numerology_value');}
 const technical=/master|мастер|method|метод|step.by.step|пошаг|how.{0,20}calcul|как.{0,20}(?:счит|рассчит)/iu.test(request),detailed=technical||/in detail|подроб|deep analysis|глубокий разбор/iu.test(request);
 if(!technical&&/master numbers?|мастер.?числ/iu.test(text))throw new Error('unrequested_numerology_method');
 if(/only.{0,24}intermediate|только.{0,24}промежуточ/iu.test(text))throw new Error('ungrounded_numerology_method');
 if(!detailed&&text.trim().split(/\s+/u).length>200)throw new Error('numerology_overview_too_long');
}
export type GroundedChartContext={first:Chart;second?:Chart;synastry?:{aspects:Array<{from:string;to:string;type:string}>}};
/** Failed user requests remain visible in history, but are not competing live
 * questions when the owner explicitly selects a calculated artifact. */
export function answeredArtifactTurns<T extends {role:string;request_id?:string|null}>(messages:T[]){
 const answered=new Set(messages.filter(m=>m.role==='assistant'&&m.request_id).map(m=>m.request_id));
 let current=-1;for(let i=messages.length-1;i>=0;i--)if(messages[i].role==='user'){current=i;break;}
 return messages.filter((m,i)=>m.role!=='user'||!m.request_id||i===current||answered.has(m.request_id));
}
/** A verified attachment needs an answer, not another permission loop. Pure
 * acknowledgement and privacy/navigation requests do not need chart prose. */
export function assertSubstantiveAstrologyAnswer(text:string,context:GroundedChartContext,request:string){
 if(/(?:predict|scientific|limitations?|науч|предсказ|ограничени|достовер)/iu.test(request))return;
 if(!/(?:\b(?:explain|interpret|why|how|what|meaning|understand)\b|объясн|интерпрет|почему|(?<!\p{L})как(?!\p{L})|значит|смысл|разбери)/iu.test(request))return;
 const planets=text.match(/(?<!\p{L})(?:sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|солнц\p{L}*|лун[аыоуе]|меркур\p{L}*|венер\p{L}*|марс\p{L}*|юпитер\p{L}*|сатурн\p{L}*|уран\p{L}*|нептун\p{L}*|плутон\p{L}*)(?!\p{L})/giu)??[];
 const detail=/(?:conjunction|sextile|square|trine|opposition|соединен|секстил|квадрат|трин|тригон|оппозиц|aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces|овен|овн|телец|тельц|близнец|рак|льв|лев|дев[аыеоу]|вес[ыо]|скорпион|стрелец|стрельц|козерог|водоле|рыб)/iu.test(text);
 if(planets.length<(context.second?2:1)||!detail)throw new Error('incomplete_calculated_interpretation');
}
const planetAliases:Record<string,string>={sun:'sun',солнц:'sun',moon:'moon',лун:'moon',mercury:'mercury',меркур:'mercury',venus:'venus',венер:'venus',mars:'mars',марс:'mars',jupiter:'jupiter',юпитер:'jupiter',saturn:'saturn',сатурн:'saturn',uranus:'uranus',уран:'uranus',neptune:'neptune',нептун:'neptune',pluto:'pluto',плутон:'pluto',ascendant:'ascendant',асцендент:'ascendant'};
const signs=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const signPatterns=['aries|овен|овн\\p{L}*','taurus|телец|тельц\\p{L}*','gemini|близнец\\p{L}*','cancer|рак(?:а|е|ом|у)?','leo|лев|льв\\p{L}*','virgo|дев(?:а|ы|е|ой|у)','libra|вес(?:ы|ов|ах|ами)','scorpio|скорпион\\p{L}*','sagittarius|стрелец|стрельц\\p{L}*','capricorn|козерог\\p{L}*','aquarius|водоле\\p{L}*','pisces|рыб\\p{L}*'];
const planetPattern=Object.keys(planetAliases).map(p=>p+'\\p{L}*').join('|');
const norm=(text:string)=>text.normalize('NFKC').toLocaleLowerCase().replace(/ё/g,'е');
const planet=(text:string)=>Object.entries(planetAliases).find(([stem])=>norm(text).startsWith(stem))?.[1];
export function assertGroundedAstrologyProse(text:string,context:GroundedChartContext,preferredName?:string,transits?:{current:Array<{id:string;sign:number}>;aspects:Array<{transiting:string;natal:string;type:string}>}|null){
 const charts=[context.first,...context.second?[context.second]:[]],names=charts.map(c=>norm(c.subject.label));if(preferredName)names.push(norm(preferredName));
 // A missing ascendant means the supplied calculation has no usable house
 // framework. Reject explicit planet-in-house assertions before persistence.
 const houseClaims=new RegExp(`(?<!\\p{L})(${planetPattern})(?!\\p{L})[ \\t]*(?:(?:is[ \\t]+)?in[ \\t]+(?:the[ \\t]+)?|в[ \\t]+)(?:[1-9]|1[0-2])(?:st|nd|rd|th|-?[а-яё]{1,3})?[ \\t]*(?:house|дом\\p{L}*)`,'giu');
 for(const match of text.matchAll(houseClaims)){
  const prefix=text.slice(Math.max(0,(match.index??0)-160),match.index).split(/[.!?\n]/u).at(-1)??'';
  const scope=/second profile|втор(?:ой|ого) профил/iu.test(prefix)&&context.second?[context.second]:/first profile|перв(?:ый|ого) профил/iu.test(prefix)?[context.first]:charts;
  if(scope.every(chart=>chart.ascendant===null))throw new Error('ungrounded_chart_house');
 }
 // Explicit identity assignments are not allowed to introduce aliases that
 // never came from an owner-verified profile (including slash-separated names).
 for(const match of text.matchAll(/(?:первый профиль|второй профиль|профиль|имя|зовут|first profile|second profile|named|name is)\s*(?:—|–|:|is|это)?\s*([\p{Lu}][\p{L}\p{N}'’/-]*(?:[ /][\p{Lu}][\p{L}\p{N}'’/-]*)?)/gu)){
  const candidate=norm(match[1]);if(!names.some(name=>name===candidate)||candidate.includes('/')&&!names.includes(candidate))throw new Error('ungrounded_profile_identity');
 }
 const placements=new RegExp(`(?<!\\p{L})(${planetPattern})(?!\\p{L})[ \\t]*(?:в|in|is in|—|–|:)?[ \\t]*(${signPatterns.join('|')})(?!\\p{L})`,'giu');
 for(const match of text.matchAll(placements)){
  const body=planet(match[1])!,sign=signs[signPatterns.findIndex(p=>new RegExp(`^(?:${p})$`,'iu').test(match[2]))];
  // If a sentence explicitly identifies a profile, do not validate against the
  // other chart merely because it happens to contain the claimed placement.
  const prefix=text.slice(Math.max(0,(match.index??0)-160),match.index).split(/[.!?\n]/u).at(-1)??'';
  const scope=/second profile|втор(?:ой|ого) профил/iu.test(prefix)&&context.second?[context.second]:/first profile|перв(?:ый|ого) профил/iu.test(prefix)?[context.first]:charts;
  const transitPlacement=transits?.current.some(p=>p.id===body&&signs[p.sign]===sign);
  if(!scope.some(c=>(body==='ascendant'?c.ascendant:c.placements[body])?.split(/[ /]/).includes(sign))&&!transitPlacement)throw new Error('ungrounded_chart_placement');
 }
 const aspectNames:Record<string,string>={conjunction:'conjunction',conjunct:'conjunction',соедин:'conjunction',sextile:'sextile',секстил:'sextile',square:'square',квадрат:'square',trine:'trine',трин:'trine',тригон:'trine',opposition:'opposition',opposite:'opposition',оппозиц:'opposition'};
 const aspectPattern=Object.keys(aspectNames).map(x=>x+'\\p{L}*').join('|');
 if(context.second)for(const sentence of text.split(/[.!?\n]/u))if(new RegExp(aspectPattern,'iu').test(sentence)&&new RegExp(`(?:${planetPattern})[ \\t]*/[ \\t]*(?:${planetPattern})`,'iu').test(sentence))throw new Error('ungrounded_chart_aspect');
 // Only an explicit adjacent relation. An arbitrary text span can incorrectly
 // bind the previous placement to an aspect in the next clause/list item.
 const link='[ \\t]*(?:(?:is|in|в|находится|образует)[ \\t]+)?[—–:-]?[ \\t]*';
 const target='[ \\t]*(?:(?:to|with|к|с|натальн\\p{L}*)[ \\t]+){0,2}[—–:-]?[ \\t]*';
 const aspects=new RegExp(`(?<!\\p{L})(${planetPattern})(?!\\p{L})${link}(${aspectPattern})${target}(${planetPattern})(?!\\p{L})`,'giu');
 const evidence=[...(context.second?context.synastry?.aspects??[]:context.first.aspects),...transits?.aspects.map(a=>({from:a.transiting,to:a.natal,type:a.type}))??[]];
 for(const match of text.matchAll(aspects)){
  const from=planet(match[1]),to=planet(match[3]),type=Object.entries(aspectNames).find(([k])=>norm(match[2]).startsWith(k))?.[1];
  if(!evidence.some(a=>a.type===type&&(a.from===from&&a.to===to||a.from===to&&a.to===from)))throw new Error('ungrounded_chart_aspect');
 }
 // Russian prose frequently puts the aspect first ("квадрат Луны A к
 // Сатурну B"). Validate coordinated targets separately: a valid Moon/Saturn
 // square does not establish a Moon/Mercury square after a slash or "and".
 const marker='(?:[ \\t]+[AB])?',preposed=new RegExp(`(?<!\\p{L})(${aspectPattern})[ \\t]+(${planetPattern})(?!\\p{L})${marker}[ \\t]+(?:к|с|и|to|with|between)[ \\t]+(${planetPattern})(?!\\p{L})${marker}`,'giu');
 for(const match of text.matchAll(preposed)){
  const type=Object.entries(aspectNames).find(([key])=>norm(match[1]).startsWith(key))?.[1],from=planet(match[2]),targets=[planet(match[3])];
  const tail=text.slice((match.index??0)+match[0].length).split(/[.!?;\n]/u)[0]??'',continuation=new RegExp(`^(?:[ \\t]*(?:/|(?:и|and)[ \\t]+(?:к[ \\t]+)?|,[ \\t]*(?:и[ \\t]+)?(?:к[ \\t]+)?)[ \\t]*(${planetPattern})(?!\\p{L})${marker})`,'iu');
  let rest=tail;for(let extra=continuation.exec(rest);extra;extra=continuation.exec(rest)){targets.push(planet(extra[1]));rest=rest.slice(extra[0].length);}
  if(targets.some(to=>!evidence.some(a=>a.type===type&&(a.from===from&&a.to===to||a.from===to&&a.to===from))))throw new Error('ungrounded_chart_aspect');
 }
}
/** Different attached results may remain visible in history, but their old
 * assistant interpretations must not become factual input for the new report. */
export function artifactScopedRecent<T extends {role:string;metadata?:unknown}>(messages:T[],active:{chartId?:string;secondChartId?:string;readingId?:string}){
 let boundary=0;
 for(let i=0;i<messages.length;i++){
  const m=messages[i];if(m.role!=='assistant'||!m.metadata||typeof m.metadata!=='object')continue;
  const data=m.metadata as {astrology?:{chartId?:string;secondChartId?:string};readingId?:string;tarot?:{readingId?:string}};
  const a=data.astrology,reading=data.tarot?.readingId??data.readingId;
  if(a&&(a.chartId!==active.chartId||a.secondChartId!==active.secondChartId)||reading&&reading!==active.readingId)boundary=i+1;
 }
 return messages.slice(boundary);
}
