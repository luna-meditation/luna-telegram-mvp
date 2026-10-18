import type {TarotCardDefinition} from './deck';
import type {AppLanguage,TarotSelection} from '../../api';
/** Only public deck meanings: never reuse a personalized AI summary or question
 * in a shared image without a separate, explicit privacy choice. */
export function publicTarotTakeaway(cards:TarotSelection[],deck:readonly TarotCardDefinition[],language:AppLanguage){
 return cards.flatMap(selection=>{const card=deck.find(c=>c.id===selection.cardId);if(!card)return[];const text=card.meaning[language][selection.orientation],meaning=text.match(/^[^.!?]+[.!?]?/u)?.[0]??text;return cards.length===1?[meaning]:[`${card.name[language]}: ${meaning}`];}).join(' · ').slice(0,220);
}
