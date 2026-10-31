import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const sha=b=>createHash('sha256').update(b).digest('hex');
/** Railway may build a source archive without .git. The reviewed manifest is
 * generated from tracked release paths before commit, never from build output. */
export function productV2SourceDigest(root){
 const bytes=readFileSync(resolve(root,'qa/product-v2-source-manifest.json'));
 const paths=JSON.parse(bytes);assert.ok(Array.isArray(paths)&&paths.length>900);
 assert.equal(new Set(paths).size,paths.length);
 assert.ok(paths.every(p=>typeof p==='string'&&!p.startsWith('/')&&!p.split('/').includes('..')&&!/(^|\/)\.env(?:\.|$)/.test(p)));
 return sha(JSON.stringify({manifest:sha(bytes),files:paths.map(p=>[p,sha(readFileSync(resolve(root,p)))])}));
}
export function verifyProductV2Evidence(r,root,{now=Date.now()}={}){
 assert.equal(r.release,'product-experience-v2');assert.equal(r.status,'PASS');
 const companion=r.revision==='companion-refinement-20261031';
 assert.ok(r.revision===undefined||companion,'Unknown release evidence revision');
 assert.equal(r.baseCommit,companion?'8f5570e9d006be9ef9287b8c889b0cf648567c85':'6faafbd7093611b1a357d1a980f7194a5d44739e');
 assert.equal(r.projectId,'vkcdtasbdoeilgfucoax');assert.deepEqual(r.criticalBlockers,[]);
 assert.equal(r.staging,'omitted-by-explicit-owner-instruction-2026-10-31');
 assert.equal(r.productionModel,'gpt-5-mini');assert.equal(r.aiCapUsd,100);
 for(const key of ['financialPolicyChanged','modelChanged','aiCapChanged','customerDataMutatedByTests'])assert.equal(r[key],false,key);
 for(const key of ['realFinancialOperations','productionMigrations'])assert.equal(r[key],0,key);
 assert.equal(r.commands.nodeMajor,22);assert.equal(r.commands.externalNetworkBlocked,true);
 assert.ok(r.commands.results.length>=8&&r.commands.results.every(c=>c.exitCode===0));
 assert.ok(r.commands.backendTests>=983);assert.ok(r.commands.frontendTests>=299);
 const audit=r.dependencies;assert.ok(Object.values(audit.productionVulnerabilities).every(v=>v===0));
 assert.deepEqual(audit.developmentOnlyAdvisories,[{id:'GHSA-g3hv-75wg-m249',module:'minimatch',severity:'moderate',versions:['3.1.5','10.2.5']}]);
 assert.equal(audit.otherAdvisories,0);assert.equal(audit.fixDeferredReason,'major-only-fix-in-development-glob-tooling');
 assert.equal(r.database.native.status,'PASS');assert.ok(r.database.native.checks>=31);
 assert.equal(r.database.functionDefinitionsCompared,127);assert.equal(r.database.changedFunctions,0);
 assert.deepEqual(r.database.sixteenTables,{rlsEnabled:16,missingServiceCrud:0,browserPrivilegeMismatches:0,unexpectedExplicitBrowserColumnGrants:0});
 assert.equal(r.database.privateTablesBrowserPrivileges,0);assert.equal(r.database.financialSettingsUnchanged,true);
 const recovery=r.recovery;assert.equal(recovery.status,'PASS');assert.equal(recovery.backupOutsideSyncedDocuments,true);
 assert.equal(recovery.temporaryPlaintextRemoved,true);assert.deepEqual(recovery.coverage,{tables:91,functions:127});
 assert.equal(recovery.passes.length,2);assert.ok(recovery.passes.every(p=>p.status==='PASS'&&p.allRowsCompared&&p.allTableAndFunctionAclsCompared&&p.functionDefinitionsCompared&&p.rlsCompared));
 assert.equal(recovery.media.status,'PASS');assert.equal(recovery.media.objects,28);assert.equal(recovery.media.sourceVersionsVerified,true);assert.equal(recovery.media.allArchivesDecryptedAndContentHashesVerified,true);
 const age=now-Date.parse(recovery.capturedAt);assert.ok(age>=0&&age<86400000,'Fresh verified recovery required');
 const mobile=r.mobile;assert.equal(mobile.status,'PASS');assert.equal(mobile.variants.length,16);
 for(const engine of ['chromium','webkit'])for(const width of [360,375,390,393])for(const language of ['ru','en']){const v=mobile.variants.filter(c=>c.engine===engine&&c.width===width&&c.language===language);assert.equal(v.length,1);assert.equal(v[0].status,'PASS');assert.ok(v[0].checks>=26);}
 assert.equal(r.performance.status,'PASS');assert.equal(r.performance.visibleFrameChangeVerified,true);assert.equal(r.performance.reducedMotionVerified,true);assert.equal(r.performance.lowPowerVerified,true);
 assert.equal(r.ai.scenarios,10);assert.equal(r.ai.failed,0);
 if(companion){
  // The initial paired campaign preceded the final prompt correction. Do not
  // present its 60 requests as a final-source replay or a new paired rerun.
  assert.equal(r.ai.method,'paired-baseline-with-targeted-final-followup');
  assert.equal(r.ai.completed,72);assert.equal(r.ai.initialPaired.completed,60);
  assert.equal(r.ai.initialPaired.baselineResponses,30);assert.equal(r.ai.initialPaired.candidateResponses,30);
  assert.equal(r.ai.initialPaired.scenarios,10);assert.equal(r.ai.initialPaired.turnsPerConversation,3);
  assert.equal(r.ai.followup.completed,12);assert.equal(r.ai.followup.finalRequestReplayMatches,12);
  assert.equal(r.ai.followup.actualFreeHandlerMatches,3);assert.equal(r.ai.followup.runtimeChecks,12);
  assert.deepEqual(r.ai.followup.fullConversationTurns,[3,3]);
  assert.equal(r.ai.followup.partialConversationTurns,2);assert.equal(r.ai.followup.recordedPrefixContinuations,4);
  assert.equal(r.ai.finalFullPairedRerun,false);assert.equal(r.ai.criticalSafetyFailures,0);
  assert.ok(r.ai.costUsd>0&&r.ai.costUsd<=0.5);
  for(const evidence of [r.ai.initialPaired,r.ai.followup])assert.match(evidence.resultsSha256,/^[a-f0-9]{64}$/);
  const maintenance=r.database.maintenance;
  assert.equal(maintenance.status,'PASS');assert.equal(maintenance.postgresVersionNum,170011);
  assert.equal(maintenance.ownerAuthorized,true);assert.equal(maintenance.backendRecovered,true);
  assert.equal(maintenance.preUpgradeRecoveryVerified,true);assert.equal(maintenance.postUpgradeCriticalAdvisories,0);
  assert.equal(r.decision,'CONDITIONAL GO');
 }else{
  assert.equal(r.ai.completed,60);assert.equal(r.ai.requestReplayMatches,60);assert.ok(r.ai.costUsd>0&&r.ai.costUsd<=1);
 }
 assert.equal(r.ai.scope,'request-construction-and-raw-provider-prose');assert.equal(r.ai.independentHumanReview,false);assert.ok(r.knownLimitations.length>=5);
 assert.equal(r.physicalTelegramAcceptance,'pending-owner-review');
 assert.equal(r.sourceDigest,productV2SourceDigest(root),'Source changed after Product v2 verification');
 // The same protected domain implementation accepted for Core v1 remains exact.
 const preserved=JSON.parse(readFileSync(resolve(root,'qa/intelligence-core-v1/preservation.json'),'utf8'));
 assert.equal(Object.keys(preserved.hashes).length,687);assert.equal(preserved.financialBackendFiles,33);
 for(const[path,expected]of Object.entries(preserved.hashes))assert.equal(sha(readFileSync(resolve(root,path))),expected,`Protected source changed: ${path}`);
 return true;
}
