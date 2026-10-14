import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const src=path=>readFileSync(resolve(process.cwd(),'src',path),'utf8');
const json=path=>JSON.parse(src('features/tarot/'+path));
async function module(path){const source=src('features/tarot/'+path).replace("import content from './content.json';",`const content=${JSON.stringify(json('content.json'))};`);const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));}
const {randomIndex,drawOneCard,prepareCardChoices}=await module('draw.ts');
const {createTarotSession,reduceTarotSession,tarotIntentions}=await module('session.ts');
const {buildTarotInterpretation}=await module('interpretation.ts');
const {majorContent,minorContent}=await module('content.ts');
const {tarotCopy}=await module('copy.ts');
const manifest=json('manifest.json'),sources=json('source-map.json'),assets=json('asset-report.json');

test('Tarot has exactly 22 Major and 56 Minor with all four complete suits',()=>{
 assert.equal(manifest.cards.length,78);assert.equal(new Set(manifest.cards.map(c=>c.id)).size,78);
 const majors=manifest.cards.filter(c=>c.arcana==='major');assert.equal(majors.length,22);
 assert.deepEqual(majors.map(c=>c.number),Array.from({length:22},(_,i)=>i));
 for(const suit of ['wands','cups','swords','pentacles']){
  const cards=manifest.cards.filter(c=>c.suit===suit);assert.equal(cards.length,14);
  assert.deepEqual(cards.map(c=>c.number),Array.from({length:14},(_,i)=>i+1));
  assert.deepEqual(cards.slice(10).map(c=>c.rank),['page','knight','queen','king']);
 }
 assert.equal(manifest.cards.find(c=>c.id==='strength').number,8);
 assert.equal(manifest.cards.find(c=>c.id==='justice').number,11);
});
test('every identity has an explicit visually reviewed source, not an OCR guess',()=>{
 assert.equal(sources.cards.length,78);assert.deepEqual(sources.missing,[]);assert.deepEqual(sources.ambiguousIdentities,[]);
 assert.deepEqual(sources.exactDuplicates,[]);assert.deepEqual(sources.pixelDuplicates,[]);
 assert.equal(new Set(sources.cards.map(c=>c.sourceFile)).size,78);
 for(const card of manifest.cards){const evidence=sources.cards.find(c=>c.id===card.id);assert.ok(evidence);assert.equal(evidence.printedTitle,card.name.en.toUpperCase());assert.equal(evidence.sourceFile,card.sourceFile);assert.equal(evidence.evidence,'visible_title_manually_reviewed');}
});
test('all 78 optimized assets exist and match their verified hashes and dimensions',()=>{
 assert.equal(assets.optimizedFiles,78);assert.equal(assets.originalsUnchanged,true);assert.equal(assets.crop,false);
 assert.ok(assets.optimizedBytes<assets.sourceBytes*.2);assert.equal(assets.exifRemoved,true);
 assert.equal(readdirSync(resolve(process.cwd(),'public/assets/tarot/cards')).filter(f=>f.endsWith('.webp')).length,78);
 for(const card of manifest.cards){
  assert.match(card.image,/^\/assets\/tarot\/cards\/[a-z-]+\.webp$/);
  const bytes=readFileSync(resolve(process.cwd(),'public'+card.image));
  assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');
  const record=assets.cards.find(c=>c.id===card.id);assert.equal(record.sha256,createHash('sha256').update(bytes).digest('hex'));
  assert.equal(record.width,1024);assert.equal(record.height,1536);assert.equal(card.width/card.height,2/3);
  assert.equal(record.sourceSha256,sources.cards.find(c=>c.id===card.id).sourceSha256);
 }
});
test('all cards have distinct upright/reversed reflection text in EN and RU',()=>{
 assert.equal(majorContent.length,22);
 for(const card of manifest.cards){
  const row=card.arcana==='major'?majorContent[card.number]:minorContent[card.suit][card.number-1];
  assert.ok(row);for(const text of row)assert.ok(typeof text==='string'&&text.length>2);
  if(card.arcana==='major'){assert.equal(row[0],card.name.en);assert.equal(row[1],card.name.ru);assert.notEqual(row[2],row[4]);assert.notEqual(row[3],row[5]);}
  else{assert.equal(minorContent[card.suit].length,14);assert.notEqual(row[0],row[2]);assert.notEqual(row[1],row[3]);}
 }
 assert.deepEqual(Object.keys(tarotCopy.en),Object.keys(tarotCopy.ru));
});
test('every one of the 78 cards and both orientations can be drawn',()=>{
 for(let i=0;i<78;i++)for(const word of [0,1]){const queue=[i,word];const draw=drawOneCard(manifest.cards,()=>queue.shift());assert.equal(draw.card,manifest.cards[i]);assert.equal(draw.orientation,word?'reversed':'upright');}
});
test('random selection rejects the biased uint32 tail instead of applying naive modulo',()=>{
 const limit=2**32-(2**32%78);const queue=[limit,2**32-1,77,1];
 const draw=drawOneCard(manifest.cards,()=>queue.shift());assert.equal(draw.card,manifest.cards[77]);assert.equal(draw.orientation,'reversed');assert.equal(queue.length,0);
 assert.equal(randomIndex(1,()=>2**32-1),0);assert.equal(randomIndex(2,()=>2**32-1),1);
});
test('invalid or broken randomness fails safely without selecting a guessed card',()=>{
 for(const count of [0,-1,1.5,Infinity])assert.throws(()=>randomIndex(count),RangeError);
 for(const word of [-1,2**32,NaN,1.5])assert.throws(()=>randomIndex(78,()=>word),RangeError);
 assert.throws(()=>randomIndex(78,()=>2**32-1),/provider failed/);assert.throws(()=>drawOneCard([]),RangeError);
});
test('card flip preserves the whole frame, orientation and reduced motion',()=>{
 const css=src('features/tarot/tarot.css'),card=src('features/tarot/TarotCard.tsx');
 assert.match(css,/aspect-ratio: 2 \/ 3/);assert.match(css,/object-fit: contain; border-radius: 0/);
 assert.doesNotMatch(css,/object-fit: cover|img\.is-reversed|rotate\(180deg\)/);
 assert.match(css,/prefers-reduced-motion: reduce[\s\S]*transition: none/);
 assert.match(css,/is-settled \.tarot-card-front \{ transform: none/);
 assert.match(css,/@keyframes tarot-shuffle[^\n]+\* 24px/);
 assert.match(card,/aria-hidden=\{!revealed\}/);assert.match(card,/disabled=\{!ready\|\|failed\}/);
 assert.match(card,/alt=\{revealed\?card.name\[language\]:''\}/);
 assert.match(card,/event.currentTarget.decode\(\)/);
});
test('Tarot is opt-in and does not mutate seeds, history, payments, subscriptions or AI',()=>{
 const app=src('App.tsx'),page=src('features/tarot/TarotPage.tsx');
 assert.match(app,/lazy\(\(\) => import\('\.\/features\/tarot\/TarotPage'\)\)/);
 assert.match(app,/featureFlags\.new_navigation && page === 'tarot' && \(featureFlags\.tarot_daily \?/);
 assert.doesNotMatch(page,/fetch\(|localStorage|saveHistory|createInvoice|sendLunaMessage|plantMoonGarden|setProfile/);
 assert.match(page,/prepareCardChoices\(tarotDeck\)/);assert.match(page,/selectionLocked\.current/);
 assert.match(app,/useReducer\(reduceTarotSession, undefined, createTarotSession\)/);
 const flags=src('config/featureFlagDefinitions.ts');assert.match(flags,/source\[featureFlagEnvironment\[key\]\] \?\? ''/);
});
test('the supplied card back is a verified full-resolution WebP, not CSS artwork',()=>{
 const cover=json('cover-asset.json'),bytes=readFileSync(resolve(process.cwd(),'public'+cover.image));
 assert.equal(cover.sourceFile,'cover-tarot.png');assert.equal(cover.width,1024);assert.equal(cover.height,1536);
 assert.equal(cover.crop,false);assert.equal(cover.resize,false);assert.equal(cover.originalUnchanged,true);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),cover.sha256);assert.ok(bytes.length<cover.sourceBytes*.2);
 assert.match(src('features/tarot/TarotCard.tsx'),/src=\{`\$\{cover.image\}/);
 assert.doesNotMatch(src('features/tarot/TarotCard.tsx'),/tarot-back-orbit|tarot-back-star|Moon size/);
});
test('all 78 cards can occupy every selectable slot, with no duplicates in a choice pool',()=>{
 for(let target=0;target<78;target++)for(let slot=0;slot<5;slot++){
  const pool=[...manifest.cards],words=[];
  for(let k=0;k<5;k++){
   const index=k===slot?pool.findIndex(c=>c.id===manifest.cards[target].id):pool.findIndex((c,i)=>i>=k&&c.id!==manifest.cards[target].id);
   words.push(index-k);[pool[k],pool[index]]=[pool[index],pool[k]];
  }
  const choices=prepareCardChoices(manifest.cards,()=>words.shift());
  assert.equal(choices[slot].id,manifest.cards[target].id);assert.equal(new Set(choices.map(c=>c.id)).size,5);
 }
 assert.throws(()=>prepareCardChoices([1,2]),RangeError);
});
test('one reading follows the four steps and cannot be charged, rerolled or selected twice',()=>{
 let state=createTarotSession();assert.equal(state.stage,'intention');
 const choices=manifest.cards.slice(0,5).map(c=>c.id);
 for(const value of tarotIntentions){state=reduceTarotSession(state,{type:'intention',value});assert.equal(state.intention,value);}
 state=reduceTarotSession(state,{type:'question',value:'  '+ 'Q'.repeat(300)});assert.equal(state.question.length,240);
 assert.equal(reduceTarotSession(state,{type:'choose',slot:0,orientation:'upright'}),state);
 assert.equal(reduceTarotSession(state,{type:'shuffle',choices:[choices[0],choices[0]],at:1}),state);
 state=reduceTarotSession(state,{type:'shuffle',choices,at:123});assert.equal(state.stage,'shuffling');
 assert.equal(reduceTarotSession(state,{type:'shuffle',choices,at:124}),state);
 state=reduceTarotSession(state,{type:'ready'});assert.equal(state.stage,'choose');
 for(const slot of [-1,5,1.5])assert.equal(reduceTarotSession(state,{type:'choose',slot,orientation:'upright'}),state);
 state=reduceTarotSession(state,{type:'choose',slot:3,orientation:'reversed'});
 assert.equal(state.result.cardId,choices[3]);assert.equal(state.result.orientation,'reversed');assert.equal(state.stage,'reveal');
 assert.equal(reduceTarotSession(state,{type:'choose',slot:0,orientation:'upright'}),state);
 state=reduceTarotSession(state,{type:'reveal'});assert.equal(state.stage,'interpretation');
 assert.equal(reduceTarotSession(state,{type:'intention',value:'general'}),state);
 const reset=reduceTarotSession(state,{type:'reset'});assert.equal(reset.serial,1);assert.equal(reset.question,'');assert.equal(reset.result,null);
 assert.doesNotMatch(src('features/tarot/session.ts'),/fetch\(|localStorage|sessionStorage/);
});
test('intention interpretations use the existing upright/reversed local meaning in both languages',()=>{
 for(const language of ['en','ru'])for(const intention of tarotIntentions)for(const orientation of ['upright','reversed']){
  const meaning=majorContent[0][language==='en'?(orientation==='upright'?2:4):(orientation==='upright'?3:5)];
  const result=buildTarotInterpretation(meaning,intention,language);
  assert.ok(result.text.includes(meaning));assert.ok(result.reflection.endsWith('?'));
 }
 for(const language of ['en','ru'])assert.equal(new Set(tarotIntentions.map(i=>buildTarotInterpretation('meaning',i,language).text)).size,4);
 assert.deepEqual(Object.keys(tarotCopy.en.intentions),Object.keys(tarotCopy.ru.intentions));
});
test('card zoom is accessible and Telegram back closes it before leaving the reading',()=>{
 const dialog=src('features/tarot/TarotDetails.tsx'),route=src('navigation/useAppRouteState.ts');
 assert.match(dialog,/role="dialog" aria-modal="true"/);assert.match(dialog,/event.key==='Escape'/);assert.match(dialog,/event.key==='Tab'/);
 assert.match(dialog,/registerBackHandler\(onClose\)/);assert.match(dialog,/registerBackHandler\(null\)/);
 assert.match(dialog,/removeAttribute\('inert'\)/);assert.match(route,/if \(!beforeBackRef.current\?\.\(\)\) goBack\(\)/);
 assert.match(src('features/tarot/tarot.css'),/tarot-details-overlay[^\n]+background: var\(--bg-primary\)/);
});
test('asset preparation fails closed before conversion and never follows output symlinks',()=>{
 const script=readFileSync(resolve(process.cwd(),'scripts/prepare-tarot-assets.mjs'),'utf8');
 assert.match(script,/sourceSha256.*Original changed/s);assert.match(script,/actualDestination!==source/);
 assert.match(script,/!existing\.isSymbolicLink\(\)/);assert.match(script,/flag:'wx'/);
 assert.doesNotMatch(script,/unlink\(|rm\(|\.extract\(|\.resize\(/);
});
test('local Tarot preview is separated from legacy preview and never enables production flags',()=>{
 const script=readFileSync(resolve(process.cwd(),'scripts/phase2-preview.mjs'),'utf8');
 assert.match(script,/process\.argv\.includes\('--tarot'\)/);assert.match(script,/'dist-tarot-preview' : 'dist-phase2'/);
 assert.match(script,/VITE_FEATURE_TAROT_DAILY:tarotPreview\|\|refinementPreview\?'true':'false'/);
 assert.match(script,/connect-src 'self'; media-src 'self'/);
});
