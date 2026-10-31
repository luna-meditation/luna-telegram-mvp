import assert from 'node:assert/strict';
/** Public health only: frontend publication waits for the matching backend. */
export async function waitForProductBackend(commit,{fetcher=fetch,delay=ms=>new Promise(done=>setTimeout(done,ms)),attempts=50}={}){
 assert.match(commit??'',/^[a-f0-9]{40}$/);
 for(let i=0;i<attempts;i++){
  try{const r=await fetcher('https://lunabackend-production-08c8.up.railway.app/health',{signal:AbortSignal.timeout(10000)});const body=await r.json();if(r.ok===true&&body.ok===true&&body.service==='luna-backend'&&body.runtime?.commit===commit&&body.runtime?.projectRef==='vkcdtasbdoeilgfucoax'&&body.luna21?.telegramReady===true)return true;}catch{}
  if(i+1<attempts)await delay(10000);
 }
 throw Error('Matching production backend was not verified; frontend publication is blocked');
}
