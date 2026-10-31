import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {productV2SourceDigest,verifyProductV2Evidence} from '../scripts/product-v2-release-gates.mjs';

const root=resolve('..'),now=Date.parse('2026-10-31T04:10:00Z');
// Unit fixtures exercise the fail-closed gate. They are not release receipts.
const fixture=()=>{
 const r=JSON.parse(readFileSync(resolve(root,'qa/product-v2-release-review.json'),'utf8'));
 delete r.revision;r.baseCommit='6faafbd7093611b1a357d1a980f7194a5d44739e';
 r.recovery.capturedAt='2026-10-31T03:40:49Z';
 r.ai={scenarios:10,completed:60,failed:0,requestReplayMatches:60,costUsd:0.051075,scope:'request-construction-and-raw-provider-prose',independentHumanReview:false};
 r.sourceDigest=productV2SourceDigest(root);
 return r;
};
const incremental=()=>{
 const r=fixture();r.revision='companion-refinement-20261031';
 r.baseCommit='8f5570e9d006be9ef9287b8c889b0cf648567c85';r.decision='CONDITIONAL GO';
 r.database.maintenance={status:'PASS',postgresVersionNum:170011,ownerAuthorized:true,backendRecovered:true,preUpgradeRecoveryVerified:true,postUpgradeCriticalAdvisories:0};
 r.mobile.tarotContinuation={status:'PASS',variants:4,checks:20,baselineDuplicateReproduced:true,reportSha256:'c'.repeat(64)};
 r.ai={scenarios:10,failed:0,completed:72,costUsd:0.058875,scope:'request-construction-and-raw-provider-prose',independentHumanReview:false,method:'paired-baseline-with-targeted-final-followup',initialPaired:{completed:60,baselineResponses:30,candidateResponses:30,scenarios:10,turnsPerConversation:3,resultsSha256:'a'.repeat(64)},followup:{completed:12,finalRequestReplayMatches:12,actualFreeHandlerMatches:3,runtimeChecks:12,fullConversationTurns:[3,3],partialConversationTurns:2,recordedPrefixContinuations:4,resultsSha256:'b'.repeat(64)},finalFullPairedRerun:false,criticalSafetyFailures:0};
 return r;
};

test('original paired evaluation remains independently supported by the gate',()=>{
 assert.equal(verifyProductV2Evidence(fixture(),root,{now}),true);
});
test('incremental evidence explicitly distinguishes the final targeted evaluation',()=>{
 assert.equal(verifyProductV2Evidence(incremental(),root,{now}),true);
 for(const mutate of [r=>{r.ai.followup.finalRequestReplayMatches=11;},r=>{r.ai.finalFullPairedRerun=true;},r=>{r.ai.initialPaired.baselineResponses=29;},r=>{r.ai.followup.actualFreeHandlerMatches=2;},r=>{r.ai.criticalSafetyFailures=1;}]){
  const r=incremental();mutate(r);assert.throws(()=>verifyProductV2Evidence(r,root,{now}));
 }
});
test('database patch evidence cannot replace the unchanged privacy and financial gates',()=>{
 for(const mutate of [r=>{r.database.maintenance.postgresVersionNum=170006;},r=>{r.database.maintenance.backendRecovered=false;},r=>{r.database.maintenance.preUpgradeRecoveryVerified=false;},r=>{r.database.maintenance.postUpgradeCriticalAdvisories=1;},r=>{r.database.privateTablesBrowserPrivileges=1;},r=>{r.database.sixteenTables.missingServiceCrud=1;},r=>{r.financialPolicyChanged=true;},r=>{r.criticalBlockers=['Unresolved authorization issue'];}]){
  const r=incremental();mutate(r);assert.throws(()=>verifyProductV2Evidence(r,root,{now}));
 }
});
test('unknown revisions, stale recovery and changed source fail closed',()=>{
 for(const mutate of [r=>{r.revision='unknown';},r=>{r.sourceDigest='0'.repeat(64);},r=>{r.recovery.capturedAt='2026-10-29T00:00:00Z';},r=>{r.recovery.passes.pop();},r=>{r.recovery.media.sourceVersionsVerified=false;},r=>{r.mobile.tarotContinuation.checks=19;}]){
  const r=incremental();mutate(r);assert.throws(()=>verifyProductV2Evidence(r,root,{now}));
 }
});
