import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const ts=createRequire(import.meta.url)('typescript'),read=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
const compile=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const copyUrl=compile(read('features/astrology/chartCopy.ts'));
const themes=await import(compile(read('features/astrology/astrologyThemes.ts').replace("from './chartCopy'",'from '+JSON.stringify(copyUrl))));
const chart={timePrecision:'exact',planets:[{id:'sun',longitude:10},{id:'mars',longitude:25},{id:'jupiter',longitude:64},{id:'saturn',longitude:112},{id:'mercury',longitude:130},{id:'moon',longitude:165},{id:'venus',longitude:200}],uncertainPlanets:[],aspects:[]};
test('four original, distinct optimized WebP illustrations are present and share a horizontal readable layout',()=>{
 const hashes=[];for(const id of ['natal','compatibility','calendar','path']){const b=readFileSync(new URL('../public/images/astrology/luna32-'+id+'.webp',import.meta.url));assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');assert.ok(b.length<90000);hashes.push(createHash('sha256').update(b).digest('hex'));}assert.equal(new Set(hashes).size,4);
 const hub=read('features/astrology/AstrologyHub.tsx'),css=read('luna32-experience.css');assert.match(hub,/data-astrology-experience/);assert.match(hub,/luna32-astro-card-copy/);assert.match(hub,/manage\('self'\)/);assert.match(hub,/manage\('other'\)/);assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);assert.match(css,/text-decoration:none!important/);
});
test('each path theme uses actual placements and honest uncertainty, never a fabricated personality or success score',()=>{
 for(const language of ['en','ru']){const result=themes.pathThemes(chart,language);assert.equal(result.length,5);assert.deepEqual(result.map(t=>t.id),['motivation','strengths','growth','relationships','work']);assert.ok(result.every(t=>t.facts.length===2&&t.question&&t.reflection));assert.match(result[0].facts[0],language==='en'?/Aries/:/Овен/);const shifted=themes.pathThemes({...chart,planets:chart.planets.map(p=>p.id==='sun'?{...p,longitude:35}:p)},language);assert.notEqual(result[0].reflection,shifted[0].reflection);}
 const uncertain=themes.pathThemes({...chart,timePrecision:'unknown',uncertainPlanets:[{id:'sun',signs:[0,1]}]},'ru')[0];assert.match(uncertain.facts[0],/Овен \/ Телец/);assert.doesNotMatch(uncertain.facts[0],/°/);assert.equal(uncertain.uncertain,true);
});
test('compatibility themes retain real cross-chart directions and distinguish aspects from reflection questions',()=>{
 const cross=[{from:'mercury',to:'venus',type:'square',orb:1},{from:'sun',to:'jupiter',type:'trine',orb:2}];const result=themes.compatibilityThemes({aspects:cross,unknownTime:true},'en');assert.deepEqual(result.find(t=>t.id==='communication').aspects,[cross[0]]);assert.deepEqual(result.find(t=>t.id==='strengths').aspects,[cross[1]]);assert.deepEqual(result.find(t=>t.id==='challenges').aspects,[cross[0]]);
 const page=read('features/astrology/AstrologyPage.tsx');assert.match(page,/Person 1/);assert.match(page,/Person 2/);assert.match(page,/Promise.all\(\[calculateBirthChart\(first/);assert.match(page,/first===second/);assert.match(page,/secondChartId:comparison.secondChartId/);assert.doesNotMatch(page,/Open one chart, then choose/);
});
test('calendar has date selection and navigation, actual planetary snapshots and zero automatic paid generation',()=>{
 const calendar=read('features/astrology/CelestialCalendar.tsx');for(const value of ['selectedDate','moveMonth','moveDay','selected.planets','selected.aspects','12:00 UTC'])assert.ok(calendar.includes(value));assert.doesNotMatch(calendar,/generateAstrologyReport|sendLunaMessage|api.openai|Math.random/);assert.match(calendar,/not personal natal transits or exact peak times/);
});
test('saved mood contracts the same hero smoothly, preserving edit and Talk actions without permanent status text',()=>{
 const hero=read('v2/components/V2Hero.tsx'),css=read('luna32-experience.css');assert.match(hero,/premiumHome && \(moodSaved\|\|moodSaving\) \? 'is-checked-in'/);assert.match(hero,/data-checkin-state/);assert.match(css,/min-height:278px;transition:min-height/);assert.match(css,/hero.is-checked-in\{min-height:230px/);assert.match(css,/prefers-reduced-motion:reduce/);assert.match(hero,/premiumHome && \(moodSaved\|\|moodSaving\) \? null/);
});
