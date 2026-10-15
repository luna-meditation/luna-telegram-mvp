// Local synthetic UI evidence only; server persistence is tested separately.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PHASE2_PLAYWRIGHT_MODULE).href);
const origin=process.env.LUNA25_PREVIEW_ORIGIN??'http://127.0.0.1:56026',out=process.env.LUNA25_QA_OUTPUT??'/tmp/luna25-mobile';assert.ok(['127.0.0.1','localhost'].includes(new URL(origin).hostname),'QA fixtures must never target production');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PHASE2_CHROME_BIN});
const results=[];
try{
 for(const [width,height]of [[320,720],[375,812],[390,844],[430,932]])for(const language of ['en','ru'])for(const theme of ['dark','light'])for(const kind of ['single','three','five']){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:theme,reducedMotion:width===320?'reduce':'no-preference'});
  await context.addInitScript(({language,theme,width,height})=>{localStorage.setItem('luna.language.v1',language);localStorage.setItem('luna.theme.preference.v1',theme);const handlers=new Set();window.__qaBack=()=>[...handlers].forEach(fn=>fn());window.Telegram={WebApp:{initData:'offline-local-qa',initDataUnsafe:{user:{id:880000002,first_name:'Alex',language_code:language}},platform:width===320?'android':'ios',viewportHeight:height,viewportStableHeight:height,ready(){},expand(){},onEvent(){},offEvent(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},BackButton:{isVisible:false,show(){this.isVisible=true;},hide(){this.isVisible=false;},onClick(fn){handlers.add(fn);},offClick(fn){handlers.delete(fn);}}}};},{language,theme,width,height});
  const page=await context.newPage(),errors=[],images=new Set(),mutations=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{const request=route.request(),url=new URL(request.url());if(url.origin!==origin)return route.abort();if(url.pathname.includes('/tarot/cards/')){images.add(url.pathname);if(width===320)await new Promise(r=>setTimeout(r,1100));}if(request.method()==='POST'&&url.pathname.includes('/api/luna/tools/tarot'))mutations.push(url.pathname);return route.continue();});
  await context.request.post(origin+'/api/profile/language',{data:{language}});await page.goto(origin,{waitUntil:'networkidle'});
  const nav=page.locator('.bottom-navigation');assert.equal(await nav.locator('button').count(),3);assert.equal(await nav.locator('button').nth(1).innerText(),language==='en'?'Luna AI':'Луна ИИ');
  assert.equal(await page.locator('.luna25-home-categories>button').count(),4);
  assert.ok(await page.locator('.luna25-hero img').first().evaluate(i=>i.complete&&i.naturalWidth>0));
  assert.equal(await page.locator('.luna25-hero h1').evaluate(e=>getComputedStyle(e).color),'rgb(244, 234, 247)','Hero heading must remain light over the supplied night landscape in BOTH themes');
  const check=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal page overflow');await check();
  if(width===390&&kind==='single')await page.screenshot({path:`${out}/${language}-${theme}-home.png`,fullPage:true});
  // Native route back and practical category links remain connected.
  if(kind==='single')for(const category of ['astrology','meditations','breathwork']){await page.locator(`[data-category=${category}]`).tap();await page.evaluate(()=>window.__qaBack());await page.locator('.luna25-home-categories').waitFor();}
  await nav.locator('button').nth(1).tap();await page.getByRole('button',{name:language==='en'?'New conversation':'Новый разговор',exact:true}).tap();
  await page.locator('.luna24-chat-toolbar button').last().tap();const composer=page.locator('.luna24-tarot-composer');await composer.locator('select').nth(1).selectOption(kind);
  await composer.locator('textarea').fill(language==='en'?'How can I communicate openly and respect my boundaries?':'Как общаться открыто, сохраняя собственные границы и уважая другого человека?');
  await page.setViewportSize({width,height:500});await composer.locator('button[type=submit]').scrollIntoViewIfNeeded();await check();await page.setViewportSize({width,height});
  await composer.locator('button[type=submit]').tap();const reading=page.getByTestId('chat-tarot-reading');await reading.waitFor();const size=kind==='single'?1:kind==='three'?3:5,cards=reading.locator('.tarot-card-flip');assert.equal(await cards.count(),size);
  assert.ok((await reading.boundingBox()).width>=width-52);
  const rects=await cards.evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}));
  for(const r of rects){assert.ok(r.x>=0&&r.x+r.width<=width+1);assert.ok(r.width>=74&&r.height>=110);}
  if(size===3)assert.ok(rects.every(r=>Math.abs(r.y-rects[0].y)<1));
  if(size===5){assert.ok(rects.slice(0,3).every(r=>Math.abs(r.y-rects[0].y)<1));assert.ok(rects[3].y>rects[0].y);assert.ok(Math.abs(rects[3].y-rects[4].y)<1);assert.ok(Math.abs((rects[3].x+rects[4].x+rects[4].width)/2-width/2)<3);}
  const activeId=await page.evaluate(()=>localStorage.getItem('luna.ai.activeConversation.v1'));
  for(let i=0;i<size;i++){await cards.nth(i).tap();await page.waitForFunction(({i})=>document.querySelectorAll('[data-testid="chat-tarot-reading"] .tarot-card-flip')[i]?.getAttribute('aria-pressed')==='true',{i});}
  assert.equal(mutations.filter(p=>p.endsWith('/reveal')).length,size,'Exactly one reveal per card');assert.ok(images.size<=size);await check();
  await cards.first().tap();const dialog=page.getByRole('dialog');await dialog.waitFor();assert.ok((await dialog.locator('.tarot-details-position').innerText()).startsWith('1.'));assert.ok((await dialog.locator('.tarot-details-meaning').innerText()).length>20);assert.equal(await dialog.locator('img').evaluate(i=>getComputedStyle(i).objectFit),'contain');await page.evaluate(()=>window.__qaBack());await dialog.waitFor({state:'hidden'});
  const mutationCount=mutations.length;await nav.locator('button').nth(2).tap();await nav.locator('button').nth(1).tap();await reading.waitFor();assert.equal(await cards.count(),size);
  await page.reload({waitUntil:'networkidle'});await nav.locator('button').nth(1).tap();await reading.waitFor();assert.equal(await reading.locator('[aria-pressed=true]').count(),size);assert.equal(await page.evaluate(()=>localStorage.getItem('luna.ai.activeConversation.v1')),activeId);assert.equal(mutations.length,mutationCount,'History and reopening never regenerate');
  if(width===390){await page.locator('.luna-live-message-list').evaluate(e=>e.scrollTop=0);await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)&&Number(a.effect?.getComputedTiming().endTime)<1000).map(a=>a.finished.catch(()=>{}))));await page.screenshot({path:`${out}/${language}-${theme}-${kind}.png`,fullPage:true});}
  await reading.getByRole('button',{name:language==='en'?'Discuss with Luna':'Обсудить с Luna',exact:true}).tap();await page.locator('.luna-live-message-user').waitFor();await page.locator('.luna24-chat[aria-busy=false]').waitFor();const messages=await page.locator('.luna-live-message-row').count();await reading.getByRole('button',{name:language==='en'?'Discuss with Luna':'Обсудить с Luna',exact:true}).tap();await page.locator('.luna24-chat[aria-busy=false]').waitFor();assert.equal(await page.locator('.luna-live-message-row').count(),messages);
  const input=await page.locator('.luna-live-composer').boundingBox(),bar=await nav.boundingBox();assert.ok(input.y+input.height<=bar.y+2);assert.deepEqual(errors,[]);
  results.push({width,height,language,theme,kind,status:'PASS',realAiCalls:0,selectedImageRequests:images.size});await context.close();console.log(`${results.length}/48 PASS ${width} ${language} ${theme} ${kind}`);
 }
 await writeFile(out+'/results.json',JSON.stringify({status:'PASS',cases:results.length,fixtureOnly:true,productionWrites:0,realAiRequests:0,results},null,2));
}finally{await browser.close();}
