// Public canonical content + isolated browser fixtures. Actual DB/HTTP publication
// is tested separately by the bounded staging integration worker.
import assert from 'node:assert/strict';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {pathToFileURL} from 'node:url';
const baseline=JSON.parse(await readFile('../backend/src/luna42-editorial-baseline.json','utf8')),origin='http://127.0.0.1:56142',out='/tmp/luna42-editorial-mobile',results=[];await mkdir(out,{recursive:true});
const{chromium}=await import(pathToFileURL(process.env.PHASE2_PLAYWRIGHT_MODULE).href),browser=await chromium.launch({headless:true,executablePath:process.env.PHASE2_CHROME_BIN});
const overview={timezone:'UTC',from:'2026-10-11T00:00:00Z',to:'2026-10-18T00:00:00Z',generatedAt:'2026-10-18T00:00:00Z',users:{total:0,registered:0,lifetime:0,fixedTerm:0,active1d:0,active7d:0,active30d:0},ai:{requests:0,success:0,failed:0,costMicrousd:0,unknownCostCalls:0},revenue:{stars:0,purchases:0},features:[],series:[],coverage:{},budget:null};
try{for(const language of ['en','ru'])for(const width of [360,375,390,393]){
 const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),versions=new Map(),published=new Map(),requests=[],errors=[];let failOnce=true;
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await context.addInitScript(language=>{localStorage.setItem('luna.language.v2.880000002',JSON.stringify({mode:language,revision:1,updatedAt:null}));},language);
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!==origin)return route.abort();const p=u.pathname;let json;
  if(p==='/api/admin/me')json={admin:true};if(p==='/api/profile/language-preference')json={mode:language,revision:1,updatedAt:null};if(p==='/api/admin/v4/session')json={role:'owner',permissions:['content.read','content.write','analytics.read','configuration.read'],environment:'staging',financialMutationsAvailable:false};if(p==='/api/admin/v4/overview')json=overview;
  if(p==='/api/content/editorial')json={entries:[...published.values()]};
  if(p==='/api/admin/v4/content'&&route.request().method()==='GET'){const kind=u.searchParams.get('kind');json={items:versions.get(kind)??[],baseline:baseline.filter(e=>e.kind===kind),source:{status:'verified',items:[]},categories:[],coverage:{},publication:'verified_adapter'};}
  if(p==='/api/admin/v4/content'&&route.request().method()==='POST'){
   const body=route.request().postDataJSON();requests.push(body);assert.equal(body.confirmed,true);if(failOnce){failOnce=false;await new Promise(r=>setTimeout(r,150));return route.fulfill({status:503,json:{code:'fixture_unavailable'}});}
   const old=versions.get(body.kind)?.[0];assert.equal(body.expectedVersion,old?.version??0);const version=body.expectedVersion+1;versions.set(body.kind,[{content_key:body.key,version,state:body.state,body:body.body}]);if(body.state==='published')published.set(body.kind,{kind:body.kind,key:body.key,version,body:body.body});if(body.state==='archived')published.delete(body.kind);json={key:body.key,version,state:body.state};
  }
  return json?route.fulfill({json}):route.continue();
 });
 await page.goto(origin+'/admin',{waitUntil:'networkidle'});await page.locator('.admin40-stat').first().waitFor();await page.locator('.admin40-menu').click();await page.getByRole('dialog').getByRole('button',{name:language==='ru'?'Контент':'Content',exact:true}).click();
 const collection=page.getByLabel(language==='ru'?'Коллекция контента':'Content collection'),verified=[];
 for(const kind of ['breathwork','tarot','astrology','garden','achievement','share','bot']){
  await collection.selectOption(kind);const entry=baseline.find(e=>e.kind===kind);await page.locator('.admin40-content-grid button').first().waitFor();await page.locator('.admin40-content-grid button').first().click();
  await page.getByLabel('title EN',{exact:true}).fill('QA '+entry.body.title.en);await page.getByLabel('title RU',{exact:true}).fill('QA '+entry.body.title.ru);await page.getByLabel(language==='ru'?'Причина изменения':'Change reason',{exact:true}).fill('Synthetic editorial QA');
  await page.getByRole('checkbox').last().check();await page.getByRole('button',{name:language==='ru'?'Предпросмотр':'Preview',exact:true}).click();assert.ok((await page.locator('.admin41-editorial-preview').innerText()).includes('QA '+entry.body.title.ru));
  const save=page.getByRole('button',{name:language==='ru'?'Сохранить черновик':'Save draft',exact:true});await save.click();if(kind==='breathwork'){await page.getByRole('alert').waitFor();assert.equal(await page.getByLabel('title EN',{exact:true}).inputValue(),'QA '+entry.body.title.en);await save.click();assert.equal(requests[0].requestId,requests[1].requestId);}
  await page.waitForFunction(()=>document.querySelector('.admin40-form')?.textContent.includes('v1'));await page.getByRole('checkbox').last().check();await page.getByRole('button',{name:language==='ru'?'Опубликовать':'Publish',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.admin40-form')?.textContent.includes('v2'));
  assert.equal(published.get(kind).body.title.en,'QA '+entry.body.title.en);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);verified.push(kind);console.log('PASS editor '+width+' '+language+' '+kind);
 }
 await page.screenshot({path:`${out}/${width}-${language}-editor.png`,fullPage:true});
 const navigate=async destination=>{await page.evaluate(destination=>window.dispatchEvent(new CustomEvent('luna-open-destination',{detail:{destination}})),destination);await page.waitForTimeout(150);};
 await navigate('astrology');await page.getByTestId('astrology-hub').waitFor();assert.ok((await page.getByTestId('astrology-hub').innerText()).includes('QA '+baseline.find(e=>e.kind==='astrology').body.title[language]));await page.screenshot({path:`${out}/${width}-${language}-published-astrology.png`,fullPage:true});
 await navigate('breathwork');const ring=page.getByTestId('luminous-breath-ring');await ring.waitFor();assert.ok((await page.locator('main').innerText()).includes('QA '+baseline.find(e=>e.kind==='breathwork').body.title[language]));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 results.push({width,language,status:'PASS',editorKinds:verified,publishedConsumers:['astrology','breathwork'],cloudWrites:0,providerCalls:0});await context.close();console.log('PASS editorial '+width+' '+language);
}await writeFile(out+'/results.json',JSON.stringify({status:'PASS',results},null,2));}finally{await browser.close();}
