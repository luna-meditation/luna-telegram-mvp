import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {releaseSourceDigest} from './release-source-digest.mjs';
export function verifyLunaIntelligenceReleaseEvidence(r,root){
 if(r.release==='meet-luna-4-0'){
  assert.equal(r.status,'PASS');assert.equal(r.baseCommit,'b0406e22c11e712155e8e62dd68d86ea713656bb');assert.equal(r.projectId,'vkcdtasbdoeilgfucoax');assert.equal(r.stagingProjectId,'funvzpmpbgazsisehiru');
  assert.equal(r.productionDatabaseWritesBeforeRelease,0);assert.equal(r.productionConfigurationWritesBeforeRelease,0);assert.equal(r.noDatabaseMigrations,true);assert.deepEqual(r.migrationHashes,{});
  for(const key of ['frontendTestsStatus','backendTestsStatus','typeChecks','lint','builds','mobileStatus','stagingPersistence','ownerIsolation','aiSmokeStatus','benchmarkReview','rollbackCompatibility','unchangedRlsGrants','financialCompatibility','voiceProviderStatus','voiceBrowserStatus','journalCrud','dateNumerology','birthDiscovery','confirmedPortrait','paidReportDelivery','companionLifecycle'])assert.equal(r[key],'PASS',key);
  assert.ok(r.frontendTests>=273&&r.backendTests>=698);assert.ok(r.nativeDatabaseChecks>=9);assert.ok(r.mobileCases>=160);assert.ok(r.paidReportMobileCases>=4);assert.ok(r.voiceBrowserCases>=4);
  assert.equal(r.benchmarkCases,60);assert.equal(r.benchmarkDecisions,70);assert.equal(r.comparisonDecisions,6);assert.equal(r.beforeDecisions,4);assert.equal(r.pairedInputHashesMatch,true);assert.equal(r.criticalAiActionFailures,0);
  assert.ok(r.aiProviderCalls>=70&&r.aiProviderCalls<=100);assert.ok(r.voiceProviderCalls>=3&&r.voiceProviderCalls<=6);assert.ok(r.aiCostUsd>0&&r.aiCostUsd<=.75);assert.equal(r.unknownAiSpendUsd,0);assert.equal(r.savedResultsProviderCalls,0);
  assert.match(r.testedBackendCommit,/^[a-f0-9]{40}$/);assert.equal(r.backendChangesAfterStagingValidation,0);assert.equal(r.finalStagingValidationStatus,'PASS');assert.equal(r.finalStagingValidationCommit,r.testedBackendCommit);assert.match(r.stagingDeploymentId,/^[a-f0-9]{24}$/);
  assert.equal(r.backupRestorePasses,2);assert.equal(r.backupIntegrity,'PASS');assert.equal(r.backupMediaIntegrity,'PASS');assert.equal(r.backupTables,80);assert.equal(r.backupMediaObjects,28);assert.ok(Date.now()-Date.parse(r.backupCapturedAt)>=0&&Date.now()-Date.parse(r.backupCapturedAt)<86400000);
  assert.equal(r.productionModel,'gpt-5-mini');assert.equal(r.productionModelChanged,false);assert.equal(r.productionPromptVersion,'meet-luna4');assert.equal(r.aiCapUsd,100);assert.equal(r.aiCapChanged,false);assert.equal(r.realStarsTransactions,0);assert.equal(r.existingPricesChanged,false);assert.equal(r.balancesAndEntitlementsPreserved,true);assert.equal(r.unrelatedObjectsUnchanged,true);assert.deepEqual(r.criticalBlockers,[]);assert.ok(r.knownLimitations.length>0);assert.equal(r.sourceDigest,releaseSourceDigest(root),'Source changed after final verification');return;
 }
 if(r.release==='luna-design-intelligence-3-0'){
  assert.equal(r.status,'PASS');assert.equal(r.baseCommit,'93c9b6a5819296ffb65052248f8b25522995cdad');assert.equal(r.projectId,'vkcdtasbdoeilgfucoax');assert.equal(r.stagingProjectId,'funvzpmpbgazsisehiru');assert.equal(r.productionDatabaseWritesBeforeRelease,0);assert.equal(r.productionConfigurationWritesBeforeRelease,0);assert.deepEqual(r.productionExternalChangesBeforeRelease,['bot_display_name']);assert.equal(r.noDatabaseMigrations,true);assert.deepEqual(r.migrationHashes,{});
  for(const key of ['frontendTestsStatus','backendTestsStatus','typeChecks','lint','builds','mobileStatus','stagingPersistence','telegramAuthorization','ownerIsolation','aiSmokeStatus','benchmarkReview','rollbackCompatibility','unchangedRlsGrants','financialCompatibility','voiceProviderStatus','voiceBrowserStatus','conversationalOnboarding','journalCrud','multiCardSharing','calculatedTransits','dateNumerology'])assert.equal(r[key],'PASS',key);
  assert.ok(r.frontendTests>=263&&r.backendTests>=673);assert.ok(r.nativeDatabaseChecks>=59);assert.ok(r.mobileCases>=24);assert.ok(r.voiceBrowserCases>=4);assert.equal(r.benchmarkCases,18);assert.equal(r.benchmarkModels,3);assert.equal(r.benchmarkDecisions,54);assert.equal(r.beforeDecisions,6);assert.equal(r.pairedInputHashesMatch,true);assert.equal(r.criticalAiActionFailures,0);
  assert.ok(r.aiProviderCalls>=60&&r.aiProviderCalls<=90);assert.ok(r.voiceProviderCalls>=5&&r.voiceProviderCalls<=8);assert.ok(r.aiCostUsd>0&&r.aiCostUsd<=.75);assert.equal(r.unknownAiSpendUsd,0);assert.equal(r.savedResultsProviderCalls,0);
  assert.equal(r.finalStagingValidationStatus,'PASS');assert.match(r.sourceCommit??'',/^[a-f0-9]{40}$/);assert.equal(r.finalStagingValidationCommit,r.sourceCommit,'The final staged source must verify corrected capabilities and cached results');
  assert.equal(r.backupRestorePasses,2);assert.equal(r.backupIntegrity,'PASS');assert.equal(r.backupMediaIntegrity,'PASS');assert.ok(r.backupTables>=80&&r.backupMediaObjects>=28);assert.ok(Date.now()-Date.parse(r.backupCapturedAt)>=0&&Date.now()-Date.parse(r.backupCapturedAt)<86400000);
  assert.equal(r.productionModel,'gpt-5-mini');assert.equal(r.productionModelChanged,false);assert.equal(r.productionPromptVersion,'intelligence-v3');assert.equal(r.aiCapUsd,100);assert.equal(r.aiCapChanged,false);assert.equal(r.realStarsTransactions,0);assert.equal(r.existingPricesChanged,false);assert.equal(r.balancesAndEntitlementsPreserved,true);assert.equal(r.unrelatedObjectsUnchanged,true);assert.deepEqual(r.criticalBlockers,[]);assert.ok(r.knownLimitations.length>0);assert.match(r.stagingDeploymentId,/^[a-f0-9]{24}$/);assert.equal(r.sourceDigest,releaseSourceDigest(root),'Source changed after final verification');return;
 }
 const v2=r.release==='luna-intelligence-2-0';assert.ok(v2||r.release==='luna-intelligence-1-0');assert.equal(r.status,'PASS');
 assert.equal(r.baseCommit,v2?'58ab85e4729e93197cefa534160cda4172be8e0c':'4774edf550ab81d10bc54682883cefad6b527859');
 assert.equal(r.projectId,'vkcdtasbdoeilgfucoax');assert.equal(r.stagingProjectId,'funvzpmpbgazsisehiru');
 assert.equal(r.productionWritesBeforeRelease,0);
 if(v2){const name='20261018100000_luna_intelligence_bounded_tool_continuation.sql';assert.equal(r.noDatabaseMigrations,false);assert.deepEqual(Object.keys(r.migrationHashes),[name]);assert.equal(r.migrationHashes[name],createHash('sha256').update(readFileSync(resolve(root,'supabase/migrations',name))).digest('hex'));assert.equal(r.migrationStatus,'verified-production');assert.equal(r.nativeDatabaseChecks,59);assert.equal(r.migrationRollback,'PASS');}
 else{assert.equal(r.noDatabaseMigrations,true);assert.deepEqual(r.migrationHashes,{});}
 assert.equal(r.backupRestorePasses,2);assert.equal(r.backupIntegrity,'PASS');assert.equal(r.backupMediaIntegrity,'PASS');
 assert.ok(r.backupTables>=79&&r.backupMediaObjects>=28);assert.ok(Date.now()-Date.parse(r.backupCapturedAt)>=0&&Date.now()-Date.parse(r.backupCapturedAt)<86400000);
 for(const key of ['frontendTestsStatus','backendTestsStatus','typeChecks','lint','builds','mobileStatus','stagingPersistence','telegramAuthorization','ownerIsolation','aiSmokeStatus','benchmarkReview','rollbackCompatibility','unchangedRlsGrants','financialCompatibility'])assert.equal(r[key],'PASS',key);
 assert.ok(r.frontendTests>=255);assert.ok(r.backendTests>=653);assert.ok(r.multiTurnActionCases>=40);assert.ok(r.mobileCases>=16);
 assert.equal(r.benchmarkCases,v2?12:50);assert.equal(r.benchmarkModels,3);assert.equal(r.benchmarkDecisions,v2?36:150);assert.equal(r.pairedInputHashesMatch,true);assert.equal(r.criticalAiActionFailures,0);
 assert.ok(r.aiProviderCalls>=(v2?36:150)&&r.aiProviderCalls<=(v2?60:180));assert.ok(r.aiCostUsd>0&&r.aiCostUsd<=(v2?.5:1));assert.equal(r.unknownAiSpendUsd,0);assert.equal(r.savedResultsProviderCalls,0);
 if(v2)for(const key of ['calculatedTransits','dateNumerology','consentedContext','topicSpecificReport','multiCardSharing'])assert.equal(r[key],'PASS',key);
 assert.equal(r.productionModel,'gpt-5-mini');assert.equal(r.productionModelChanged,false);assert.equal(r.aiCapUsd,100);assert.equal(r.aiCapChanged,false);
 assert.equal(r.realStarsTransactions,0);assert.equal(r.existingPricesChanged,false);assert.equal(r.balancesAndEntitlementsPreserved,true);assert.equal(r.unrelatedObjectsUnchanged,true);
 assert.deepEqual(r.criticalBlockers,[]);assert.ok(r.knownLimitations.length>0);assert.match(r.stagingDeploymentId,/^[a-f0-9]{24}$/);
 assert.equal(r.sourceDigest,releaseSourceDigest(root),'Source changed after final verification');
}
