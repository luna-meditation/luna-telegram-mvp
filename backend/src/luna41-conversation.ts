/** A mode in an old client/history record is metadata, not an access policy.
 * Only explicit current attachment IDs establish a consultation scope. All
 * ownership and chart-processing consent checks still run in the service. */
export function attachmentMode(input:{mode?:unknown;readingId?:string;chartId?:string;astrology?:unknown}):'tarot'|'astrology'|undefined{
 return input.chartId||input.astrology?'astrology':input.readingId?'tarot':undefined;
}
/** A verified action should not be followed by another permission question to
 * perform exactly the action the user already requested. This never claims a
 * screen/player opened and does nothing when no real action was attached. */
export function readyMeditationCopy(message:string,language:'en'|'ru',hasCard:boolean){
 if(!hasCard)return message;
 const sentences=message.split(/(?<=[.!?])(?=\s)/),question=/^(?:would you like (?:me|us) to (?:prepare|open|play|start)|shall i (?:prepare|open|play|start)|do you want me to (?:prepare|open|play|start)|if you (?:want|would like) to (?:try|start)|хочешь[\s,]*(?:чтобы я|я) (?:подготов|откр|включ|запуст)|если хочешь (?:попробовать|начать).{0,60}(?:дай знать|скажи|напиши))/i;
 const duplicateCardOffer=/^(?:would you like (?:me|us) to (?:attach|show) (?:the |this |a |its |your )?(?:meditation |practice )?card|хочешь[,\s]+(?:(?:чтобы я|я)[,\s]+)?(?:прикрепить|показать)[,\s]+карточк)/i;
 const kept=sentences.filter(s=>!question.test(s.trim())&&!duplicateCardOffer.test(s.trim())).join('').trim();
 return kept||(language==='ru'?'Подобрала практику под твой запрос. Доступные действия — в её карточке.':'I selected a practice for your request. Use its card for the available actions.');
}
export const automaticConversationInstructions=`LUNA_CONVERSATION_V4_1
There is one conversation, not separate restrictive modes. The latest user request determines the task. modeContext describes a selected, authorized attachment, never a restriction on which real app tools you may use. An old Tarot or chart attachment must not block a new meditation, navigation, wallet or general request. For ambiguous follow-ups, use the current selected attachment; for an explicit new task, use the relevant tool instead. Historical attachments remain available but are not automatically the active topic.
Use actual tool results and real UI controls. Recommendation displayed, navigation requested, player opened, playback started, invoice created and payment fulfilled are different states. Never claim a later state without its verified acknowledgment. Keep simple requests brief and execute their real action without another permission loop. Ask only for genuinely missing data or required privacy/payment consent. Never treat an old mode selection as authorization to share new chart data.
Ordinary answers should normally be a few clear sentences, not a repeated report or therapy script. Offer depth only when useful. The explicit current response language is authoritative even when an attachment, catalog item or old message uses another language.`;
