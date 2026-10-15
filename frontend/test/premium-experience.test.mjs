import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
const read=p=>readFileSync(p,'utf8'),require=createRequire(import.meta.url);
test('Russian spread labels distinguish three cards from five cards',()=>{assert.match(read('src/features/tarot/TarotHub.tsx'),/Расклад на 5 карт/);assert.ok(read('src/features/tarot/TarotSpread.tsx').includes("size===5?'карт':'карты'"));});
test('all responsive assets are present, content-addressed and preserve source dimensions',()=>{
 const sources=new Map();for(const file of ['src/design-system/image-manifest.json','src/features/tarot/image-manifest.json'])for(const[source,asset]of Object.entries(JSON.parse(read(file)))){if(source.startsWith('https://'))assert.match(source,/^https:\/\/vkcdtasbdoeilgfucoax\.supabase\.co\/storage\/v1\/object\/public\/[^?]+$/);else assert.ok(existsSync('public'+source));assert.ok(asset.width>0&&asset.height>0);sources.set(source,asset);for(const v of asset.variants){const bytes=readFileSync('public'+v.src);assert.equal(bytes.length,v.bytes);assert.ok(v.src.includes(createHash('sha256').update(bytes).digest('hex').slice(0,12)));assert.ok(v.width<=asset.width);}}
 assert.equal([...sources.keys()].filter(p=>p.startsWith('/assets/tarot/cards/')).length,78);assert.ok(sources.has('/assets/tarot/card-back.webp'));
 const main=read('src/design-system/image-manifest.json');assert.doesNotMatch(main,/the-fool|ace-of-cups/);
});
test('the visible Home theme alone loads, with eager responsive artwork and no new flags',()=>{
 const hero=read('src/v2/components/V2Hero.tsx');assert.match(hero,/filter\(\(\[theme\]\)=>theme===resolvedTheme\)/);assert.match(hero,/fetchPriority="high"/);assert.match(hero,/OptimizedImage/);
 const css=read('src/premium-experience.css');assert.match(css,/data-app-active="false"/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/aspect-ratio: 4\/3/);
 assert.match(read('src/main.tsx'),/AmbientSky/);
});
test('AI interpretation reuses saved result with progressive disclosure and no generation calls',()=>{
 const source=read('src/features/tarot/TarotAiInterpretation.tsx');assert.match(source,/ai.summary/);assert.match(source,/details className="tarot-ai-details"/);assert.match(source,/ai.context/);assert.match(source,/ai.question/);assert.doesNotMatch(source,/fetch\(|saveTarot|openDailyTarot|createInvoice/);
});
test('journal reuses owner APIs, never harvests private conversations or generates readings',()=>{
 const source=read('src/luna2/JournalPage.tsx');for(const value of ['listTarotReadings','weeklyCheckins','last_played','onReading','reflection'])assert.ok(source.includes(value));assert.doesNotMatch(source,/getLunaConversation|sendLunaMessage|generate:|saveTarotReading|localStorage/);
});
test('chat text supports readable blocks and escapes model-supplied HTML',async()=>{
 const ts=require('typescript');let code=ts.transpileModule(read('src/components/MessageText.tsx'),{compilerOptions:{module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;code=code.replaceAll('"react/jsx-runtime"',JSON.stringify(pathToFileURL(require.resolve('react/jsx-runtime')).href));const {MessageText}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));const {renderToStaticMarkup}=require('react-dom/server');const {createElement}=require('react');const html=renderToStaticMarkup(createElement(MessageText,{text:'## A reflection\n\n**Notice** this.\n\n- First\n- Second\n\n<script>unsafe()</script>'}));assert.match(html,/<h4>A reflection<\/h4>/);assert.match(html,/<strong>Notice<\/strong>/);assert.match(html,/<ul><li>First<\/li><li>Second<\/li><\/ul>/);assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
});
