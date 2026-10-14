import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

assert.equal(process.versions.node.split('.')[0], '22');
const origin = process.env.PHASE2_FRONTEND_URL ?? 'http://127.0.0.1:55443';
const tarotEnabled = process.env.PHASE2_TAROT_ENABLED === 'true';
assert.equal(new URL(origin).hostname, '127.0.0.1', 'QA must not point at production');
const output = process.env.PHASE2_SCREENSHOT_DIR;
assert.ok(output && process.env.PHASE2_PLAYWRIGHT_MODULE);
await mkdir(output, {recursive:true});
const {chromium} = await import(pathToFileURL(process.env.PHASE2_PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({headless:true, executablePath:process.env.PHASE2_CHROME_BIN});
const quick = process.env.PHASE2_QUICK === 'true';
const sizes = quick ? [[390,844]] : [[360,800],[375,812],[390,844],[393,852]];
const results = [];
try {
  for(const [width,height] of sizes) for(const language of quick ? ['en'] : ['en','ru']) for(const theme of ['dark','light']) {
    const context = await browser.newContext({viewport:{width,height}, deviceScaleFactor:2, isMobile:true, hasTouch:true, colorScheme:theme, reducedMotion:'reduce'});
    await context.addInitScript(({language,theme,height}) => {
      localStorage.setItem('luna.language.v1',language);
      localStorage.setItem('luna.theme.preference.v1',theme);
      const handlers=new Set(); window.__qaBack=()=>{for(const handler of [...handlers]) handler();};
      window.Telegram={WebApp:{initData:'synthetic-local-qa',initDataUnsafe:{user:{id:880000002,first_name:'Alex',language_code:language}},viewportHeight:height,viewportStableHeight:height,platform:'ios',ready(){},expand(){},onEvent(){},offEvent(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},HapticFeedback:{impactOccurred(){}},BackButton:{isVisible:false,show(){this.isVisible=true;},hide(){this.isVisible=false;},onClick(handler){handlers.add(handler);},offClick(handler){handlers.delete(handler);}}}};
    },{language,theme,height});
    const page=await context.newPage(); const errors=[]; const writes=[]; const external=[]; let savedCheckin=null;
    page.on('pageerror',error=>errors.push(error.message));
    const monday=new Date(); monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
    const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
    const weekStart=`${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;
    const meditation={id:'00000000-0000-4000-8000-000000000001',title:'A quiet return',subtitle:'Come back to the present moment',description:'A gentle moment of stillness. Local QA fixture.',category:'calm',duration:180,cover_image:'/images/home/hero-night.png',audio_file:'/synthetic-audio.wav',premium:false,published:true,mood:'Calm',play_count:24,created_at:'2026-10-13T00:00:00Z',translations:{ru:{title:'Тихое возвращение',subtitle:'Вернись в настоящий момент',description:'Бережный момент тишины. Локальная QA-практика.'}}};
    const history={id:'history-local',meditation_id:meditation.id,last_played:new Date().toISOString(),play_count:2,completion_percent:100,last_position:180,completed:true};
    const user={first_name:'Alex',language_code:language,lifetime_access:true,active_until:'2000-01-01',profile_goals:[]};
    const profile={user,currentWeek:{weekStart,activeDays:3,practiceDays:3,completedDays:3,completedSessions:10,listeningMinutes:42,days:[]},completed:10,completedMeditations:10,dayStreak:5,currentStreak:5,longestStreak:10,minutesListened:100,purchasedPlan:'Lifetime',calmScore:20,rewards:{7:true,14:false,30:false,100:false},moonSeeds:123,moonSeedsAvailable:123,moonSeedsEarnedTotal:345,gardenLevel:3,plantedGardenElements:['first_bloom','lantern_glow','stone_path'],achievements:{unlocked:3,total:10,items:[]}};
    const wellness=()=>({todayCheckin:savedCheckin,weeklyCheckins:savedCheckin?[savedCheckin]:[],weeklyCheckinCount:savedCheckin?1:0,achievements:[],level:{title:'Seeker',current:1,progress:20,next:'Adept'}});
    const fixtures={'/api/access/me':{hasPremium:true,plan:'Lifetime',user},'/api/profile/me':profile,'/api/meditations':{meditations:[meditation]},'/api/categories':{categories:[{id:'calm',name:'Calm',slug:'calm',sort_order:1}]},'/api/favorites':{favorites:[]},'/api/history':{history:[history]},'/api/payments/recent':{payments:[]},'/api/debug/admin':{isAdmin:false},'/api/users/sync':{user},'/api/luna/conversations':{conversations:[]},'/api/luna/memory':{enabled:true,available:true,memories:[]},'/api/plans':{plans:{annual:{id:'annual',title:'Annual Premium',amountStars:750,days:365},lifetime:{id:'lifetime',title:'Lifetime Access',amountStars:2499}}},'/api/version':{commitSha:'local-phase2',apiVersion:'v1',featureFlags:{new_navigation:false,tarot_daily:false,tarot_spreads:false,astrology:false,moon_seeds_wallet_v2:false,moon_seeds_purchases:false,breathwork_audio:false}}};
    fixtures['/api/luna/health']={available:true,enabled:true,model:'offline-qa',errorClass:null};
    await page.route('**/*',route=>{
      const request=route.request();const url=new URL(request.url());
      if(request.method()!=='GET')writes.push(url.pathname);
      if(url.pathname==='/api/admin/me')return route.fulfill({status:403,contentType:'application/json',body:'{"error":"Admin access only."}'});
      if(url.pathname==='/api/wellness/summary')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(wellness())});
      if(url.pathname==='/api/checkins' && request.method()==='POST'){
        savedCheckin={id:'qa-checkin',...request.postDataJSON(),local_date:localDate()};
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({checkin:savedCheckin})});
      }
      if(url.pathname==='/api/luna/chat')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({conversationId:'qa-conversation',message:{id:'qa-assistant-message',role:'assistant',content:language==='en'?'Local QA: let’s take a quiet moment.':'Локальная QA-проверка: найдём момент тишины.',created_at:new Date().toISOString(),metadata:{}},duplicate:false,remaining:7,requestState:'completed'})});
      if(url.pathname.startsWith('/api/'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixtures[url.pathname]??{ok:true})});
      if(url.pathname==='/synthetic-audio.wav'){
        const samples=8000*2;const data=Buffer.alloc(44+samples*2);data.write('RIFF');data.writeUInt32LE(36+samples*2,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(8000,24);data.writeUInt32LE(16000,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(samples*2,40);
        return route.fulfill({status:200,contentType:'audio/wav',body:data});
      }
      if(url.origin!==origin){external.push(url.hostname);return route.abort();}
      return route.continue();
    });
    const checkGeometry=async()=>{
      await page.evaluate(()=>document.documentElement.style.setProperty('--tg-content-safe-area-inset-bottom','34px'));
      const geometry=await page.evaluate(()=>{const nav=document.querySelector('.bottom-navigation').getBoundingClientRect();return{overflow:document.documentElement.scrollWidth>innerWidth,navBottom:nav.bottom,height:innerHeight};});
      assert.equal(geometry.overflow,false);assert.ok(geometry.navBottom<=geometry.height-33);
    };
    const screenshot=async(name)=>{
      await checkGeometry();
      await page.evaluate(()=>Promise.all([...document.images].map(img=>{img.loading='eager';return img.decode().catch(()=>{});} )));
      assert.equal(await page.evaluate(()=>[...document.images].filter(img=>img.currentSrc && !img.naturalWidth).map(img=>img.currentSrc)).then(images=>images.length),0,'All visible local image assets must load');
      await page.screenshot({path:`${output}/${width}-${language}-${theme}-${name}.png`,fullPage:false});
      if(width===390 && language==='en')await page.screenshot({path:`${output}/${width}-${language}-${theme}-${name}-full.png`,fullPage:true});
    };
    const back=async(expected)=>{await page.evaluate(()=>window.__qaBack());await page.locator(`[data-page="${expected}"]`).waitFor();};
    await page.goto(origin,{waitUntil:'networkidle'});await page.locator('.luna2-home').waitFor();
    assert.deepEqual(await page.locator('.bottom-navigation button').allTextContents(),language==='en'?['Home','Explore','Luna AI','Profile']:['Главная','Открытия','Луна ИИ','Профиль']);
    assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
    assert.equal(await page.locator('.luna2-header-seeds').innerText(),'123');
    assert.equal(await page.locator('.luna2-daily-card').getAttribute('data-feature-enabled'),String(tarotEnabled));
    assert.equal(await page.locator('.luna2-quick-actions button').count(),3);
    if(theme==='light')assert.equal(await page.locator('.home-v2-atmosphere-copy h1').evaluate(el=>getComputedStyle(el).color),'rgb(32, 54, 76)');
    assert.equal(await page.locator('.home-v2-mood-pill small').evaluateAll(labels=>labels.every(el=>el.scrollWidth<=el.clientWidth+1)),true,'EN/RU mood labels must remain fully readable');
    await screenshot('home');
    await page.locator('.home-v2-mood-pill').nth(1).click();await page.locator('.home-v2-mood-saved').waitFor();
    assert.equal(await page.locator('.home-v2-atmosphere-copy h1').isVisible(),true);
    await screenshot('home-checked-in');
    await page.locator('.bottom-navigation button').nth(1).click();await page.locator('[data-page="explore"]').waitFor();
    assert.equal(await page.locator('.luna2-category-grid button').count(),4);await screenshot('explore');
    assert.equal(await page.locator('.luna2-category-art .luna2-celestial-art').count(),2);
    for(const image of await page.locator('.luna2-category-art .luna2-celestial-art').all()) {
      assert.equal(await image.evaluate(el=>getComputedStyle(el).objectFit),'contain');
      assert.ok(await image.evaluate(el=>el.naturalWidth>=1024));
    }
    const exploreReadability=await page.locator('.luna2-category-grid').evaluate(el=>[...el.querySelectorAll('.luna2-category-copy')].every(copy=>{
      const title=copy.querySelector('strong'),body=copy.querySelector('span'),card=copy.closest('button');
      return parseFloat(getComputedStyle(title).fontSize)>=19 && parseFloat(getComputedStyle(body).fontSize)>=13 && copy.getBoundingClientRect().bottom<=card.getBoundingClientRect().bottom-8;
    }));assert.equal(exploreReadability,true);
    for(const kind of ['tarot','astrology']){
      const before=writes.length;await page.locator(`[data-category="${kind}"]`).click();
      const testId=kind==='tarot'&&tarotEnabled?'tarot-single-card':`${kind}-preview`;
      await page.getByTestId(testId).waitFor();assert.equal(await page.getByTestId(testId).getAttribute('data-feature-enabled'),String(kind==='tarot'&&tarotEnabled));
      assert.equal(writes.length,before);await screenshot(kind);await back('explore');
    }
    await page.locator('[data-category="meditations"]').click();await page.locator('[data-page="library"]').waitFor();
    assert.ok((await page.locator('.library-page').innerText()).includes(language==='en'?'A quiet return':'Тихое возвращение'));
    await back('explore');
    await page.locator('[data-category="breathwork"]').click();await page.locator('[data-page="breathCircle"]').waitFor();
    assert.equal(await page.locator('.breath-practice-select option').count(),9);
    assert.equal(await page.locator('.luna2-audio-modes button:disabled').count(),2);
    for(const technique of ['calm','box','478','coherent','triangle','sigh','anxiety_reset','sleep','morning_energy']){
      await page.locator('.breath-practice-select select').selectOption(technique);
      assert.ok((await page.locator('.breath-practice-guide p').innerText()).length>25);
    }
    await page.locator('.breath-practice-select select').selectOption('calm');await screenshot('breathwork');
    await page.locator('.breath-circle-primary').click();
    await page.waitForFunction(()=>document.querySelector('[data-testid="luminous-breath-ring"]').dataset.phase==='inhale');
    const ring=await page.locator('.luna2-breath-ring').evaluate(el=>({transform:getComputedStyle(el).transform,transition:getComputedStyle(el).transitionDuration}));
    assert.ok(parseFloat(ring.transition)<=0.00001, 'Reduced motion must disable interpolation');
    await page.locator('.breath-circle-primary').click();assert.equal(await page.locator('.breath-practice-select select').isDisabled(),true);
    const frozen=await page.locator('.luna2-breath-readout strong').innerText();await page.waitForTimeout(550);assert.equal(await page.locator('.luna2-breath-readout strong').innerText(),frozen);
    await page.locator('.breath-circle-restart').click();assert.equal(await page.locator('.breath-practice-select select').isDisabled(),false);await back('explore');
    await page.locator('.bottom-navigation button').nth(2).click();await page.locator('.luna2-chat').waitFor();await page.locator('.luna2-ai-actions').waitFor();
    assert.equal(await page.locator('.luna2-ai-actions button').count(),5);assert.equal(await page.locator('.luna2-ai-actions button:disabled').count(),2);
    assert.equal(await page.locator('.luna2-ai-actions').evaluate(el=>getComputedStyle(el).display),'grid');
    const actionsFit=await page.locator('.luna2-ai-actions').evaluate(el=>[...el.children].every(child=>{const a=child.getBoundingClientRect(),b=el.getBoundingClientRect();return a.left>=b.left-1 && a.right<=b.right+1;}));assert.equal(actionsFit,true);
    await screenshot('luna-ai');
    const before=writes.length;await page.locator('[data-action="feelings"]').click();assert.ok((await page.locator('.luna-live-composer textarea').inputValue()).length>10);assert.equal(writes.length,before);
    await page.locator('.luna-live-composer button[type="submit"]').click();await page.locator('.luna-live-message-assistant').waitFor();
    assert.equal(writes.filter(x=>x==='/api/luna/chat').length,1);
    await page.locator('.bottom-navigation button').nth(3).click();await page.locator('[data-page="profile"]').waitFor();await screenshot('profile');
    assert.equal(await page.locator('.luna2-wallet-copy > b').innerText(),'123');
    assert.match(await page.locator('.luna2-garden-entry img').getAttribute('src'),/level-3-stone-path/);
    await page.locator('.luna2-wallet-copy > b').evaluate(el=>{el.textContent='2147483647';});await checkGeometry();
    const walletFit=await page.locator('.luna2-wallet-copy').evaluate(el=>el.scrollWidth<=el.clientWidth+1);assert.equal(walletFit,true,'Large real balances must not be clipped');
    await page.locator('.luna2-wallet-copy > b').evaluate(el=>{el.textContent='123';});
    assert.match(await page.locator('.profile-plan-status').innerText(),/lifetime|пожизненн|навсегда/i);
    await page.locator('.luna2-wallet-entry').click();await page.locator('[data-page="wallet"]').waitFor();assert.equal(await page.locator('.luna2-balance-card > strong').innerText(),'123');await back('profile');
    await page.locator('.luna2-journey-entry').click();await page.locator('[data-page="progress"]').waitFor();await back('profile');
    await page.locator('.luna2-profile-pair button').nth(0).click();await page.locator('[data-page="achievements"]').waitFor();await page.locator('.progress-v4-achievements-page').waitFor();await back('profile');
    await page.locator('.luna2-profile-pair button').nth(1).click();await page.locator('[data-page="moonGarden"]').waitFor();await back('profile');
    await page.locator('.luna2-activity-entry').click();await page.locator('[data-page="activity"]').waitFor();assert.ok((await page.locator('[data-page="activity"]').innerText()).includes(language==='en'?'A quiet return':'Тихое возвращение'));await back('profile');
    await page.getByRole('button',{name:language==='en'?/Appearance/:/Оформление/}).click();
    await page.locator('.appearance-theme-card').nth(0).click();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    await page.locator('.appearance-theme-card').nth(1).click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    if(theme==='light')await page.locator('.appearance-theme-card').nth(0).click();
    await back('profile');
    await page.locator('.bottom-navigation button').first().click();await page.evaluate(()=>window.scrollTo(0,500));await page.locator('.bottom-navigation button').nth(1).click();assert.equal(await page.evaluate(()=>document.scrollingElement.scrollTop),0);
    await page.goto(`${origin}/?startapp=explore`,{waitUntil:'networkidle'});await page.locator('[data-page="explore"]').waitFor();
    await page.goto(`${origin}/?tgWebAppStartParam=meditation_${meditation.id}`,{waitUntil:'networkidle'});await page.locator('[data-page="player"]').waitFor();await back('home');
    await page.goto(`${origin}/?startapp=garden`,{waitUntil:'networkidle'});await page.locator('[data-page="moonGarden"]').waitFor();await back('profile');
    if(width===390 && language==='en'){
      await page.emulateMedia({reducedMotion:'no-preference'});await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+50));
      await page.locator('.bottom-navigation button').nth(1).click();await page.locator('[data-category="breathwork"]').click();
      await page.locator('.breath-circle-primary').click();await page.clock.runFor(2000);
      const inhaleScale=await page.locator('.luna2-breath-ring').evaluate(el=>Number(el.style.transform.match(/scale\(([^)]+)\)/)[1]));
      assert.ok(Math.abs(inhaleScale-.86)<.03);
      await page.clock.runFor(2200);assert.equal(await page.locator('[data-testid="luminous-breath-ring"]').getAttribute('data-phase'),'exhale');
      await page.clock.runFor(2800);const exhaleScale=await page.locator('.luna2-breath-ring').evaluate(el=>Number(el.style.transform.match(/scale\(([^)]+)\)/)[1]));assert.ok(exhaleScale<1 && exhaleScale>.72);
      await screenshot('breathwork-active');
      await page.locator('.breath-circle-primary').click();const frozen=await page.locator('.luna2-breath-readout strong').innerText();await page.clock.runFor(5000);assert.equal(await page.locator('.luna2-breath-readout strong').innerText(),frozen);
      await page.locator('.breath-circle-primary').click();await page.clock.runFor(2000);assert.equal(await page.locator('[data-testid="luminous-breath-ring"]').getAttribute('data-phase'),'exhale');
      await page.locator('.breath-circle-restart').click();await page.locator('.breath-practice-select select').selectOption('box');await page.locator('.breath-circle-primary').click();await page.clock.runFor(4400);
      assert.equal(await page.locator('[data-testid="luminous-breath-ring"]').getAttribute('data-phase'),'hold');assert.equal(await page.locator('.luna2-breath-ring').evaluate(el=>el.style.transform),'scale(1)');
      await page.clock.runFor(2000);assert.equal(await page.locator('.luna2-breath-ring').evaluate(el=>el.style.transform),'scale(1)');await page.locator('.breath-circle-restart').click();
    }
    await checkGeometry();assert.deepEqual(errors,[]);assert.equal(writes.some(x=>/tarot|astrology|payments|garden\/plant|breath-sessions/.test(x)),false);
    results.push({width,height,language,theme,categories:4,tabs:4,qaBalance:123,techniques:9,runtimeErrors:0,productionRequests:0,blockedExternalHosts:[...new Set(external)]});
    console.log(`PASS Phase 2 ${width}×${height} ${language} ${theme}`);await context.close();
  }
} finally { await browser.close(); }
await writeFile(`${output}/qa-results.json`,JSON.stringify({cases:results.length,results},null,2));
console.log(`PASS ${results.length} Phase 2 mobile cases; production requests: 0`);
