import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {tarotModuleUrl} from './ts-module.mjs';
const {createSpreadSession,reduceSpreadSession}=await import(tarotModuleUrl('spreadSession.ts'));
const {createTarotSession,reduceTarotSession}=await import(tarotModuleUrl('session.ts'));
test('3/5-card interactive selection is once-only and reveals in sequence',()=>{
 for(const kind of ['three','five']){
  let s=createSpreadSession(kind);s=reduceSpreadSession(s,{type:'shuffle',choices:['the-fool','the-star','the-moon','the-sun','the-world'],clientReadingId:'test-id',language:'ru'});s=reduceSpreadSession(s,{type:'ready'});
  s=reduceSpreadSession(s,{type:'choose',slot:0,orientation:'reversed'});assert.equal(reduceSpreadSession(s,{type:'choose',slot:0,orientation:'upright'}),s);
  const size=kind==='three'?3:5;for(let i=1;i<size;i++)s=reduceSpreadSession(s,{type:'choose',slot:i,orientation:'upright'});
  assert.equal(s.stage,'reveal');assert.equal(s.selected.length,size);assert.equal(reduceSpreadSession(s,{type:'reveal',index:1}),s);
  for(let i=0;i<size;i++)s=reduceSpreadSession(s,{type:'reveal',index:i});assert.equal(s.stage,'interpretation');assert.equal(s.selected[0].orientation,'reversed');
 }
});
test('daily and spread results survive tab changes and stale responses cannot replace saved AI',()=>{
 let s=createTarotSession();const daily={day:'2026-10-14',timezone:'UTC',resetsAt:'2026-10-15T00:00:00Z',reading:{id:'saved',status:'ready'},reason:null};
 s=reduceTarotSession(s,{type:'daily',value:daily});s=reduceTarotSession(s,{type:'screen',value:'hub'});assert.equal(s.daily,daily);
 assert.equal(reduceTarotSession(s,{type:'daily',value:{...daily,reading:{...daily.reading,status:'local'}}}),s);
 assert.equal(reduceTarotSession(s,{type:'deleted',id:daily.reading.id}).daily,undefined);
 s=reduceTarotSession(s,{type:'spread',kind:'three',action:{type:'question',value:'Saved question'}});s=reduceTarotSession(s,{type:'screen',value:'single'});s=reduceTarotSession(s,{type:'reset'});assert.equal(s.spreads.three.question,'Saved question');
});
test('Tarot Hub, disabled monetization, privacy and full card proportions are explicit',()=>{
 const hub=readFileSync('src/features/tarot/TarotHub.tsx','utf8');assert.match(hub,/luna21Flags.daily_card_v2/);assert.match(hub,/disabled=\{!featureFlags.tarot_spreads\}/);
 const flags=readFileSync('src/config/luna21Flags.ts','utf8');assert.match(flags,/source\[name\]\?\?''/);for(const name of ['ECONOMY_REWARDS_V2','TAROT_PAID_READINGS','PREMIUM_V2'])assert.match(flags,new RegExp(name));
 const daily=readFileSync('src/features/tarot/DailyTarot.tsx','utf8');assert.match(daily,/00:00 UTC/);assert.match(readFileSync('src/api.ts','utf8'),/expectedDay/);assert.match(daily,/details className="tarot-privacy"/);
 assert.doesNotMatch(readFileSync('src/features/tarot/TarotSpread.tsx','utf8'),/createInvoice|balance\s*[-+]=|localStorage|setPremium/);
 const nav=readFileSync('src/luna2/luna2.css','utf8');assert.match(nav,/luna2-nav-ai:not\(\[aria-current="page"\]\)/);assert.match(nav,/luna2-talk-primary[^\n]+background: #302442/);
});
