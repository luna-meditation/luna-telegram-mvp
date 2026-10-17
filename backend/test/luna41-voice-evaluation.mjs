// Owner-approved synthetic audio only; no provider credential is transferred.
import assert from 'node:assert/strict';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
assert.equal(process.versions.node.split('.')[0],'22');assert.equal(process.env.LUNA41_VOICE_APPROVED,'synthetic_audio_usd0.05');
const directory=process.env.LUNA41_STAGING_BUNDLE_DIR;assert.ok(directory);assert.equal(JSON.parse(await readFile(resolve(directory,'.netlify/state.json'),'utf8')).siteId,'a634a7fc-1ecb-47fa-8b43-edd81a7e3694');
const {nonce,expiresAt}=JSON.parse(await readFile(resolve(directory,'luna41-voice-command-private.json'),'utf8'));assert.ok(Date.parse(expiresAt)>Date.now());
const base='https://luna-staging-itfl.netlify.app/.netlify/functions/',headers={authorization:`Bearer ${nonce}`},out='/tmp/luna41-voice-qa';await mkdir(out,{recursive:true});
async function status(){const r=await fetch(base+'luna41-voice-status',{method:'POST',headers,signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);const row=await r.json();await writeFile(out+'/results.json',JSON.stringify(row,null,2));return row;}
try{
 let row=await status();
 while(row.state==='not_started'||row.state==='paused'&&row.result.status==='IN_PROGRESS'){
  const r=await fetch(base+'luna41-voice-background',{method:'POST',headers,signal:AbortSignal.timeout(30000)});assert.ok([202,204].includes(r.status));
  for(let n=0;n<70;n++){await new Promise(r=>setTimeout(r,10000));row=await status();if(row.state==='paused'||row.state==='completed'||row.state==='blocked')break;}
  console.log(JSON.stringify({state:row.state,status:row.result?.status,calls:row.result?.providerCalls,costUpperBoundUsd:(row.result?.spentMicrousd??0)/1e6,heldUsd:(row.result?.heldMicrousd??0)/1e6}));
 }
 assert.equal(row.state,'completed');assert.equal(row.result.status,'AUDIO_COLLECTED_AWAITING_REVIEW');
 for(const clip of row.result.clips){const data=Buffer.from(clip.base64,'base64');assert.equal(createHash('sha256').update(data).digest('hex'),clip.sha256);await writeFile(resolve(out,clip.language+'-'+clip.id+'.wav'),data);}
 const {clips,...result}=row.result;await writeFile(out+'/review.json',JSON.stringify({...result,clips:clips.map(({base64:_base64,...clip})=>clip)},null,2));
 console.log(JSON.stringify({status:'EXPORTED_FOR_REVIEW',directory:out,productionTouched:false}));
}catch{console.error(JSON.stringify({status:'STOPPED_SAFELY',credentialsPrinted:false}));process.exitCode=1;}
