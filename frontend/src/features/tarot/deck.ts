import manifest from './manifest.json';
import {majorContent, minorContent} from './content';

export type TarotSuit = 'wands' | 'cups' | 'swords' | 'pentacles';
export type TarotOrientation = 'upright' | 'reversed';
export type TarotCardDefinition = {
 id: string; name: {en:string;ru:string}; arcana:'major'|'minor'; suit:TarotSuit|null; number:number; rank:string|null;
 image:string; width:number; height:number;
 meaning:{en:Record<TarotOrientation,string>;ru:Record<TarotOrientation,string>};
};

export const tarotDeck: readonly TarotCardDefinition[] = Object.freeze(manifest.cards.map(card => {
 const suit=card.suit as TarotSuit|null;
 const major=card.arcana==='major' ? majorContent[card.number] : null;
 const minor=suit ? minorContent[suit][card.number-1] : null;
 if(!major && !minor)throw new Error('Invalid reviewed Tarot registry');
 return Object.freeze({...card,arcana:card.arcana as 'major'|'minor',suit,meaning:{
  en:{upright:major?.[2]??minor![0],reversed:major?.[4]??minor![2]},
  ru:{upright:major?.[3]??minor![1],reversed:major?.[5]??minor![3]}
 }});
}));
