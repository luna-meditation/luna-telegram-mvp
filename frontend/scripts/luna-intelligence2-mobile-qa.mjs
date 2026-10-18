// Offline interaction evidence only; real persistence/provider gates run separately.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
assert.equal(process.versions.node.split('.')[0],'22');
const origin=process.env.LUNA_INTELLIGENCE_PREVIEW_ORIGIN??'http://127.0.0.1:56152',out=process.env.LUNA_INTELLIGENCE_QA_OUT??'/tmp/luna-intelligence2-mobile';await mkdir(out,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.PHASE2_PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({headless:true,executablePath:process.env.PHASE2_CHROME_BIN}),results=[];
try{for(const language of ['en','ru'])for(const preference of ['dark','light'])for(const [width,height]of [[360,800],[375,812],[390,844],[393,852]]){
 const en=language==='en',context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce',colorScheme:preference}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(({language,preference})=>{localStorage.setItem('luna.language.v2.880000002',JSON.stringify({mode:language,revision:1,updatedAt:null}));localStorage.setItem('luna.theme.preference.v1',preference);},{language,preference});
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());await page.goto(origin,{waitUntil:'networkidle'});
 const navigate=async destination=>{await page.evaluate(destination=>window.dispatchEvent(new CustomEvent('luna-open-destination',{detail:{destination}})),destination);await page.waitForTimeout(120);};
 const layout=async label=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,label+' horizontal overflow');await page.screenshot({path:`${out}/${width}-${language}-${preference}-${label}.png`,fullPage:true});};
 await layout('home');await navigate('luna');const input=page.locator('.luna-live-composer textarea');await input.waitFor();
 const send=async text=>{await input.fill(text);await input.press('Enter');await page.waitForTimeout(150);};
 await send(en?'Draw five Tarot cards about my career.':'Давай расклад на пять карт о карьере.');const choices=page.locator('.luna-intelligence-tarot .tarot-choice-grid button');await choices.first().waitFor();assert.equal(await choices.count(),5);
 await layout('five-selector');for(let i=0;i<5;i++)await choices.nth(i).click();const reading=page.getByTestId('chat-tarot-reading').last();await reading.waitFor();
 for(let i=0;i<5;i++){await reading.locator('.tarot-card-flip').nth(i).click();await reading.locator('.luna251-inspect-card').nth(i).waitFor();}
 assert.equal(await reading.locator('.luna251-inspect-card').count(),5);await layout('five-revealed');
 await reading.locator('.luna251-inspect-card').nth(1).click();await page.locator('.tarot-details').waitFor();await layout('card-detail');await page.keyboard.press('Escape');await page.locator('.tarot-details').waitFor({state:'detached'});
 await reading.getByRole('button',{name:en?'Share a card':'Поделиться открыткой',exact:true}).click();const share=page.locator('.luna30-share-sheet');await share.waitFor();await share.locator('.luna30-share-preview img').waitFor();
 for(const format of ['story','square','portrait']){await share.locator('select').selectOption(format);await page.waitForFunction(()=>{const image=document.querySelector('.luna30-share-preview img');return image?.complete&&image.naturalWidth===1080;});await layout('share-'+format);}
 await share.getByRole('button',{name:en?'Close sharing preview':'Закрыть открытку',exact:true}).click();
 await send(en?'Let us breathe for one minute.':'Давай подышим одну минуту.');const breath=page.getByTestId('chat-breathing').last();await breath.waitFor();await breath.getByTestId('luminous-breath-ring').click();await page.waitForTimeout(300);assert.equal(await breath.getAttribute('data-session-state'),'running');
 await breath.getByTestId('luminous-breath-ring').click();assert.equal(await breath.getAttribute('data-session-state'),'paused');await navigate('home');await navigate('luna');await breath.waitFor();assert.equal(await breath.getAttribute('data-session-state'),'paused');
 await breath.getByTestId('luminous-breath-ring').click();await breath.getByRole('button',{name:en?'Stop':'Остановить',exact:true}).click();assert.equal(await breath.getAttribute('data-session-state'),'ready');
 const centered=await breath.evaluate(el=>{const ring=el.querySelector('.luna2-breath-visual').getBoundingClientRect(),area=el.getBoundingClientRect();return Math.abs(ring.x+ring.width/2-area.x-area.width/2)<2;});assert.ok(centered,'breathing circle centered');await layout('breathing');
 await send(en?'Find a focus meditaton.':'Подбери медитацию для фокуса.');await page.getByTestId('chat-meditation-card').last().waitFor();await layout('meditation');
 await page.getByRole('button',{name:en?'Conversation history':'История разговоров',exact:true}).click();const search=page.locator('.luna-history-search input');await search.waitFor();await search.fill('no-such-synthetic-title-12345');await page.getByText(en?'No matches in loaded conversations. Try another phrase or load older conversations.':'В загруженных разговорах ничего не найдено. Попробуйте другую фразу или загрузите прежние разговоры.',{exact:true}).waitFor();await search.fill('');await page.locator('.luna-history-group').first().waitFor();await layout('history');
 const first=page.locator('.luna24-history-entry>button').first();await first.click();await input.waitFor();await page.getByTestId('chat-tarot-reading').first().waitFor();
 await navigate('cosmos');await page.getByTestId('universe-overview').waitFor();await layout('cosmos');
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark','Preserve the current Dark-only policy under either OS preference');assert.deepEqual(errors,[]);
 results.push({width,height,language,systemPreference:preference,renderedTheme:'dark',tarotFiveReveal:true,shareFormats:3,breathingPauseResume:true,tabReturn:true,historySearch:true,noOverflow:true,status:'PASS',evidence:'isolated local browser, not physical Telegram or database'});await context.close();console.log(`PASS ${width} ${language} ${preference}`);
}await writeFile(out+'/results.json',JSON.stringify({status:'PASS',cases:results.length,results,providerCalls:0},null,2));}finally{await browser.close();}
