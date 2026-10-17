// Behavioral UI test only. All auth/account data is synthetic and localhost-only.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const origin=process.env.LUNA41_PREVIEW_ORIGIN??'http://127.0.0.1:56040';
assert.equal(new URL(origin).hostname,'127.0.0.1');
const {chromium,webkit}=await import(pathToFileURL(process.env.PHASE2_PLAYWRIGHT_MODULE).href);
const useWebkit=process.argv.includes('--webkit');
const browser=await (useWebkit?webkit:chromium).launch({headless:true,...(!useWebkit?{executablePath:process.env.PHASE2_CHROME_BIN}:{})});
const results=[],out='/tmp/luna41-admin-scroll';await mkdir(out,{recursive:true});
const overview={timezone:'UTC',from:'2026-10-11T00:00:00Z',to:'2026-10-18T00:00:00Z',generatedAt:'2026-10-17T12:00:00Z',users:{total:25,registered:3,lifetime:1,fixedTerm:2,active1d:4,active7d:8,active30d:14},ai:{requests:30,success:28,failed:2,costMicrousd:12000,unknownCostCalls:1},revenue:{stars:100,purchases:1},features:[{id:'tarot',count:12}],series:Array.from({length:7},(_,i)=>({day:`2026-10-${11+i}`,registrations:i,ai_requests:i+2,stars:0,cost_microusd:30,tracked_active:i})),coverage:{},budget:null};
const user={id:'00000000-0000-4000-8000-000000040001',telegram_id:40001,first_name:'Synthetic QA',plan:'lifetime',balance:123,created_at:'2026-10-01T00:00:00Z'};
const sections=[['Dashboard','Обзор'],['Users','Пользователи'],['Luna AI','Луна ИИ'],['Content','Контент'],['Monetization','Монетизация'],['Analytics','Аналитика'],['Referrals','Приглашения'],['Support','Поддержка'],['Settings','Настройки']];
try{
 for(const [width,height]of[[360,800],[375,812],[390,844],[393,852],[430,932],[1440,1000]])for(const language of ['en','ru']){
  if(process.env.LUNA41_QUICK==='true'&&(width!==360||language!=='en'))continue;
  const context=await browser.newContext({viewport:{width,height},isMobile:width<500,hasTouch:width<500,reducedMotion:'reduce'});
  await context.addInitScript(({language,height})=>{localStorage.setItem('luna.language.v2.40001',JSON.stringify({mode:language,revision:1,updatedAt:null}));window.Telegram={WebApp:{initData:'offline-local-qa',initDataUnsafe:{user:{id:40001,language_code:'en'}},platform:'ios',viewportHeight:height,viewportStableHeight:height,ready(){},expand(){},onEvent(){},offEvent(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){}}};},{language,height});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const u=new URL(route.request().url());if(u.origin!==origin)return route.abort();const p=u.pathname;
   const json=p==='/api/admin/me'?{admin:true}:p==='/api/profile/language-preference'?{mode:language,revision:1,updatedAt:null}:p==='/api/admin/v4/session'?{role:'owner',permissions:['analytics.read','users.read','configuration.read','content.read','support.read'],environment:'staging',financialMutationsAvailable:false}:p==='/api/admin/v4/overview'?overview:p==='/api/admin/v4/users'?{items:Array.from({length:20},(_,i)=>({...user,id:user.id+i,telegram_id:40001+i})),total:20,page:1,pageSize:20}:p==='/api/admin/v4/content'?{items:[],source:{items:[]},categories:[],coverage:{},publication:'verified_adapter'}:p==='/api/admin/v4/support'?{items:[],total:0}:p==='/api/admin/v4/operations'?{tools:[],uiAcknowledgements:[],providers:[],referrals:[],economy:[],generatedAt:overview.generatedAt}:p==='/api/admin/v4/runtime'?{environment:'staging',commit:'synthetic-local',model:'gpt-5-mini',database:{status:'verified'},provider:{status:'not_probed'},flags:{},financialMutationsAvailable:false}:p==='/api/admin/v4/audit'?{items:[],total:0}:p==='/api/admin/v4/roles'?{items:[],ownerId:40001}:null;
   return json?route.fulfill({json}):route.continue();
  });
  await page.goto(origin+'/admin',{waitUntil:'networkidle'});await page.locator('.admin40-stat').first().waitFor();
  const shell=page.locator('.app-shell[data-page="admin"]');
  const cdp=!useWebkit&&width<500?await context.newCDPSession(page):null;
  async function gesture(){
   const h=page.viewportSize().height;
   if(cdp)await cdp.send('Input.synthesizeScrollGesture',{x:Math.floor(width*.65),y:Math.floor(h*.75),yDistance:-Math.floor(h*.55),speed:1800,gestureSourceType:'touch',preventFling:true});
   else{await page.mouse.move(width*.65,h-100);await page.mouse.wheel(0,h);}
   await page.waitForTimeout(100);
  }
  for(const[index,names]of sections.entries()){
   if(index){if(width<1000){await page.locator('.admin40-menu').click();await page.getByRole('dialog').getByRole('button',{name:names[language==='en'?0:1],exact:true}).click();}else await page.locator('.admin40-sidebar').getByRole('button',{name:names[language==='en'?0:1],exact:true}).click();await page.waitForTimeout(100);}
   assert.equal(await shell.evaluate(e=>e.scrollTop),0,'New section resets the real scroll surface');
   // Short empty states also need to be safe when genuine long data arrives.
   // Add layout-only content; no data/API success is inferred from this probe.
   await page.evaluate(()=>{const main=document.querySelector('.admin40-main');const probe=document.createElement('div');probe.dataset.scrollProbe='true';probe.style.height='1400px';probe.style.flexShrink='0';const end=document.createElement('button');end.dataset.scrollEnd='true';end.textContent='Local scroll reachability marker';main.append(probe,end);});
   const size=await shell.evaluate(e=>({client:e.clientHeight,scroll:e.scrollHeight}));assert.ok(size.scroll>size.client+500,`Admin ${names[0]} clips content: ${JSON.stringify(size)}`);
   await page.waitForTimeout(150);await gesture();if(await shell.evaluate(e=>e.scrollTop)<=30){await page.waitForTimeout(150);await gesture();}if(await shell.evaluate(e=>e.scrollTop)<=30){await page.screenshot({path:out+'/failure.png'});console.log(JSON.stringify(await page.evaluate(()=>({viewport:{width:innerWidth,height:innerHeight,variable:getComputedStyle(document.documentElement).getPropertyValue('--app-viewport-height')},elements:[...document.querySelectorAll('.app-shell,.admin40,.admin40-main')].map(e=>({class:e.className,rect:e.getBoundingClientRect().toJSON(),scroll:e.scrollHeight,top:e.scrollTop,overflow:getComputedStyle(e).overflowY})),hit:document.elementsFromPoint(innerWidth*.65,innerHeight-70).map(e=>e.className)}))));}assert.ok(await shell.evaluate(e=>e.scrollTop)>30,`Real gesture did not scroll ${names[0]}`);
   for(let i=0;i<10;i++){if(await page.locator('[data-scroll-end]').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}))break;await gesture();}
   assert.equal(await page.locator('[data-scroll-end]').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),true,'Final control is reachable');
   if(width<1000){await page.locator('.admin40-menu').click();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);await shell.evaluate(e=>{e.scrollTop=0;});await gesture();assert.ok(await shell.evaluate(e=>e.scrollTop)>30,'Drawer close must not lock scrolling');}
   // Reduced viewport models keyboard/Telegram resizing; physical keyboard is
   // explicitly not certified by this simulation.
   const keyboardHeight=Math.floor(height*.65);await page.setViewportSize({width,height:keyboardHeight});await page.evaluate(h=>document.documentElement.style.setProperty('--app-viewport-height',h+'px'),keyboardHeight);await page.waitForTimeout(120);await shell.evaluate(e=>{e.scrollTop=0;});await gesture();assert.ok(await shell.evaluate(e=>e.scrollTop)>0,'Viewport resize must keep scrolling');await page.setViewportSize({width,height});await page.evaluate(h=>document.documentElement.style.setProperty('--app-viewport-height',h+'px'),height);await page.waitForTimeout(120);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.evaluate(()=>document.querySelectorAll('[data-scroll-probe],[data-scroll-end]').forEach(e=>e.remove()));
   results.push({width,language,section:names[0],gesture:cdp?'CDP touch':'wheel',status:'PASS'});
  }
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS scroll ${width} ${language}`);
 }
 await writeFile(`${out}/results-${useWebkit?'webkit':'chromium'}.json`,JSON.stringify({status:'PASS',cases:results.length,physicalDevice:false,results},null,2));
}finally{await browser.close();}
