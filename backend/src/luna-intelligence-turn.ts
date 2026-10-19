/** Shared, dependency-free turn boundary. It does not select a tool from model
 * prose. It decides whether an explicitly authorized artifact remains relevant. */
export type IntelligenceTopic='tarot'|'natal'|'compatibility'|'general';
/** A named activity is not a positive request when the user explicitly leaves
 * it aside. Share this boundary with commands and tool exposure, not just prose. */
export function declinesTarot(message:string){
 const text=message.normalize('NFKC').replace(/[’‘]/g,"'");
 return /\b(?:leave|put|set)\s+(?:(?:the|this|that|my)\s+)?(?:tarot(?:\s+(?:reading|spread))?|cards?|reading|spread)\s+(?:aside|away)|(?:оставим|отложим|оставь|отложи)\s+(?:пока\s+)?(?:таро|расклад\p{L}*|карт\p{L}*)|(?:\b(?:no|without)\s+(?:more\s+)?tarot\b|(?:без|не хочу)\s+(?:больше\s+)?таро)/iu.test(text);
}
export function explicitlyUnselectedReference(message:string){
 return /\b(?:I\s+)?(?:have not|haven't|haven’t)\s+(?:selected|chosen|picked)\b.{0,70}\b(?:chart|card|practice)|я\s+(?:ещ[её]\s+)?не\s+выбрал\p{L}*\s+(?:ни\s+)?(?:карт\p{L}*|расклад\p{L}*|практик\p{L}*)/iu.test(message);
}
/** Availability is not a fabricated memory or an assertion that the database
 * contains nothing: only the authorized, relevant facts retrieved this turn. */
export function missingSavedGoalInstruction(personal:unknown,message:string){
 if(message.length>500||!/(?:continu|return|resume|продолж|верн[её]|верну)/iu.test(message)||!/(?:goal|цел[ьиь])/iu.test(message)||!/(?:saved|confirm|сохран|подтвержд)/iu.test(message))return '';
 const memories=personal&&typeof personal==='object'?(personal as {confirmedMemories?:unknown}).confirmedMemories:null;
 const found=Array.isArray(memories)&&memories.some(memory=>memory&&typeof memory==='object'&&(memory.category==='goals'||memory.category==='life_context'&&typeof memory.value==='string'&&/"goal"\s*:\s*"[^"\s]/u.test(memory.value)));
 return found?'':'SAVED_GOAL_SOURCE_MISSING: No matching authorized confirmed goal was retrieved for this turn. Do not claim to remember, have already agreed on, or be able to open a saved goal. Briefly make that distinction, then offer one useful small step using the current user statement; do not substitute another memory or give a three-option questionnaire. This is not authority to save anything.';
}
/** An explicit explanation of an already calculated attachment needs no new
 * system/tool. Live transits, lookups and requested actions still use tools. */
