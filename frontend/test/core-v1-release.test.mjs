import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {verifyCoreReleaseEvidence,coreSourceDigest} from '../scripts/core-v1-release-gates.mjs';
const root=resolve('..');
const receiptNow=Date.parse(JSON.parse(readFileSync(resolve(root,'qa/core-release/recovery.json'),'utf8')).capturedAt)+1000;
const verify=(r)=>verifyCoreReleaseEvidence(r,root,{now:receiptNow});
const receipt=()=>({...JSON.parse(readFileSync(resolve(root,'qa/core-v1-release-review.json'),'utf8')),sourceDigest:coreSourceDigest(root)});
test('Core publication rejects critical blockers, spend changes and stale source evidence',()=>{
 const r=receipt();assert.equal(verify(r),true);
 for(const[key,value]of [['status','FAIL'],['sourceDigest','old'],['criticalBlockers',['unresolved']],['newProviderGenerations',1],['realFinancialOperations',1],['additionalProductionMigrations',1],['financialPolicyChanged',true],['customerDataMutatedByTests',true],['productionModel','unreviewed'],['aiCapUsd',101],['aiQuality','fully-verified'],['knownLimitations',[]]])assert.throws(()=>verify({...r,[key]:value}),key);
});
test('Core publication requires unchanged execution records and fresh recoverability',()=>{
 const r=receipt();for(const name of Object.keys(r.evidence))assert.throws(()=>verify({...r,evidence:{...r.evidence,[name]:{...r.evidence[name],sha256:'old'}}}),name);
 assert.throws(()=>verifyCoreReleaseEvidence(r,root,{now:Date.now()+86400000}),/Fresh verified recovery/);
});
test('Core production entry preserves financial capability switches and renamed bot routing',()=>{
 const s=readFileSync('scripts/build-production.mjs','utf8'),config=readFileSync('../netlify.toml','utf8');
 assert.match(s,/if\(profile==='core-v1'\|\|profile==='product-v2'\)/);assert.match(s,/verifyCoreReleaseEvidence/);assert.match(s,/VITE_BOT_USERNAME,'myluna_app'/);assert.match(s,/api.origin,'https:\/\/lunabackend-production-08c8.up.railway.app'/);
 assert.match(config,/LUNA_RELEASE_PROFILE = "product-v2"/);assert.match(config,/LUNA_RELEASE_DB_REVIEW = "\.\.\/qa\/product-v2-release-review.json"/);
});
