// Browser fixtures are LOCAL ONLY; real Telegram/SQL/provider are separate checks.
import assert from 'node:assert/strict';import {mkdir,writeFile,readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {pathToFileURL} from 'node:url';
const tarotImageSources=new Map(Object.entries(JSON.parse(await readFile(new URL('../src/features/tarot/image-manifest.json',import.meta.url),'utf8'))).flatMap(([source,asset])=>asset.variants.map(v=>[v.src,source])));
assert.equal(process.versions.node.split('.')[0],'22');
const origin=process.env.LUNA21_PREVIEW_URL??'http://127.0.0.1:55971';assert.equal(new URL(origin).hostname,'127.0.0.1');
const output=process.env.LUNA21_SCREENSHOT_DIR;assert.ok(output&&process.env.PHASE2_PLAYWRIGHT_MODULE);await mkdir(output,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.PHASE2_PLAYWRIGHT_MODULE).href),browser=await chromium.launch({headless:true,executablePath:process.env.PHASE2_CHROME_BIN});
const cases=[],quick=process.env.LUNA21_QUICK==='true';
try{for(const [width,height] of quick?[[390,844]]:[[360,800],[375,812],[390,844],[393,852],[412,915]])for(const language of ['en','ru'])for(const theme of ['dark','light']){
 const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2,colorScheme:theme,reducedMotion:'reduce'});
 await context.addInitScript(({language,theme,height})=>{localStorage.setItem('luna.language.v1',language);localStorage.setItem('luna.theme.preference.v1',theme);const back=new Set();window.__qaBack=()=>[...back].forEach(fn=>fn());window.Telegram={WebApp:{version:'8.0',initData:'local-only-qa',initDataUnsafe:{user:{id:880000021,first_name:'Alex',language_code:language}},platform:widthAndroid(),viewportHeight:height,viewportStableHeight:height,safeAreaInset:{top:0,bottom:34},contentSafeAreaInset:{top:0,bottom:34},ready(){},expand(){},onEvent(){},offEvent(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},HapticFeedback:{impactOccurred(){}},BackButton:{show(){},hide(){},onClick(fn){back.add(fn);},offClick(fn){back.delete(fn);}}}};function widthAndroid(){return innerWidth===412?'android':'ios';}},{language,theme,height});
 const page=await context.newPage(),errors=[],images=new Set(),rows=new Map();let daily=null,providerCalls=0,paidRequests=0;
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.on('request',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/assets/tarot/cards/')||tarotImageSources.has(u.pathname))images.add(tarotImageSources.get(u.pathname)??u.pathname);if(/invoice|checkout|seed.*purchase/.test(u.pathname))paidRequests++;});
 const fixture=(reading)=>({summary:language==='en'?'LOCAL QA — not a real AI response. A clear small step starts with noticing what needs your attention.':'ЛОКАЛЬНЫЙ QA — не настоящий ответ AI. Небольшой осознанный шаг начинается с внимания к себе.',cardMeaning:language==='en'?'A symbolic layout fixture.':'Символическое значение для проверки интерфейса.',context:language==='en'?'A distinct context paragraph for readability.':'Отдельный контекстный абзац для проверки читабельности.',reflection:language==='en'?'Try one gentle, reversible step.':'Попробуй один мягкий, обратимый шаг.',question:language==='en'?'What feels worth a little attention today?':'Что сегодня заслуживает немного твоего внимания?',continuation:null,...(reading.cards?.length>1?{cardInsights:reading.cards.map(c=>({cardId:c.cardId,text:language==='en'?'Position-specific synthetic interpretation.':'Синтетическая интерпретация позиции карты.'})),links:language==='en'?'A cohesive connection between the cards.':'Связь между картами в общей картине.'}:{})});
 await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin!==origin)return route.abort();
  if(url.pathname==='/api/tarot/daily'){
   const body=req.postDataJSON();if(!daily){daily={id:randomUUID(),client_reading_id:randomUUID(),card_id:'the-star',orientation:theme==='light'?'reversed':'upright',reading_kind:'daily',cards:[{cardId:'the-star',orientation:theme==='light'?'reversed':'upright'}],intention:'general',question:'',language,status:'local',interpretation:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};rows.set(daily.id,daily);}
   if(body.generate&&daily.status==='local'){providerCalls++;daily.status='ready';daily.interpretation=fixture(daily);}
   return route.fulfill({json:{reading:daily,day:'2026-10-14',timezone:'UTC',resetsAt:'2026-10-15T00:00:00Z',reason:null}});
  }
  if(url.pathname==='/api/tarot/spreads'){
   const body=req.postDataJSON().reading;let reading=[...rows.values()].find(r=>r.client_reading_id===body.clientReadingId);if(!reading){reading={id:randomUUID(),client_reading_id:body.clientReadingId,card_id:body.cards[0].cardId,orientation:body.cards[0].orientation,reading_kind:body.kind,cards:body.cards,intention:body.intention,question:body.question,language:body.language,status:'local',interpretation:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};rows.set(reading.id,reading);}
   if(body.generate&&reading.status==='local'){providerCalls++;if(body.kind==='five'&&theme==='light'){reading.status='fallback';reading.fallback_reason='provider_error';}else{reading.status='ready';reading.interpretation=fixture(reading);}}
   return route.fulfill({json:{reading,reason:null}});
  }
  if(url.pathname==='/api/tarot/readings'&&req.method()==='GET')return route.fulfill({json:{readings:[...rows.values()].reverse(),nextOffset:null}});
  if(url.pathname.startsWith('/api/')&&req.method()==='GET'){const response=await route.fetch(),data=await response.json();if(data.user)data.user.language_code=language;return route.fulfill({response,json:data});}
  return route.continue();
 });
 const geometry=async()=>{
  if(await page.locator('.app-shell-chat').count())await page.locator('.luna-live-composer').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');
  assert.equal(await page.locator('.bottom-navigation [aria-current="page"]').count(),1,'Exactly one selected tab');
  const surface=await page.locator('.luna-live-composer').count()?page.locator('.luna-live-composer'):page.locator('.app-shell');
  const shell=await surface.boundingBox(),nav=await page.locator('.bottom-navigation').boundingBox();if(shell&&nav)assert.ok(shell.y+shell.height<=nav.y+1,'Content/composer remains above bottom navigation');
 };
 const shot=async name=>{await geometry();if(width===390)await page.screenshot({path:`${output}/${width}-${language}-${theme}-${name}.png`,fullPage:true});};
 const tab=async index=>{await page.locator('.bottom-navigation button').nth(index).click();await geometry();};
 const back=async()=>{await page.evaluate(()=>window.__qaBack());await page.waitForTimeout(80);};
 await page.goto(origin,{waitUntil:'networkidle'});await page.locator('.luna2-home').waitFor();await shot('home');
 await page.locator('.luna2-daily-card').click();await page.getByTestId('tarot-daily').waitFor();assert.equal(await page.locator('#tarot-question').count(),0);assert.equal(await page.locator('.luna2-back:visible').count(),0);
 await page.getByRole('button',{name:language==='en'?'Open free card':'Открыть бесплатную карту',exact:true}).click();await page.locator('.tarot-card-flip[data-ready="true"]').click();await page.locator('.tarot-ai-label').waitFor();assert.equal(providerCalls,1);await shot('daily');
 const dailyId=await page.locator('.tarot-card-flip').getAttribute('data-card-id');await page.locator('.tarot-card-flip').click();await page.getByRole('dialog').waitFor();await back();await page.getByRole('dialog').waitFor({state:'hidden'});
 await tab(0);await page.locator('.luna2-daily-card').click();await page.locator('.tarot-ai-label').waitFor();assert.equal(providerCalls,1);assert.equal(await page.locator('.tarot-card-flip').getAttribute('data-card-id'),dailyId);await back();await page.getByTestId('tarot-hub').waitFor();await shot('hub');
 for(const kind of ['three','five']){
  const size=kind==='three'?3:5;await page.locator('.tarot-hub-spreads button').nth(kind==='three'?0:1).click();await page.getByTestId(`tarot-spread-${kind}`).waitFor();
  await page.locator('#tarot-spread-question').fill(language==='en'?'What is a small grounded step towards a calmer week?':'Какой небольшой осознанный шаг поможет мне спокойнее прожить эту неделю?');await page.setViewportSize({width,height:height-300});await page.locator('#tarot-spread-question').focus();await page.waitForFunction(()=>document.documentElement.dataset.keyboardOpen==='true');await page.setViewportSize({width,height});await page.locator('#tarot-spread-question').blur();
  await page.getByRole('button',{name:language==='en'?'Shuffle the deck':'Перемешать колоду'}).click();await page.locator(`[data-testid="tarot-spread-${kind}"][data-stage="choose"]`).waitFor();
  for(let i=0;i<size;i++)await page.locator('.tarot-choice-grid button').nth(i).click();assert.equal(await page.locator('.tarot-spread-cards article').count(),size);
  for(let i=0;i<size;i++){const flip=page.locator('.tarot-spread-cards .tarot-card-flip').nth(i);await page.waitForFunction(index=>document.querySelectorAll('.tarot-spread-cards .tarot-card-flip')[index]?.getAttribute('data-ready')==='true',i);await flip.click();await page.waitForFunction(index=>document.querySelectorAll('.tarot-spread-cards .tarot-card-flip')[index]?.getAttribute('aria-pressed')==='true',i);}
  await page.locator(`[data-testid="tarot-spread-${kind}"][data-stage="interpretation"]`).waitFor();
  await page.waitForFunction(()=>document.querySelector('.tarot-spread button.tarot-draw-button:not(:disabled)'));
  await page.getByRole('button',{name:language==='en'?'Reflect with Luna AI':'Осмыслить с Luna AI',exact:true}).click();
  if(kind==='five'&&theme==='light')await page.waitForFunction(()=>document.querySelector('.tarot-spread button.tarot-draw-button')?.disabled);else await page.locator('.tarot-ai-label').waitFor();
  assert.equal(providerCalls,kind==='three'?2:3);await shot(kind);
  await tab(3);await tab(1);await page.locator('[data-category="tarot"]').click();await page.getByTestId(`tarot-spread-${kind}`).waitFor();assert.equal(providerCalls,kind==='three'?2:3);assert.equal(await page.locator('.tarot-spread-cards article').count(),size);await back();await page.getByTestId('tarot-hub').waitFor();
 }
 await tab(1);await page.locator('[data-page="explore"]').waitFor();await shot('explore');assert.equal(await page.locator('.luna2-category').count(),4);await tab(2);await page.locator('[data-page="luna"]').waitFor();await shot('luna-ai');await tab(3);await page.locator('[data-page="profile"]').waitFor();await shot('profile');
 assert.equal(paidRequests,0);assert.ok(images.size<=10,'Card images load on demand, not 78 at once');assert.deepEqual(errors,[]);
 cases.push({width,height,language,theme,providerFixtureCalls:providerCalls,realAiCalls:0,paidRequests:0,runtimeErrors:0,cardImagesRequested:images.size});console.log(`PASS Luna 2.1 ${width}×${height} ${language} ${theme}`);await page.unrouteAll({behavior:'wait'});await context.close();
}}finally{await browser.close();}
await writeFile(`${output}/luna21-mobile-results.json`,JSON.stringify({status:'PASS',cases,physicalTelegram:false,productionRequests:0},null,2)+'\n');