export function answerFromAttachedEvidence(hasChart:boolean,message:string){
 if(!hasChart||/(?:transit|today|current sky|транзит|сегодня|сейчас на небе)/iu.test(message))return false;
 if(/(?:\b(?:open|find|save|remember|delete|start|new|another|list|search)\b|открой|найди|сохран|запомни|удали|начн|новый|прошл[ыо])/iu.test(message))return false;
 return /(?:\b(?:explain|interpret|why|how|what|meaning|understand)\b|объясн|интерпрет|почему|(?<!\p{L})как(?!\p{L})|значит|означа|смысл|разбери)/iu.test(message);
}
export function artifactTopic(input:{readingId?:string;chartId?:string;astrology?:{chartId:string;secondChartId?:string}}):IntelligenceTopic{
 return input.astrology?.secondChartId?'compatibility':input.astrology||input.chartId?'natal':input.readingId?'tarot':'general';
}
export function retainsArtifact(message:string,topic:IntelligenceTopic,selected=false){
 if(topic==='general')return false;
 const text=message.trim();
 if(topic==='tarot'&&declinesTarot(text)||explicitlyUnselectedReference(text))return false;
 if(/(?:new|different|another) topic|change (?:the )?subject|сменим тему|другая тема|не об этом|кстати.{0,30}(?:спал|сплю|сон|устал)|\b(?:I slept|my sleep|I feel tired)\b/iu.test(text))return false;
 if(/медитац|подыш|дыхани|moon seeds|баланс|премиум|premium|запомни|удали|remember that|delete.*memory|\b(?:meditation|breathe|breathing)\b/iu.test(text))return false;
 const tarot=!declinesTarot(text)&&/таро|расклад|выпавш|перев[её]рнут|\b(?:tarot|spread|drawn cards?|reversed)\b/iu.test(text);
 // Generated follow-ups can name any calculated planet, not only Mercury or
 // Venus. Do not drop the exact chart behind a valid “Tell me about Mars”.
 // A leading vocative “Луна,” is the companion, not a Moon-placement request.
 const chartText=text.replace(/^\s*Луна\s*[,!:]\s*/iu,'');
 const astro=/астролог|натальн|планет|солнц|лун[аеуыо]|меркур|венер|марс|юпитер|сатурн|уран|нептун|плутон|транзит|асцендент|\b(?:astrolog\w*|natal|birth chart|planets?|sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|transit|ascendant)\b/iu.test(chartText);
 const pair=/совместим|синастр|\b(?:compatibility|synastry)\b/iu.test(text);
 if(topic==='tarot'&&(astro||pair)||topic!=='tarot'&&tarot||topic==='natal'&&pair)return false;
 if(selected)return true;
 if(topic==='tarot'&&tarot||topic==='natal'&&astro||topic==='compatibility'&&(pair||astro))return true;
 if(text.length>400)return false;
 // Semantic domains of a currently selected artifact, not a conversation title.
 const focus=/сильн\S* сторон|слаб\S* сторон|отношен|общени|талант|карьер|работ|деньг|потенциал|следующ\S* шаг|мо[яейю]+ ситуац|повседнев|ссор|сближа|\b(?:strengths?|challenges?|relationships?|communicat\w*|talents?|career|work|money|potential|next step|my situation|everyday|conflict)\b/iu.test(text);
 const reference=/^(?:а\s+|и\s+|что |как |почему |расскажи|поясни|объясни|подробнее|продолжи|это|какие |какой |какая |какое |каков |в ч[её]м|мо[ийяёе]\S* |наши |and\b|what\b|how\b|why\b|tell\b|explain\b|continue\b|go deeper\b|this\b|my\b|our\b)/iu.test(text);
 return reference&&(focus||/это|об этом|этот|так|связаны|значит|подробнее|продолжи|this|that|these|mean|further|deeper|continue/iu.test(text));
}
export function relevantFollowUpActions(actions:readonly string[],topic:IntelligenceTopic){
 const allowed=topic==='tarot'?['continue','alternative','journal']:topic==='natal'||topic==='compatibility'?['continue','journal']:[];
 return [...new Set(actions)].filter(a=>allowed.includes(a)).slice(0,3);
}
/** Current date-only calculation has no arbitrary-year tool. These discussion
 * prompts cannot advertise a calculation the server does not support. */
export function numerologyQuickReplies(language:'ru'|'en'){
 return language==='ru'?['Как применить это к моей цели?','Каковы ограничения этого метода?']:['How can I apply this to my goal?','What are the limits of this method?'];
}
export function responsePlan(message:string,topic:IntelligenceTopic){
 const detailed=/подроб|глубок|деталь|полный разбор|in detail|deep(?:er)?|comprehensive/iu.test(message);
 return{topic,depth:detailed?'detailed':'concise',intentPriority:'latest_user_request',ordinarySentences:[2,5],artifactOverviewWords:detailed?null:[80,150],maxOptionalReplies:3,requiresCalculationEvidence:topic==='natal'||topic==='compatibility',genuineClarificationOnly:true};
}
