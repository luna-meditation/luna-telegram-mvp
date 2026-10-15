// Reproducible local-only mobile benchmark. No production authentication or AI.
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PHASE2_PLAYWRIGHT_MODULE).href);
const origin=process.env.LUNA_PREVIEW_URL;
assert.equal(new URL(origin).hostname,'127.0.0.1');
const browser=await chromium.launch({executablePath:process.env.PHASE2_CHROME_BIN,headless:true});
const results=[];
try {for(let sample=0;sample<3;sample++) {
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const page=await context.newPage();
 await page.addInitScript(()=>{localStorage.setItem('luna.theme.preference.v1','dark');window.__perf={lcp:0,cls:0};new PerformanceObserver(l=>{for(const e of l.getEntries())window.__perf.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__perf.cls+=e.value;}).observe({type:'layout-shift',buffered:true});});
 const cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');await cdp.send('Network.setBlockedURLs',{urls:['https://*']});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 for(const cache of ['cold','warm']) {
  await page.goto(origin,{waitUntil:'load',timeout:90000});await page.locator('.home-v2-atmosphere').waitFor();await page.waitForLoadState('networkidle',{timeout:120000});await page.waitForTimeout(1800);
  results.push({sample,cache,...await page.evaluate(()=>({...window.__perf,resources:performance.getEntriesByType('resource').map(r=>({url:new URL(r.name).pathname,transfer:r.transferSize,bytes:r.encodedBodySize,duration:r.duration,initiator:r.initiatorType})),heap:performance.memory?.usedJSHeapSize??null,overflow:document.documentElement.scrollWidth>innerWidth}))});
 }
 await context.close();
}} finally {await browser.close();}
await mkdir(process.env.LUNA_PERF_OUTPUT,{recursive:true});await writeFile(`${process.env.LUNA_PERF_OUTPUT}/metrics.json`,JSON.stringify({method:'Chromium, 390x844 DPR2, 1.6Mbps, 150ms latency, CPU4x, three cold/warm runs; local fixtures; external fonts blocked identically',results},null,2));
console.log(JSON.stringify(results.map(({sample,cache,lcp,cls,resources})=>({sample,cache,lcp,cls,transferBytes:resources.reduce((a,r)=>a+r.transfer,0)}))));
