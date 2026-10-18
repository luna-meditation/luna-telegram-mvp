import assert from 'node:assert/strict';
import {releaseSourceDigest} from './release-source-digest.mjs';
export function verifyLunaIntelligenceReleaseEvidence(r,root){
 assert.equal(r.release,'luna-intelligence-1-0');assert.equal(r.status,'PASS');
 assert.equal(r.baseCommit,'4774edf550ab81d10bc54682883cefad6b527859');
 assert.equal(r.projectId,'vkcdtasbdoeilgfucoax');assert.equal(r.stagingProjectId,'funvzpmpbgazsisehiru');
 assert.equal(r.noDatabaseMigrations,true);assert.deepEqual(r.migrationHashes,{});assert.equal(r.productionWritesBeforeRelease,0);
 assert.equal(r.backupRestorePasses,2);assert.equal(r.backupIntegrity,'PASS');assert.equal(r.backupMediaIntegrity,'PASS');
 assert.ok(r.backupTables>=79&&r.backupMediaObjects>=28);assert.ok(Date.now()-Date.parse(r.backupCapturedAt)>=0&&Date.now()-Date.parse(r.backupCapturedAt)<86400000);
 for(const key of ['frontendTestsStatus','backendTestsStatus','typeChecks','lint','builds','mobileStatus','stagingPersistence','telegramAuthorization','ownerIsolation','aiSmokeStatus','benchmarkReview','rollbackCompatibility','unchangedRlsGrants','financialCompatibility'])assert.equal(r[key],'PASS',key);
 assert.ok(r.frontendTests>=255);assert.ok(r.backendTests>=653);assert.ok(r.multiTurnActionCases>=40);assert.ok(r.mobileCases>=16);
 assert.equal(r.benchmarkCases,50);assert.equal(r.benchmarkModels,3);assert.equal(r.benchmarkDecisions,150);assert.equal(r.pairedInputHashesMatch,true);assert.equal(r.criticalAiActionFailures,0);
 assert.ok(r.aiProviderCalls>=150&&r.aiProviderCalls<=180);assert.ok(r.aiCostUsd>0&&r.aiCostUsd<=1);assert.equal(r.unknownAiSpendUsd,0);assert.equal(r.savedResultsProviderCalls,0);
 assert.equal(r.productionModel,'gpt-5-mini');assert.equal(r.productionModelChanged,false);assert.equal(r.aiCapUsd,100);assert.equal(r.aiCapChanged,false);
 assert.equal(r.realStarsTransactions,0);assert.equal(r.existingPricesChanged,false);assert.equal(r.balancesAndEntitlementsPreserved,true);assert.equal(r.unrelatedObjectsUnchanged,true);
 assert.deepEqual(r.criticalBlockers,[]);assert.ok(r.knownLimitations.length>0);assert.match(r.stagingDeploymentId,/^[a-f0-9]{24}$/);
 assert.equal(r.sourceDigest,releaseSourceDigest(root),'Source changed after final verification');
}
