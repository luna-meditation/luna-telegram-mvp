import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
assert.equal(process.versions.node.split('.')[0],'22');
const origin='http://127.0.0.1:55990';
const output=process.env.LUNA23_QA_OUTPUT??'/tmp/luna23-mobile';
const {chromium}=await import(pathToFileURL(process.env.PHASE2_PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({headless:true,executablePath:process.env.PHASE2_CHROME_BIN});
await mkdir(output,{recursive:true});const results=[];
try{
 for(const [width,height]of [[360,800],[375,812],[390,844],[393,852]])for(const language of ['en','ru'])for(const theme of ['dark','light']){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:theme,reducedMotion:'reduce'});
  await context.addInitScript(({language,theme,height,width})=>{
   localStorage.setItem('luna.language.v1',language);localStorage.setItem('luna.theme.preference.v1',theme);
   const handlers=new Set();window.__qaBack=()=>[...handlers].forEach(fn=>fn());
   window.Telegram={WebApp:{initData:'offline-local-qa',initDataUnsafe:{user:{id:880000002,first_name:'Alex',language_code:language}},platform:width===360?'android':'ios',viewportHeight:height,viewportStableHeight:height,ready(){},expand(){},onEvent(){},offEvent(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},HapticFeedback:{impactOccurred(){}},BackButton:{isVisible:false,show(){this.isVisible=true;},hide(){this.isVisible=false;},onClick(fn){handlers.add(fn);},offClick(fn){handlers.delete(fn);}}}};
  },{language,theme,height,width});
  const page=await context.newPage(),errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){external.push(new URL(route.request().url()).hostname);return route.abort();}return route.continue();});
  page.on('dialog',dialog=>dialog.accept());
  await context.request.delete(origin+'/api/universe/memories');
  await context.request.put(origin+'/api/personalization',{data:{display_name:null,interests:[],preferences:'',birth_date:null,birth_time:null,birth_place:null,ai_context_consent:false}});
  await context.request.post(origin+'/api/profile/language',{data:{language}});
  await page.goto(origin,{waitUntil:'networkidle'});await page.locator('.luna2-home').waitFor();
  await page.locator('.bottom-navigation button').nth(3).click();await page.locator('.universe-profile-entry').click();await page.getByTestId('my-universe').waitFor();
  await page.waitForTimeout(400);
  assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
  const geometry=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');};
  await geometry();assert.equal(await page.getByTestId('my-universe').locator(':scope > details').count(),6);
  assert.equal(await page.evaluate(()=>window.Telegram.WebApp.BackButton.isVisible),true);
  assert.equal(await page.locator('.profile-nested-back').isVisible(),false,'No duplicate Telegram Back button');
  if(width===390)await page.screenshot({path:`${output}/${language}-${theme}-universe-empty.png`,fullPage:true});
  await page.getByRole('button',{name:language==='en'?'Add a memory':'Добавить запись',exact:true}).click();
  const editor=page.getByTestId('personal-memory-editor');await editor.locator('select').selectOption('preferences');
  await editor.locator('input:not([type=checkbox])').fill(language==='en'?'Preferred practice':'Любимая практика');
  const value=language==='en'?'I prefer a quiet three-minute evening meditation.':'Я предпочитаю спокойную трёхминутную медитацию вечером.';
  await editor.locator('textarea').fill(value);assert.equal(await editor.locator('input[type=checkbox]').first().isChecked(),false);
  assert.ok(await editor.locator('textarea').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=16);
  await editor.locator('button[type=submit]').click();await editor.waitFor({state:'hidden'});
  let entry=page.locator('.universe-memory').filter({hasText:value}).first();await entry.waitFor();
  assert.ok((await entry.innerText()).includes(language==='en'?'Needs review':'Нужно проверить'));
  await entry.getByRole('button').first().click();await editor.locator('input[type=checkbox]').first().check();await editor.locator('button[type=submit]').click();await editor.waitFor({state:'hidden'});
  entry=page.locator('.universe-memory').filter({hasText:value}).first();assert.ok((await entry.innerText()).includes(language==='en'?'Confirmed':'Подтверждено'));
  if(width===390){await entry.scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/${language}-${theme}-memory-confirmed.png`,fullPage:true});}
  await page.reload({waitUntil:'networkidle'});await page.locator('.bottom-navigation button').nth(3).click();await page.locator('.universe-profile-entry').click();
  await page.locator('.universe-memory').filter({hasText:value}).first().waitFor();
  await page.locator('.universe-memory').filter({hasText:value}).first().getByRole('button').first().click();
  assert.equal(await editor.locator('input[type=checkbox]').first().isChecked(),false,'Edits require fresh confirmation');
  await page.evaluate(()=>window.__qaBack());await editor.waitFor({state:'hidden'});assert.equal(await page.getByTestId('my-universe').isVisible(),true,'Native back closes editor before leaving Universe');
  await page.locator('.universe-memory').filter({hasText:value}).first().getByRole('button').first().click();
  await page.setViewportSize({width,height:500});await editor.locator('textarea').focus();await editor.locator('button[type=submit]').scrollIntoViewIfNeeded();await geometry();
  const box=await editor.locator('button[type=submit]').boundingBox();assert.ok(box.y>=0&&box.y+box.height<=500,'Keyboard-size viewport keeps Save reachable');
  await page.setViewportSize({width,height});await editor.locator('button[type=submit]').click();await editor.waitFor({state:'hidden'});
  await page.locator('.universe-memory').filter({hasText:value}).first().getByRole('button').last().click();await page.locator('.universe-memory').filter({hasText:value}).waitFor({state:'hidden'});
  if(width===390&&language==='en'&&theme==='dark'){
   await page.getByRole('button',{name:'Add a memory',exact:true}).click();await editor.locator('input:not([type=checkbox])').fill('Private reflection');await editor.locator('textarea').fill('Neutral private QA note');await editor.locator('input[type=checkbox]').last().check();await editor.locator('input[type=checkbox]').first().check();await editor.locator('button[type=submit]').click();await editor.waitFor({state:'hidden'});
   const privateEntry=page.locator('.universe-memory').filter({hasText:'Neutral private QA note'}).first();assert.ok((await privateEntry.innerText()).includes('Private · excluded from AI context'));await privateEntry.getByRole('button').first().click();assert.equal(await editor.locator('input[type=checkbox]').last().isChecked(),true,'Editing must preserve private exclusion');await page.evaluate(()=>window.__qaBack());await editor.waitFor({state:'hidden'});await privateEntry.getByRole('button').last().click();
  }
  await page.evaluate(()=>window.__qaBack());await page.locator('.universe-profile-entry').waitFor();
  await page.locator('.bottom-navigation button').nth(2).click();await page.locator('.universe-invitation button').first().click();await page.getByTestId('my-universe').waitFor();await geometry();
  assert.deepEqual(errors,[]);results.push({width,height,language,theme,status:'PASS',checks:['six sections','Telegram back','draft','confirm','reopen','fresh edit consent','delete','mobile keyboard geometry','AI contextual shortcut','no overflow','no runtime errors']});
  await context.close();
 }
 await writeFile(output+'/results.json',JSON.stringify({status:'PASS',cases:results.length,results,physicalTelegramVerified:false,fixtureOnly:true},null,2));
 console.log(JSON.stringify({status:'PASS',cases:results.length,output}));
}finally{await browser.close();}
