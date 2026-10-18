import {useMemo} from 'react';
import {tarotDeck} from './deck';
import {useEditorialEntries} from '../../editorial';
export function useTarotDeck(){const entries=useEditorialEntries();return useMemo(()=>tarotDeck.map(card=>{const e=entries.find(e=>e.kind==='tarot'&&e.key===card.id);if(!e?.body.upright||!e.body.reversed)return card;return{...card,editorialDescription:e.body.description,name:e.body.title,image:e.body.image??card.image,meaning:{en:{upright:e.body.upright.en,reversed:e.body.reversed.en},ru:{upright:e.body.upright.ru,reversed:e.body.reversed.ru}}};}),[entries]);}
