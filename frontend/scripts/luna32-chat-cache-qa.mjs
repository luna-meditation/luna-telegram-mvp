// Synthetic local UI fixtures, not proof of real Telegram authorization.
import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {pathToFileURL} from 'node:url';
const origin=process.env.LUNA32_CACHE_PREVIEW_ORIGIN??'http://127.0.0.1:56073',id='00000000-0000-4000-8000-000000003232';assert.equal(new URL(origin).hostname,'127.0.0.1');
const {chromium}=await import(pathToFileURL(process.env.PHASE2_PLAYWRIGHT_MODULE).href),browser=await chromium.launch({headless:true,executablePath:process.env.PHASE2_CHROME_BIN});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 await context.request.post(origin+'/api/profile/language',{data:{language:'en'}});
 await context.addInitScript(id=>{localStorage.setItem('luna.language.v1','en');localStorage.setItem('luna.ai.activeConversation.v1',id);},id);
 const page=await context.newPage();let status=200,reads=0;
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();
  if(url.pathname==='/api/luna/conversations')return route.fulfill({json:{conversations:Array.from({length:20},(_,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,title:'Synthetic recent '+i,latestMessage:'Local fixture',last_message_at:new Date().toISOString()}))}});
  if(url.pathname==='/api/luna/conversations/'+id){reads++;return route.fulfill({status,json:status===200?{conversation:{id,title:'Older saved conversation'},messages:[{id:'00000000-0000-4000-8000-000000003233',role:'assistant',content:'Older saved conversation remains available.',metadata:{},created_at:new Date().toISOString()}]}:{code:status===404?'conversation_not_found':'temporary_upstream'}});}
  return route.continue();
 });
 await page.goto(origin,{waitUntil:'networkidle'});const tab=name=>page.locator('.bottom-navigation').getByRole('button',{name,exact:true});
 await tab('Luna AI').tap();await page.getByText('Older saved conversation remains available.',{exact:true}).waitFor();assert.equal(reads,1);assert.equal(await page.evaluate(()=>localStorage.getItem('luna.ai.activeConversation.v1')),id);
 status=503;await tab('Home').tap();await tab('Luna AI').tap();await page.locator('.luna-live-error').waitFor();assert.equal(await page.getByText('Older saved conversation remains available.',{exact:true}).count(),1);
 status=404;await tab('Home').tap();await tab('Luna AI').tap();await page.getByText('Older saved conversation remains available.',{exact:true}).waitFor({state:'detached'});assert.equal(await page.evaluate(()=>localStorage.getItem('luna.ai.activeConversation.v1')),null);
 const result={status:'PASS',checks:['owner-checked older conversation opens beyond page one','temporary error preserves same-session cached messages','explicit 404 removes deleted cached messages'],realProviderCalls:0,productionWrites:0,fixture:'local UI only'};await writeFile('/tmp/luna32-chat-cache-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));await context.close();
}finally{await browser.close();}
