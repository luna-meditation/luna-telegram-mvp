import type {IntelligenceActionId,IntelligenceSpread} from './luna-intelligence-contract.js';
import {requestedBreathOptions} from './luna34-conversation.js';
import {intelligenceUuid} from './luna-intelligence-contract.js';
export type IntelligenceCommand={action:IntelligenceActionId;input:Record<string,unknown>;reason:string};
const tarot=/\b(?:tarot|spread|cards?)\b|таро|расклад|(?:одн[ауой]|три|тр[её]х|пять|пят[ьи]|[135])\s+карт/iu;
const newRequest=/\b(?:start|draw|deal|new|another|let'?s|want|give|do|make)\b|давай|сделай|начн[иём]|начнем|хочу|нов[ыо]|ещ[её]|погада|раскин|разлож/iu;
export function isPracticeAccessQuestion(message:string){
 return message.length<=250&&/(?:this|that)\s+(?:practice|meditation)|эт\p{L}*\s+(?:практик\p{L}*|медитац\p{L}*)/iu.test(message)&&/\b(?:access|included|premium|play|allowed)\b|доступ|входит|премиум|слушать/iu.test(message);
}
/** Input is already owner/conversation filtered and newest first. Never reach
 * across an explicit later topic change to a stale meditation recommendation. */
export function selectedPracticeForAccess(messages:readonly {role?:string;metadata?:unknown}[]):string|undefined{
 for(const message of messages){
  if(message.role!=='assistant')continue;
  const m=message.metadata as {meditationAction?:{meditationId?:unknown};recommendedMeditationId?:unknown;contextReset?:boolean}|null;
  const id=m?.meditationAction?.meditationId??m?.recommendedMeditationId;
  if(intelligenceUuid(id))return id;
  if(m?.contextReset)return undefined;
 }
}
export function requestedSpread(message:string):IntelligenceSpread|null{
 const subject=message.split(/(?:вопрос|question)\s*[:—-]/iu)[0];
 const precise=subject.match(/(?:\b([135]|one|three|five|single)[-\s]*(?:cards?|card spread)|(?:на\s+)?(одну|одной|одна|три|тр[её]х|пять|пяти|[135])\s*карт)/iu);
 if(precise){const n=(precise[1]??precise[2]).toLowerCase();return /^(?:5|five|пять|пяти)$/.test(n)?'five':/^(?:3|three|три|тр[её]х)$/.test(n)?'three':'single';}
 message=subject;
 if(/(?:\b5\b|\bfive\b|пять|пят[ьи]|пятикарт)/iu.test(message))return 'five';
 if(/(?:\b3\b|\bthree\b|\b3-card\b|три(?=\s|$|[.,!?-])|тр[её]х|трёхкарт)/iu.test(message))return 'three';
 if(/(?:\b1\b|\bone\b|\bsingle\b|одн[ауыо]|одну|одной)/iu.test(message))return 'single';
 return null;
}
/** High-confidence app commands only. All other requests still use structured
 * model tools; these patterns are not the sole language-understanding layer. */
export function resolveIntelligenceCommand(message:string,active?:{type:string;kind?:IntelligenceSpread}):IntelligenceCommand|null{
 const text=message.normalize('NFKC').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
 // An observable engine limitation is answered by the server, not delegated
 // to prose that may offer unsupported rectification or alternative houses.
 const missingBirthTime=/\bwithout\s+(?:(?:an?|the|exact|known)\s+){0,3}birth\s+time\b|\bbirth\s+time\s+(?:is\s+)?(?:unknown|missing|not known)\b|\b(?:don'?t|do not) know (?:my |the )?birth time\b|(?:без|нет|не знаю).{0,25}врем\S*.{0,15}рожд|врем\S*.{0,15}рожд\S*.{0,20}(?:неизвест|не знаю|не указан)/iu.test(text);
 if(missingBirthTime&&/\b(?:houses?|ascendant)\b|(?<!\p{L})(?:дом(?:а|ов|ы|ах)?|асцендент\p{L}*)(?!\p{L})/iu.test(text))return{action:'capability.unavailable',input:{capability:'unknown_birth_time'},reason:'verified_birth_time_limitation'};
 const requested=text.replace(/(?:\b(?:do not|don'?t want|don'?t|not|without)\s+(?:(?:a|an|the|new|another)\s+)*(?:tarot(?:\s+(?:spread|reading))?|spread|reading)\b|(?:не(?:\s+(?:хочу|надо|нужно|делай|начинай))?|без)\s+(?:(?:нов\p{L}*|ещ[её]\s+од\p{L}*)\s+)?(?:таро|расклад\p{L}*))[^,.;!?]*(?:[,.;!?]|$)/giu,' ');
 // A named calculated system takes precedence over the ambiguous word "карта".
 // Opening a report is distinct from interpreting an already active one.
 const natal=/\b(?:natal|birth)\s+chart\b|натальн\S*\s+карт/iu.test(requested);
 if(!natal&&/\b(?:open|show)\s+(?:the\s+)?astrology\b|(?:открой|покажи).{0,15}(?:раздел\s+)?астрологи/iu.test(requested))return{action:'navigation.open',input:{destination:'astrology'},reason:'explicit_astrology_menu_not_new_report'};
 if(/(?:birth profiles?|профил\p{L}*)/iu.test(requested)&&/(?:choose|select|выбрать|выбери|выбор)/iu.test(requested)&&/\bchart\b|карт\p{L}*/iu.test(requested)&&!/\btarot\b|таро/iu.test(requested))return{action:'astrology.natal',input:{},reason:'select_actual_saved_birth_profile'};
 // A direct Open/Look command must still produce the real chart when that
 // chart is already active. An analysis follow-up is not an Open command.
 if(natal&&/\b(?:open|show|look|check|see)\b|открой|покажи|посмотр|взглян/iu.test(requested)&&!/почему|что.{0,15}знач|\b(?:why|what.{0,15}mean)\b/iu.test(requested))return{action:'astrology.natal',input:{},reason:'explicit_saved_natal'};
 const perspective=/\b(?:astrological|astrology)\s+(?:perspective|point of view)|(?:from|through).{0,20}astrolog|(?:с точки зрения|через).{0,15}астролог|астрологическ\S*\s+(?:сторон|перспектив|точк|взгляд)/iu.test(requested);
 if((natal&&/\b(?:open|show|look|check|see|explore)\b|открой|покажи|посмотр|взглян|разбер|изучи/iu.test(requested)||perspective)&&active?.type!=='natal_chart')return{action:'astrology.natal',input:{},reason:'explicit_saved_natal_or_perspective'};
 if(/(?:\b(?:open|show|find).{0,25}(?:last|previous|saved|past).{0,20}(?:reading|spread)|(?:покажи|открой|найди).{0,20}(?:прошл|сохран[её]н|последн).{0,15}расклад)/iu.test(requested))return{action:'navigation.open',input:{destination:'tarot_history'},reason:'explicit_saved_reading_history'};
 const breath=/\b(?:breathwork|breathing|breathe)\b|подыш|дыхан|дышать/iu.test(requested);
 if(breath&&(/\b(?:start|let'?s|want|do|begin|one|three|five|ten|minute)\b|давай|начн|хочу|минут|запусти|включи/iu.test(requested))&&!/\b(?:explain|what is|how does)\b|объясни|что такое|как работает/iu.test(requested))return {action:'breathing.start',input:requestedBreathOptions(requested),reason:'explicit_breathing_command'};
 if(!natal&&!perspective&&(tarot.test(requested)||/раскин\S*\s+карт|разлож\S*\s+карт/iu.test(requested))&&(newRequest.test(requested)||/^(?:расклад|tarot|[135]-card spread)\s*(?:на|of|with|$)/iu.test(requested))&&!/\b(?:explain|what.*mean|why)\b|объясни|что.{0,15}знач|почему|не\s+(?:делай|начинай|надо)|(?:don't|do not)\s+(?:start|draw|do|make)/iu.test(requested)){
  const kind=requestedSpread(requested)??(/ещ[её]|another/iu.test(requested)&&active?.type==='tarot_reading'?active.kind??null:null);
  const intention=/отношен|люб[ов]|\blove\b|relationship/iu.test(requested)?'love':/карьер|работ|\bcareer\b/iu.test(requested)?'career':/рост|\bgrowth\b/iu.test(requested)?'growth':'general';
  const question=requested.match(/(?:вопрос|question)\s*[:—-]\s*(.+)$/iu)?.[1]?.slice(0,240)??(/\?|работ|отношен|решени|\b(?:career|love|decision|about)\b/iu.test(requested)?requested.slice(0,240):'');
  return {action:'tarot.start',input:{kind,intention,question},reason:'explicit_new_tarot_not_history'};
 }
 if(/\b(?:recommend|suggest|find|play|open|want)\b.{0,55}\bmeditat(?:i)?on\b|(?:подбери|посоветуй|найди|включи|хочу).{0,55}медитац/iu.test(requested)&&!/таро|расклад|\btarot\b|что означает|what.*mean|(?:don't|do not) want.{0,45}meditat|не хочу.{0,45}медитац/iu.test(requested))return{action:'meditation.recommend',input:{goal:requested.slice(0,160)},reason:'explicit_real_catalog_recommendation'};
 if(natal&&/\b(?:open|show)\b|открой|покажи/iu.test(text))return{action:'astrology.natal',input:{},reason:'explicit_saved_natal'};
 if(/compatibility|совместим/iu.test(text)&&/\b(?:start|check|calculate|compare|new|another)\b|давай|проверь|рассчитай|сравни|нов[уы]|друг[иой]/iu.test(text)&&(active?.type!=='compatibility_report'||/\b(?:new|another|other)\b|нов[уы]|друг[иой]/iu.test(text)))return{action:'astrology.compatibility',input:{},reason:'explicit_compatibility_selection'};
 if(/(?:\b(?:where|open|change|switch|select).{0,35}(?:language|russian|english)\b|(?:где|откр|смен|помен|измен|переключ).{0,30}(?:язык|русск|английск))/iu.test(text))return {action:'settings.language',input:{},reason:'actual_language_settings'};
 if(/\b(?:open|show).{0,25}(?:my universe|my cosmos)\b|(?:открой|покажи).{0,20}(?:(?:мой )?космос|мо[её] созвездие)/iu.test(text))return{action:'cosmos.open',input:{},reason:'actual_cosmos_destination'};
 if(/\b(?:open|show).{0,20}journal\b|(?:открой|покажи).{0,20}дневник/iu.test(text)&&!/прошл|недел|месяц|last|previous/iu.test(text))return{action:'journal.open',input:{},reason:'actual_journal_destination'};
 if(/\b(?:want to|let'?s)\s+(?:save|write|keep)\s+(?:a\s+)?(?:thought|reflection|note)|хочу\s+(?:записать|сохранить)\s+(?:мысль|заметку|размышление)/iu.test(text))return{action:'journal.open',input:{},reason:'explicit_journal_creation'};
 if(/^(?:please |luna[, ]+|луна[, ]+)?(?:open|show|открой|покажи)\s+(?:(?:my|the|мои|мой|раздел)\s+)?(?:moon garden|garden|achievements|journey|support|settings|лунный сад|сад|достижения|мой путь|поддержку|помощь|настройки)[.!?]?$/iu.test(text.split(/[,;]/u)[0].trim())){
  const destination=/garden|сад/iu.test(text)?'garden':/achievements|достижения/iu.test(text)?'achievements':/journey|путь/iu.test(text)?'journey':/support|поддержку|помощь/iu.test(text)?'support':'settings';
  return{action:'navigation.open',input:{destination},reason:'explicit_existing_destination'};
 }
 if(/\b(?:make|create|generate|send|export).{0,35}(?:excel|spreadsheet|pdf|docx|powerpoint|downloadable file)\b|(?:сделай|создай|пришли|сгенерируй|выгрузи).{0,35}(?:excel|эксель|pdf|пдф|ворд|презентаци|файл)/iu.test(text))return{action:'capability.unavailable',input:{capability:'file_generation'},reason:'no_verified_file_generation_capability'};
 if(/(?:рассчитай|calculate|build).{0,30}(?:human design|дж[йи]отиш|jyotish|бадз[ыи]|ba\s?zi)/iu.test(text))return{action:'capability.unavailable',input:{capability:'unsupported_calculation'},reason:'no_verified_calculation_engine'};
 return null;
}
