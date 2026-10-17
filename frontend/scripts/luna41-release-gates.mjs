import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';import{resolve}from'node:path';import{releaseSourceDigest}from'./release-source-digest.mjs';
export const luna41MigrationNames=['20261017103831_luna41_cosmos_onboarding_state.sql','20261017104405_luna41_preserve_chart_history_on_edit.sql','20261017114215_luna41_navigation_observation.sql'];
/** Current recovery and source-matched verification, not a waiver of unfinished
 * optional features. New financial/model/voice activation is explicitly closed. */
export function verifyLuna41ReleaseEvidence(review,root){
 assert.equal(review.status,'PASS');assert.equal(review.release,'luna41');assert.equal(review.baseCommit,'fbd6a2393e13f1c0bb6351c259d9d93d178e7817');
 assert.equal(review.projectId,'vkcdtasbdoeilgfucoax');assert.equal(review.stagingProjectId,'funvzpmpbgazsisehiru');
 assert.equal(review.backupRestorePasses,2);assert.equal(review.backupTables,75);assert.ok(review.backupFunctions>=69);assert.ok(review.backupMediaObjects>=28);assert.equal(review.backupMediaIntegrity,'PASS');assert.ok(Number.isFinite(Date.parse(review.backupCapturedAt))&&Date.now()-Date.parse(review.backupCapturedAt)>=0&&Date.now()-Date.parse(review.backupCapturedAt)<24*3600000,'Current recovery proof is required');
 for(const field of ['frontendTestsStatus','backendTestsStatus','typeChecks','lint','mobileStatus','adminScrollStatus','stagingPersistence','realTelegramAuth','aiSmokeStatus','aiSavedReplayStatus','editorialDraftStatus'])assert.equal(review[field],'PASS',field);
 assert.ok(review.frontendTests>=233);assert.ok(review.backendTests>=513);assert.ok(review.nativeDatabaseChecks>=11);assert.ok(review.mobileCases>=10);assert.ok(review.adminScrollCases>=108);assert.ok(review.stagingPersistenceChecks>=14);
 assert.equal(review.modelBenchmark.attempts,400);assert.equal(review.modelBenchmark.responses,398);assert.equal(review.modelBenchmark.policyDeclines,2);assert.ok(review.modelBenchmark.knownUsageUsd>0);assert.ok(review.modelBenchmark.unsettledHoldUsd>0);assert.ok(review.modelBenchmark.knownUsageUsd+review.modelBenchmark.unsettledHoldUsd<=2);assert.equal(review.modelBenchmark.retriedPolicyDeclines,0);
 assert.equal(review.aiProviderCalls,4);assert.ok(review.aiCostUsd>0&&review.aiCostUsd<=.02);assert.equal(review.aiUnknownCostUsd,0);assert.equal(review.savedResultsProviderCalls,0);assert.equal(review.productionModel,'gpt-5-mini');assert.equal(review.approvedAiCapUsd,100);
 for(const field of ['monetizationEnabled','newCommercialQuotasEnabled','financialAdminMutationsEnabled','voiceInputEnabled','guidedBreathEnabled','modelSwitchEnabled'])assert.equal(review[field],false,field);
 assert.equal(review.realStarsTransactions,0);assert.equal(review.balancesAndPaidRightsPreserved,true);assert.equal(review.aiBudgetBaselinePreserved,true);assert.equal(review.unrelatedObjectsUnchanged,true);assert.equal(review.migrationStatus,'verified-production');assert.deepEqual(review.criticalBlockers,[]);
 assert.ok(Array.isArray(review.knownLimitations)&&review.knownLimitations.length>0,'Do not conceal disabled or partial features');
 assert.deepEqual(Object.keys(review.migrationHashes).sort(),[...luna41MigrationNames].sort());for(const name of luna41MigrationNames)assert.equal(createHash('sha256').update(readFileSync(resolve(root,'supabase/migrations',name))).digest('hex'),review.migrationHashes[name]);
 assert.equal(review.sourceDigest,releaseSourceDigest(root),'Source changed after Luna 4.1 verification');
}
