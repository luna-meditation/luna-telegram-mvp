import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
assert.equal(process.versions.node.split('.')[0],'22');
const origin=process.env.TAROT_FRONTEND_URL??'http://127.0.0.1:55452';
assert.equal(new URL(origin).hostname,'127.0.0.1');
// Real release configuration stays in the artifact. QA intercepts before network.
const apiOrigin=process.env.TAROT_QA_API_ORIGIN;
const fixtureOrigin=process.env.TAROT_QA_FIXTURE_ORIGIN;
if(apiOrigin){assert.equal(new URL(apiOrigin).protocol,'https:');assert.equal(new URL(fixtureOrigin).hostname,'127.0.0.1');}
const output=process.env.TAROT_SCREENSHOT_DIR;assert.ok(output&&process.env.TAROT_PLAYWRIGHT_MODULE&&process.env.TAROT_SHARP_MODULE);
await mkdir(output,{recursive:true});
const manifest=JSON.parse(await readFile(resolve(process.cwd(),'src/features/tarot/manifest.json'),'utf8'));
const {chromium}=await import(pathToFileURL(process.env.TAROT_PLAYWRIGHT_MODULE).href);
const {default:sharp}=await import(pathToFileURL(process.env.TAROT_SHARP_MODULE).href);
const browser=await chromium.launch({headless:true,executablePath:process.env.TAROT_CHROME_BIN});
const results=[];
try{
 for(const [width,height]of [[360,800],[375,812],[390,844],[393,852]])for(const language of ['en','ru'])for(const theme of ['dark','light']){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:theme,reducedMotion:'reduce'});
  await context.addInitScript(({language,theme,height})=>{
   localStorage.setItem('luna.language.v1',language);localStorage.setItem('luna.theme.preference.v1',theme);
   const handlers=new Set();window.__qaBack=()=>{for(const handler of [...handlers])handler();};
   window.Telegram={WebApp:{initData:'synthetic-local-tarot-qa',initDataUnsafe:{user:{id:880000002,first_name:'Alex',language_code:language}},viewportHeight:height,viewportStableHeight:height,platform:'ios',ready(){},expand(){},onEvent(){},offEvent(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},HapticFeedback:{impactOccurred(){}},BackButton:{show(){},hide(){},onClick(handler){handlers.add(handler);},offClick(handler){handlers.delete(handler);}}}};
   const native=crypto.getRandomValues.bind(crypto);window.__tarotWords=[];
   Object.defineProperty(crypto,'getRandomValues',{configurable:true,value(array){if(array instanceof Uint32Array&&array.length===1&&window.__tarotWords.length){array[0]=window.__tarotWords.shift();return array;}return native(array);}});
  },{language,theme,height});
  const page=await context.newPage(),errors=[],writes=[],blocked=[];
  let failFace=false,failCover=width===390;
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(apiOrigin&&url.origin===apiOrigin&&url.pathname.startsWith('/api/')){
    if(request.method()!=='GET')writes.push(url.pathname);
    const response=await context.request.fetch(fixtureOrigin+url.pathname+url.search,{method:request.method(),data:request.postData()??undefined,maxRedirects:0});
    const data=await response.json();if(data.user)data.user.language_code=language;
    return route.fulfill({status:response.status(),json:data});
   }
   if(url.origin!==origin){blocked.push(url.hostname);return route.abort();}
   if(request.method()!=='GET')writes.push(url.pathname);
   if(failFace&&url.pathname==='/assets/tarot/cards/the-fool.webp'){failFace=false;return route.abort();}
   if(failCover&&url.pathname==='/assets/tarot/card-back.webp'){return route.abort();}
   if(['/api/users/sync','/api/access/me','/api/profile/me'].includes(url.pathname)){
    const response=await route.fetch(),data=await response.json();if(data.user)data.user.language_code=language;return route.fulfill({response,json:data});
   }
   return route.continue();
  });
  const stage=async value=>{await page.locator(`[data-testid="tarot-single-card"][data-stage="${value}"]`).waitFor();};
  const verifyPaintedCard=async state=>{
   const bytes=await page.locator('.tarot-card-flip').screenshot({path:`${output}/${width}-${language}-${theme}-${state}-card.png`});
   const stats=await sharp(bytes).stats();assert.ok(stats.channels.slice(0,3).some(channel=>channel.stdev>25),'The card artwork must be painted, not a blank compositing layer');
  };
  const screenshot=async state=>{
   await page.evaluate(()=>document.documentElement.style.setProperty('--tg-content-safe-area-inset-bottom','34px'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(state==='intention')await page.evaluate(()=>window.scrollTo(0,0));
   if(!await page.getByRole('dialog').count()){
    const nav=await page.locator('.bottom-navigation').boundingBox();assert.ok(nav.y+nav.height<=height-33);
   }
   await page.locator('.tarot-page img, .tarot-details img').evaluateAll(async images=>{await Promise.all(images.map(img=>img.decode().catch(()=>{})));});
   await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
   const details=state==='details';
   await page.screenshot({path:`${output}/${width}-${language}-${theme}-${state}.png`,fullPage:!details,style:details?undefined:'.bottom-navigation { visibility: hidden !important; }'});
   if(!details)await page.screenshot({path:`${output}/${width}-${language}-${theme}-${state}-viewport.png`,fullPage:false});
  };
  await page.goto(origin+'/?startapp=tarot',{waitUntil:'networkidle'});await stage('intention');
  if(failCover){
   await page.locator('.tarot-error').waitFor();assert.equal(await page.locator('.tarot-draw-button').isDisabled(),true);
   failCover=false;await page.locator('.tarot-error button').click();await page.waitForFunction(()=>{const image=document.querySelector('.tarot-card-back-art');return image?.complete&&image.naturalWidth===1024;});
   assert.equal(await page.locator('.tarot-error').count(),0);
  }
  for(const intention of ['general','love','career','growth']){await page.locator(`[data-intention="${intention}"]`).click();assert.equal(await page.locator(`[data-intention="${intention}"]`).getAttribute('aria-pressed'),'true');}
  await page.locator('[data-intention="love"]').click();
  const question=language==='en'?'How can I approach a difficult conversation with honesty and care?':'Как мне подойти к сложному разговору честно и с заботой о себе и другом человеке?';
  await page.locator('#tarot-question').fill(question);
  await screenshot('intention');
  // A resized visual viewport exercises the shared keyboard-inset handling, not a real iOS keyboard.
  await page.locator('#tarot-question').focus();await page.setViewportSize({width,height:height-300});
  await page.locator('#tarot-question').evaluate(el=>el.scrollIntoView({block:'center'}));
  await page.waitForFunction(()=>document.documentElement.dataset.keyboardOpen==='true');
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.keyboardOpen),'true');
  assert.equal(await page.locator('#tarot-question').evaluate(el=>getComputedStyle(el).fontSize),'16px');
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.bottom-navigation')).opacity==='0');
  const input=await page.locator('#tarot-question').boundingBox();assert.ok(input.y>=0&&input.y+input.height<=height-300);
  await page.setViewportSize({width,height});await page.locator('#tarot-question').blur();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.bottom-navigation')).opacity==='1');
  const before=writes.length;
  await page.evaluate(()=>window.__tarotWords=[0,0,0,0,0,0]);await page.locator('.tarot-draw-button').click();await stage('choose');
  assert.equal(await page.locator('.tarot-choice-grid button').count(),5);assert.equal(await page.locator('.tarot-choice-grid img').count(),5);
  const covers=await page.locator('.tarot-choice-grid img').evaluateAll(images=>images.map(img=>({path:new URL(img.src).pathname,fit:getComputedStyle(img).objectFit,ratio:img.getBoundingClientRect().width/img.getBoundingClientRect().height})));
  assert.ok(covers.every(img=>img.path==='/assets/tarot/card-back.webp'&&img.fit==='contain'&&Math.abs(img.ratio-2/3)<.001));
  await screenshot('choose');
  // Preserve the prepared deck and question before selection when moving between primary tabs.
  await page.locator('.bottom-navigation button').nth(3).click();await page.locator('[data-page="profile"]').waitFor();
  assert.equal(await page.locator('.luna2-wallet-copy > b').innerText(),'123');assert.match(await page.locator('.profile-plan-status').innerText(),/lifetime|пожизненн|навсегда/i);
  await page.locator('.bottom-navigation button').nth(1).click();await page.locator('[data-category="tarot"]').click();await stage('choose');
  if(width===390)failFace=true;
  await page.evaluate(()=>{const cards=document.querySelectorAll('.tarot-choice-grid button');cards[0].click();cards[1].click();});await stage('reveal');
  if(width===390){await page.locator('.tarot-card-stage .tarot-error').waitFor();assert.equal(await page.locator('.tarot-card-flip').isDisabled(),true);await screenshot('image-retry');await page.locator('.tarot-card-stage .tarot-error button').click();}
  await page.locator('.tarot-card-flip[data-ready="true"]').waitFor();
  assert.equal(await page.locator('.tarot-card-flip').getAttribute('data-card-id'),'the-fool');
  assert.equal(await page.locator('.tarot-card-flip').getAttribute('data-orientation'),'upright');
  assert.equal(await page.locator('.tarot-meaning').count(),0);assert.equal(await page.locator('.tarot-card-front').getAttribute('aria-hidden'),'true');await screenshot('reveal');
  await page.locator('.tarot-card-flip').focus();await page.keyboard.press('Enter');await stage('interpretation');
  assert.equal(await page.locator('.tarot-meaning h2').innerText(),language==='en'?'The Fool':'Шут');assert.equal(await page.locator('.tarot-question-summary p').innerText(),question);
  const geometry=await page.locator('.tarot-card-front img').evaluate(img=>({fit:getComputedStyle(img).objectFit,radius:getComputedStyle(img).borderRadius,width:img.naturalWidth,height:img.naturalHeight,ratio:img.getBoundingClientRect().width/img.getBoundingClientRect().height,transform:getComputedStyle(img).transform}));
  assert.equal(geometry.fit,'contain');assert.equal(geometry.radius,'0px');assert.equal(geometry.width,1024);assert.equal(geometry.height,1536);assert.ok(Math.abs(geometry.ratio-2/3)<.0001);assert.equal(geometry.transform,'none');
  await screenshot('upright');
  await verifyPaintedCard('upright');
  await page.locator('.tarot-details-button').click();await page.getByRole('dialog').waitFor();await screenshot('details');
  assert.equal(await page.locator('.app-root').getAttribute('inert'),'');
  await page.keyboard.press('Tab');assert.equal(await page.locator('.tarot-details button').first().evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.locator('.app-root').getAttribute('inert'),null);
  await page.locator('.tarot-details-button').click();await page.getByRole('dialog').waitFor();await page.evaluate(()=>window.__qaBack());await page.getByRole('dialog').waitFor({state:'hidden'});await stage('interpretation');
  // Revealed reading survives a primary-tab round trip without pretending to be server history.
  await page.locator('.bottom-navigation button').first().click();await page.locator('.luna2-daily-card').click();await stage('interpretation');assert.equal(await page.locator('.tarot-card-flip').getAttribute('data-card-id'),'the-fool');
  await page.locator('.tarot-draw-button').scrollIntoViewIfNeeded();
  let button=await page.locator('.tarot-draw-button').boundingBox(),nav=await page.locator('.bottom-navigation').boundingBox();assert.ok(button.y+button.height<nav.y,'New-reading action clears the bottom navigation');
  await page.locator('.tarot-draw-button').click();await stage('intention');assert.equal(await page.locator('#tarot-question').inputValue(),'');
  await page.locator('[data-intention="career"]').click();
  if(width===390){await page.locator('#tarot-question').fill((language==='ru'?'Очень длинный вопрос с переносами и словами для проверки читаемости.\n':'A long question with line breaks for mobile readability.\n').repeat(5));}
  await page.evaluate(()=>window.__tarotWords=[77,0,0,0,0,1]);await page.locator('.tarot-draw-button').click();await stage('choose');await page.locator('.tarot-choice-grid button').first().click();await stage('reveal');await page.locator('.tarot-card-flip[data-ready="true"]').waitFor();await page.locator('.tarot-card-flip').focus();await page.keyboard.press('Space');await stage('interpretation');
  assert.equal(await page.locator('.tarot-card-flip').getAttribute('data-card-id'),'king-of-pentacles');assert.equal(await page.locator('[data-testid="tarot-orientation"]').innerText(),language==='en'?'Reversed':'Перевёрнутое положение');
  assert.equal(await page.locator('.tarot-card-front img').evaluate(img=>getComputedStyle(img).transform),'none');await screenshot('reversed');await verifyPaintedCard('reversed');assert.equal(writes.length,before,'Tarot must never write to backend');
  if(width===390&&language==='en'&&theme==='dark'){
   const decoded=await page.evaluate(async cards=>{const queue=[...cards],loaded=[];await Promise.all(Array.from({length:4},async()=>{while(queue.length){const card=queue.shift(),img=new Image();img.src=card.image;await img.decode();loaded.push({id:card.id,width:img.naturalWidth,height:img.naturalHeight});}}));return loaded;},manifest.cards);assert.equal(decoded.length,78);assert.ok(decoded.every(img=>img.width===1024&&img.height===1536));
  }
  if((width===360||width===390)&&language==='en'){
   await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('.tarot-draw-button').click();await page.evaluate(()=>window.__tarotWords=[0,0,0,0,0,0]);await page.locator('.tarot-draw-button').click();await stage('shuffling');
   assert.equal(await page.locator('.tarot-shuffle-stack > div').first().evaluate(el=>getComputedStyle(el).animationName),'tarot-shuffle');
   const bounds=await page.locator('.tarot-shuffle-stack > div').evaluateAll(cards=>cards.map(card=>({left:card.getBoundingClientRect().left,right:card.getBoundingClientRect().right})));
   assert.ok(bounds.every(card=>card.left>=0&&card.right<=width),'Animated card backs stay inside the mobile viewport');
   await page.screenshot({path:`${output}/${width}-${language}-${theme}-shuffle.png`,fullPage:false});
   await page.locator('.bottom-navigation button').nth(3).click();await page.locator('[data-page="profile"]').waitFor();
   await page.locator('.bottom-navigation button').first().click();await page.locator('.luna2-daily-card').click();
   await stage('choose');await page.locator('.tarot-choice-grid button').first().click();await page.locator('.tarot-card-flip[data-ready="true"]').waitFor();assert.equal(await page.locator('.tarot-card-rotator').evaluate(el=>getComputedStyle(el).transitionDuration),'0.65s');
   await page.locator('.tarot-card-flip').click();await page.waitForTimeout(200);assert.match(await page.locator('.tarot-card-rotator').evaluate(el=>getComputedStyle(el).transform),/matrix3d/);await page.waitForTimeout(500);
  }else{assert.ok(await page.locator('.tarot-card-rotator').evaluate(el=>parseFloat(getComputedStyle(el).transitionDuration)<=.001));}
  await page.evaluate(()=>window.__qaBack());await page.locator('[data-page="home"]').waitFor();
  await page.locator('.bottom-navigation button').nth(1).click();await page.locator('[data-page="explore"]').waitFor();assert.equal(await page.locator('.luna2-category-grid button').count(),4);
  await page.locator('[data-category="meditations"]').click();await page.locator('[data-page="library"]').waitFor();await page.evaluate(()=>window.__qaBack());await page.locator('[data-page="explore"]').waitFor();
  await page.locator('.bottom-navigation button').nth(3).click();await page.locator('.luna2-garden-entry').click();await page.locator('[data-page="moonGarden"]').waitFor();await page.evaluate(()=>window.__qaBack());await page.locator('[data-page="profile"]').waitFor();
  await page.locator('.bottom-navigation button').nth(2).click();await page.locator('.luna2-ai-actions').waitFor();assert.equal(await page.locator('.luna2-ai-actions button:disabled').count(),2);
  assert.deepEqual(errors,[]);assert.equal(writes.some(path=>/tarot|payment|garden|luna\/chat/.test(path)),false);
  results.push({width,height,language,theme,upright:true,reversedImageUpright:true,keyboardViewport:true,selectionLocked:true,sessionPreserved:true,zoomFocusTrap:true,telegramBack:true,imageRecovery:width===390,reducedMotion:true,allDeckImagesDecoded:width===390&&language==='en'&&theme==='dark'?78:0,balance:123,tarotBackendWrites:0,productionRequests:0,runtimeErrors:0,blockedExternalHosts:[...new Set(blocked)]});
  console.log(`PASS Tarot ${width}×${height} ${language} ${theme}`);await context.close();
 }
}finally{await browser.close();}
await writeFile(output+'/qa-results.json',JSON.stringify({cases:results.length,results,physicalTelegramVerified:false},null,2));
console.log('PASS 16 Tarot mobile cases; all 78 images decode; Tarot backend writes: 0');
