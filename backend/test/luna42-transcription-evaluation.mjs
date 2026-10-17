import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
assert.equal(process.versions.node.split('.')[0],'22');assert.equal(process.env.LUNA42_TRANSCRIPTION_APPROVED,'synthetic_audio_usd0.03');
const directory=process.env.LUNA41_STAGING_BUNDLE_DIR;assert.ok(directory);
assert.equal(JSON.parse(await readFile(resolve(directory,'.netlify/state.json'),'utf8')).siteId,'a634a7fc-1ecb-47fa-8b43-edd81a7e3694');
const {nonce,expiresAt}=JSON.parse(await readFile(resolve(directory,'luna42-transcription-command-private.json'),'utf8'));assert.ok(Date.parse(expiresAt)>Date.now());
const base='https://luna-staging-itfl.netlify.app/.netlify/functions/',headers={authorization:`Bearer ${nonce}`},out='/tmp/luna42-transcription';await mkdir(out,{recursive:true});
async function status(){const r=await fetch(base+'luna42-transcription-status',{method:'POST',headers,signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);const row=await r.json();await writeFile(out+'/results.json',JSON.stringify(row,null,2));return row;}
try{let row=await status();if(row.state==='not_started'||row.state==='paused'){const r=await fetch(base+'luna42-transcription-background',{method:'POST',headers,signal:AbortSignal.timeout(30000)});assert.ok([202,204].includes(r.status));}
 for(let n=0;n<24;n++){await new Promise(r=>setTimeout(r,10000));row=await status();if(['completed','blocked'].includes(row.state))break;}
 console.log(JSON.stringify({state:row.state,status:row.result?.status,providerCalls:row.result?.providerCalls,costUsd:(row.result?.spentMicrousd??0)/1e6,heldUsd:(row.result?.heldMicrousd??0)/1e6,results:row.result?.results}));if(row.state!=='completed')process.exitCode=1;
}catch{console.error('Transcription check stopped safely; no provider retry.');process.exitCode=1;}
