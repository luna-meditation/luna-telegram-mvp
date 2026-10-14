import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const source=new URL('../../frontend/src/features/tarot/manifest.json',import.meta.url);
const destination=new URL('../dist/tarot-catalog.json',import.meta.url);
const manifest=JSON.parse(readFileSync(source,'utf8'));
const content=JSON.parse(readFileSync(new URL('../../frontend/src/features/tarot/content.json',import.meta.url),'utf8'));
if(manifest.cards.length!==78||new Set(manifest.cards.map(c=>c.id)).size!==78)throw new Error('Invalid canonical Tarot manifest');
const cards=manifest.cards.map(card=>{
 const major=card.arcana==='major'?content.majorContent[card.number]:null;
 const minor=card.suit?content.minorContent[card.suit]?.[card.number-1]:null;
 if(!major&&!minor)throw new Error('Missing canonical Tarot meaning');
 return {...card,meaning:{en:{upright:major?.[2]??minor[0],reversed:major?.[4]??minor[2]},ru:{upright:major?.[3]??minor[1],reversed:major?.[5]??minor[3]}}};
});
mkdirSync(new URL('../dist/',import.meta.url),{recursive:true});writeFileSync(destination,JSON.stringify({...manifest,cards}));
