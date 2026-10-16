import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8'),manifest=JSON.parse(read('src/v2/home-art-32.json'));
test('five independent responsive Home illustrations retain their original aspect ratio',()=>{
 assert.deepEqual(Object.keys(manifest),['hero','tarot','astrology','meditations','breathwork']);
 const paths=[];for(const [id,asset]of Object.entries(manifest)){assert.ok(asset.width>=1250);assert.equal(asset.width/asset.height,id==='hero'?1.5:1);for(const variant of asset.variants){const bytes=readFileSync('public'+variant.src);assert.equal(bytes.length,variant.bytes);assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.ok(bytes.length<170000);paths.push(variant.src);}}
 assert.equal(new Set(paths).size,11);
});
test('Home artwork changes leave daily-card visuals and interactive actions intact',()=>{
 const home=read('src/luna2/HomeDiscovery.tsx'),hero=read('src/v2/components/V2Hero.tsx');
 assert.match(home,/asset=\{homeArt\[c.id\]\}/);assert.match(home,/onClick=\{c.onOpen\}/);assert.match(home,/<CelestialArt kind="tarot" sizes="88px"/);
 assert.match(hero,/asset=\{premiumHome \? homeArt.hero/);assert.match(hero,/loading="eager"/);assert.match(hero,/fetchPriority="high"/);
 const css=read('src/luna25-home.css');assert.match(css,/min-height:181px/);assert.match(css,/grid-template-columns:repeat\(2/);
});
