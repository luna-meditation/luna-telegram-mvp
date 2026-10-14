import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
assert.equal(process.versions.node.split('.')[0],'22');
const {chromium}=await import(pathToFileURL(process.env.PHASE1_PLAYWRIGHT_MODULE).href);
const origin=process.env.PHASE1_FRONTEND_URL ?? 'http://127.0.0.1:55441';
assert.equal(new URL(origin).hostname,'127.0.0.1');
const output=process.env.PHASE1_SCREENSHOT_DIR;
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PHASE1_CHROME_BIN});
const newNavigation=process.env.PHASE1_NEW_NAVIGATION==='true';
const layouts=newNavigation?[[390,844]]:[[390,844],[393,852],[375,812],[360,800]];
const results=[];
try{
  for(const [width,height] of layouts)for(const language of ['en','ru'])for(const theme of newNavigation?['dark']:['light','dark']){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true,colorScheme:theme,reducedMotion:'reduce'});
    await context.addInitScript(({language,theme,height})=>{
      localStorage.setItem('luna.language.v1',language);localStorage.setItem('luna.theme.preference.v1',theme);
      const handlers=new Set();window.__qaBack=()=>{for(const handler of [...handlers])handler();};
      window.Telegram={WebApp:{initData:'synthetic-local-qa',initDataUnsafe:{user:{id:880000002,first_name:'QA',language_code:language}},viewportHeight:height,viewportStableHeight:height,platform:'ios',ready(){},expand(){},onEvent(){},offEvent(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},HapticFeedback:{impactOccurred(){}},BackButton:{isVisible:false,show(){this.isVisible=true;},hide(){this.isVisible=false;},onClick(handler){handlers.add(handler);},offClick(handler){handlers.delete(handler);}}}};
    },{language,theme,height});
    const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const meditation={id:'00000000-0000-4000-8000-000000000001',title:'QA meditation',subtitle:'Synthetic practice',description:'Local QA',category:'calm',duration:100,cover_image:'/images/home/hero-night.png',audio_file:'/synthetic-audio.mp3',premium:false,published:true,mood:'Calm',play_count:1,created_at:'2026-10-13T00:00:00Z',translations:{ru:{title:'QA медитация',description:'Локальная проверка'}}};
    const user={first_name:'QA',language_code:language,lifetime_access:true,active_until:'2000-01-01',profile_goals:[]};
    const monday=new Date();monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
    const weekStart=`${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;
    const profile={user,currentWeek:{weekStart,activeDays:0,practiceDays:0,completedDays:0,completedSessions:0,listeningMinutes:0,days:[]},completed:10,completedMeditations:10,dayStreak:5,currentStreak:5,longestStreak:10,minutesListened:100,purchasedPlan:'Lifetime',calmScore:20,rewards:{7:true,14:false,30:false,100:false},moonSeeds:123,moonSeedsAvailable:123,moonSeedsEarnedTotal:345,gardenLevel:3,plantedGardenElements:[],achievements:{unlocked:0,total:0,items:[]}};
    const fixtures={
      '/api/access/me':{hasPremium:true,plan:'Lifetime',user},'/api/profile/me':profile,
      '/api/meditations':{meditations:[meditation]},'/api/categories':{categories:[{id:'qa',name:'Calm',slug:'calm',sort_order:1}]},
      '/api/favorites':{favorites:[]},'/api/history':{history:[]},'/api/payments/recent':{payments:[]},
      '/api/admin/me':{admin:false},'/api/debug/admin':{isAdmin:false},
      '/api/wellness/summary':{todayCheckin:null,weeklyCheckins:[],weeklyCheckinCount:0,achievements:[],level:{title:'Seeker',current:0,progress:0,next:'Adept'}},
      '/api/luna/conversations':{conversations:[]},'/api/luna/memory':{enabled:true,available:true,memories:[]},
      '/api/plans':{plans:{annual:{id:'annual',title:'Annual Premium',amountStars:750,days:365},lifetime:{id:'lifetime',title:'Lifetime Access',amountStars:2499}}},
      '/api/version':{commitSha:'local-qa',apiVersion:'v1',featureFlags:{new_navigation:false,tarot_daily:false,tarot_spreads:false,astrology:false,moon_seeds_wallet_v2:false,moon_seeds_purchases:false,breathwork_audio:false}}
    };
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/admin/me')return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'Admin access only.'})});
      if(url.pathname.startsWith('/api/'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixtures[url.pathname]??{ok:true})});
      if(url.origin!==origin)return route.abort();
      return route.continue();
    });
    await page.goto(origin,{waitUntil:'networkidle'});
    await page.locator('[data-page="home"]').waitFor();
    assert.equal(await page.locator('.bottom-navigation button').count(),newNavigation?4:5);
    assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
    const labels=await page.locator('.bottom-navigation button').allTextContents();
    assert.equal(labels[0],language==='en'?'Home':'Главная');
    const pages=newNavigation?['home','explore','luna','profile']:['home','library','luna','progress','profile'];
    for(let i=0;i<pages.length;i++){
      await page.locator('.bottom-navigation button').nth(i).click();await page.locator(`[data-page="${pages[i]}"]`).waitFor();
      await page.evaluate(()=>document.documentElement.style.setProperty('--tg-content-safe-area-inset-bottom','34px'));
      const geometry=await page.evaluate(()=>{const nav=document.querySelector('.bottom-navigation').getBoundingClientRect();return{overflow:document.documentElement.scrollWidth>innerWidth,navBottom:nav.bottom,height:innerHeight,scroll:document.scrollingElement.scrollTop};});
      assert.equal(geometry.overflow,false);assert.ok(geometry.navBottom<=geometry.height-33);assert.equal(geometry.scroll,0);
      if(pages[i]==='progress')assert.ok((await page.locator('[data-page="progress"]').innerText()).includes('123'),await page.locator('[data-page="progress"]').innerText());
    }
    if(newNavigation){
      const columns=await page.locator('.bottom-navigation').evaluate(nav=>getComputedStyle(nav).gridTemplateColumns.split(' '));assert.equal(columns.length,4);
      await page.locator('.luna2-journey-entry').click();await page.locator('[data-page="progress"]').waitFor();
      assert.equal(await page.evaluate(()=>window.Telegram.WebApp.BackButton.isVisible),true);
      await page.evaluate(()=>window.__qaBack());await page.locator('[data-page="profile"]').waitFor();
    }
    await page.getByRole('button',{name:language==='en'?/Appearance/:/Оформление/}).click();
    assert.equal(await page.evaluate(()=>window.Telegram.WebApp.BackButton.isVisible),true);
    await page.locator('.appearance-theme-card').nth(0).click();
    assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    await page.locator('.appearance-theme-card').nth(1).click();
    assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    if(theme==='light')await page.locator('.appearance-theme-card').nth(0).click();
    await page.evaluate(()=>window.__qaBack());
    await page.locator('.bottom-navigation').waitFor({state:'visible'});
    await page.locator('.bottom-navigation button').first().click();
    await page.evaluate(()=>window.scrollTo(0,500));
    await page.locator('.bottom-navigation button').nth(1).click();
    assert.equal(await page.evaluate(()=>document.scrollingElement.scrollTop),0);
    await page.goto(`${origin}/?tgWebAppStartParam=meditation_${meditation.id}`,{waitUntil:'networkidle'});
    await page.locator('[data-page="player"]').waitFor();
    assert.equal(await page.evaluate(()=>window.Telegram.WebApp.BackButton.isVisible),true);
    await page.evaluate(()=>window.__qaBack());await page.locator('[data-page="home"]').waitFor();
    await page.goto(`${origin}/?startapp=garden`,{waitUntil:'networkidle'});await page.locator('[data-page="moonGarden"]').waitFor();
    await page.evaluate(()=>window.__qaBack());await page.locator(`[data-page="${newNavigation?'profile':'progress'}"]`).waitFor();
    await page.screenshot({path:`${output}/${width}-${language}-${theme}-journey.png`,fullPage:false});
    await page.goto(`${origin}/admin?startapp=profile#admin`,{waitUntil:'networkidle'});await page.locator('[data-page="admin"]').waitFor();
    await page.evaluate(()=>window.__qaBack());await page.locator('[data-page="home"]').waitFor();
    assert.equal(new URL(page.url()).pathname,'/');assert.equal(new URL(page.url()).hash,'');assert.equal(new URL(page.url()).search,'?startapp=profile');
    assert.deepEqual(errors,[]);
    results.push({width,height,language,theme,tabs:newNavigation?4:5,runtimeErrors:0,safeArea:34,telegramBack:true,deepLinks:true});
    console.log(`PASS mobile ${width}x${height} ${language} ${theme}`);await context.close();
  }
}finally{await browser.close();}
console.log(JSON.stringify({cases:results.length,results,realPayments:0,productionRequests:0},null,2));
