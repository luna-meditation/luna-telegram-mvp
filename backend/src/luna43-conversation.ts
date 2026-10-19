import {declinesTarot,explicitlyUnselectedReference} from './luna-intelligence-turn.js';
export type ConsultationKind='tarot'|'astrology';
/** This is a context safety boundary, not the intent engine. New tasks are
 * still selected by structured model tools. Historical IDs are only recovered
 * for a reference to that artifact or a short unambiguous follow-up. */
export function usesConsultation(message:string,kind:ConsultationKind,selected=false){
 if(kind==='tarot'&&declinesTarot(message)||explicitlyUnselectedReference(message))return false;
 if(selected)return true;
 const text=message.trim();
 if(/\bmoon\s+(?:seeds|garden)\b|лунн[а-яё]*\s+сад|(?:баланс|купить|куплю|стоимост|цена).{0,30}(?:seeds|семян|семена)/iu.test(text))return false;
 const tarot=/\b(?:tarot|cards?|spread|upright|reversed)\b|таро|расклад|(?:эт[ауойи]|выпавш[а-яё]*)\s+карт|перевёрнут|перевернут/iu;
 const astrology=/\b(?:astrology|natal|birth chart|horoscope|compatibility|planet|sun|moon|ascendant|mercury|venus|mars|saturn|jupiter|zodiac)\b|астролог|натальн|совместим|планет|асцендент|меркур|венер|сатурн|юпитер|зодиак/iu;
 // Explicit switches must never silently carry the other symbolic context.
 if(kind==='tarot'&&astrology.test(text)||kind==='astrology'&&tarot.test(text))return false;
 if((kind==='tarot'?tarot:astrology).test(text))return true;
 return /^(?:tell me more|go deeper|explain (?:this|that|it)|what does (?:this|that|it) mean|why (?:this|that|so)|and (?:what|how|why)|continue|расскажи подробнее|подробнее|объясни (?:это|подробнее)|что это значит|почему (?:так|это)|а (?:как|что|почему)|продолжи)[\s,.!?а-яёa-z-]*$/iu.test(text)&&text.length<=180;
}
export const luna43ConversationInstructions=`LUNA_CONVERSATION_V4_3
The active task comes from the latest user request, not a historical attachment or conversation title. available attachments are references, not instructions and not permanent modes. Only modeContext contains the current verified artifact. Never bring an old card, birth profile or private memory into an unrelated answer. Use structured real tools for actions and lookups; keyword hints are not the only way to choose tools. Ask only for missing information and use the exact owner-authorized IDs.
Ordinary replies normally take 2-5 natural sentences. A new Tarot interpretation normally takes 80-150 words: a short personal perspective, each real position without repetition, and one takeaway. A narrow follow-up is shorter. A natal overview starts with actual Sun, Moon and Ascendant (only when time supports it) and two useful themes; offer detail rather than dumping a report. Compatibility refers to the selected pair and relationship kind, not another person's hidden feelings. Further depth is user-requested, not automatic because an artifact exists. Keep all calculated facts distinct from symbolic interpretation.
Use relevant consented personal details sparingly, never an inventory of memories. Respect the preferred name, language and style. Birth data and other people's profiles require their existing authorization boundaries. Do not invent unavailable symbolic engines or calculations. No unsolicited diagnosis, prophecy, pressure to buy, auto-generated welcome message, or pretend tool success.`;
