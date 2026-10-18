// Control the expiring worker on the existing isolated QA site. No provider
// credential is copied to this computer or exposed in the command output.
import assert from 'node:assert/strict';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {resolve} from 'node:path';
assert.equal(process.versions.node.split('.')[0],'22');
const directory=process.env.LUNA41_STAGING_BUNDLE_DIR;assert.ok(directory);
assert.equal(JSON.parse(await readFile(resolve(directory,'.netlify/state.json'),'utf8')).siteId,'a634a7fc-1ecb-47fa-8b43-edd81a7e3694');
const {nonce,expiresAt}=JSON.parse(await readFile(resolve(directory,'luna41-qa-command-private.json'),'utf8'));assert.ok(Date.parse(expiresAt)>Date.now());
const base='https://luna-staging-itfl.netlify.app/.netlify/functions/',headers={authorization:`Bearer ${nonce}`,'Content-Type':'application/json'},out=process.env.LUNA41_BENCHMARK_OUT??'/tmp/luna41-benchmark';await mkdir(out,{recursive:true});
async function status(){const r=await fetch(base+'luna41-qa-status',{method:'POST',headers,signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,'private_status_unavailable');const row=await r.json();await writeFile(resolve(out,'results.json'),JSON.stringify(row,null,2));return row;}
async function invoke(action){const batchId=randomUUID(),r=await fetch(base+'luna41-qa-background',{method:'POST',headers,body:JSON.stringify({action,batchId}),signal:AbortSignal.timeout(30000)});assert.ok([202,204].includes(r.status),'qa_command_not_accepted');for(let n=0;n<75;n++){await new Promise(r=>setTimeout(r,10000));const row=await status();if(action==='foundation'?['completed','failed'].includes(row.foundation?.state):row.result?.completedBatches?.includes(batchId)||['blocked','completed'].includes(row.state))return row;}throw Error('background_outcome_unknown_do_not_retry');}
try{
 if(process.argv.includes('--foundation')){const row=await invoke('foundation');console.log(JSON.stringify(row.foundation));if(row.foundation?.state!=='completed')process.exitCode=1;process.exit();}
 let row=await status();if(row.state==='not_started'||!row.result?.availability)row=await invoke('inventory');
 console.log(JSON.stringify({availability:row.result?.availability,providerCalls:row.result?.providerCalls??0}));if(process.argv.includes('--check-models'))process.exit(0);
 assert.ok(process.env.LUNA41_BENCHMARK_APPROVED==='400_calls_2_usd'||process.env.LUNA42_BENCHMARK_APPROVED==='300_calls_2_usd');
 while(row.state==='paused'&&row.result?.status==='IN_PROGRESS'){
  row=await invoke('batch');console.log(JSON.stringify({state:row.state,status:row.result?.status,providerCalls:row.result?.providerCalls,spentUsd:(row.result?.spentMicrousd??0)/1e6,heldUsd:(row.result?.heldMicrousd??0)/1e6}));
 }
 if(row.state==='blocked'||row.state?.startsWith('running:'))process.exitCode=1;
}catch{console.error(JSON.stringify({status:'STOPPED_SAFELY',credentialsPrinted:false}));process.exitCode=1;}
