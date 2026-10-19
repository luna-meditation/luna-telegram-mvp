import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
import {importTypescript} from './import-typescript.mjs';
const require=createRequire(import.meta.url),ts=require('typescript'),read=p=>readFileSync('src/'+p,'utf8');
const nav=await importTypescript(new URL('../src/navigation/navigationModel.ts',import.meta.url).pathname);
test('old Explore launches redirect to Home without adding a ghost navigation entry',()=>{
 for(const path of ['/explore','/explore/'])assert.equal(nav.initialPageFromLaunch(path,'','',true),'home');
 assert.equal(nav.initialPageFromLaunch('/','#explore','',true),'home');assert.equal(nav.pageFromStartParam('explore',true),'home');
 assert.deepEqual(nav.initialRouteState('explore',true),{current:'home',trail:[]});
 assert.deepEqual(nav.reduceRouteState({current:'luna',trail:[]},{type:'navigate',page:'explore'},true),{current:'home',trail:[]});
 for(const page of ['tarot','astrology','library','breathCircle'])assert.equal(nav.primaryParent(page,true),'home');
});
test('new Home has four illustrated directions and one separate daily card without an unconditional free-price claim',()=>{
 const home=read('luna2/HomeDiscovery.tsx'),hero=read('v2/components/V2Hero.tsx');
 for(const id of ['tarot','astrology','meditations','breathwork'])assert.equal(home.split(`id:'${id}'`).length,2);
 assert.match(home,/Одна сохранённая интерпретация в день/);assert.doesNotMatch(home,/Бесплатно · одна сохранённая карта в день/);assert.match(home,/Карта дня/);assert.match(home,/luna21Flags.daily_card_v2\?onDaily\?\?onTarot/);
 const daily=read('features/tarot/DailyTarot.tsx');assert.match(daily,/data-testid="daily-price-confirmation"/);assert.match(daily,/disabled=\{busy\|\|!consent\}/);assert.match(daily,/confirmed:true,expectedSeeds:quote.seeds/);
 assert.match(hero,/onMood=|onSelect=\{onMood\}/);assert.match(hero,/moodSaved && activeMood/);assert.match(hero,/Поговорим о самом важном/);
 const manifest=JSON.parse(read('v2/home-hero-25.json'));for(const image of manifest.variants){assert.equal(readFileSync('public'+image.src).length,image.bytes);assert.ok(image.bytes<50000);}
 assert.equal(manifest.width/manifest.height,16/9);
});
test('one tap is queued through image loading and zoom includes full semantic context',()=>{
 const card=read('features/tarot/TarotCard.tsx');assert.match(card,/if\(ready\)onFlip\(\);else setPending\(true\)/);assert.match(card,/pending&&ready&&enabled&&!failed/);assert.doesNotMatch(card,/disabled=\{!ready/);
 assert.match(card,/setTimeout\(\(\)=>setSettled\(true\)/);assert.match(card,/loading="eager"/);
 const zoom=read('features/tarot/TarotDetails.tsx');assert.match(zoom,/tarot-details-position/);assert.match(zoom,/card.meaning\[language\]\[orientation\]/);
});
test('Light theme overrides old light-landscape typography for the new night hero',()=>{
 const css=read('luna25-home.css');
 assert.match(css,/:root\[data-theme="light"\] \.luna2-home \.luna25-hero \.home-v2-atmosphere-copy h1\{color:#f4eaf7\}/);
 assert.match(css,/:root\[data-theme="light"\] \.luna2-home \.luna25-hero \.home-v2-greeting\{color:#f4eaf7d9\}/);
});
