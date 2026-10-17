import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {resolve} from 'node:path';
import {releaseSourceDigest} from './release-source-digest.mjs';
/** Two separately authorized finite staging runs, not an open-ended budget. */
export function verifyLuna34AiEvidence(review){
 assert.equal(review.aiSmokeStatus,'PASS');assert.equal(review.aiQualityStatus,'PASS');assert.ok(review.aiSmokeCalls>0&&review.aiSmokeCalls<=4);assert.ok(review.aiSmokeCostUsd>0&&review.aiSmokeCostUsd<=.03);
 assert.equal(review.aiToolSmokeStatus,'PASS');assert.equal(review.aiAdditionalApproval,'owner-2026-10-17-two-calls-usd0.01');assert.ok(review.aiAdditionalCalls>0&&review.aiAdditionalCalls<=2);assert.ok(review.aiAdditionalCostUsd>0&&review.aiAdditionalCostUsd<=.01);
 assert.equal(review.aiTotalProviderCalls,review.aiSmokeCalls+review.aiAdditionalCalls);assert.ok(Math.abs(review.aiTotalCostUsd-review.aiSmokeCostUsd-review.aiAdditionalCostUsd)<1e-10);assert.equal(review.unknownAiSpendUsd,0);
}
/** This consumes actual release evidence. It must never manufacture a PASS,
 * reuse an older release's smoke test, or treat local fixtures as Telegram proof. */
export function verifyLuna34ReleaseEvidence(review,root){
 assert.equal(review.status,'PASS');assert.equal(review.release,'luna34');assert.equal(review.baseCommit,'80e2c6e73567dd97ca20f42ae286ce4522c5d68a');
 assert.equal(review.projectId,'vkcdtasbdoeilgfucoax');assert.equal(review.stagingProjectId,'funvzpmpbgazsisehiru');
 assert.equal(review.backupRestorePasses,2);assert.ok(review.backupTables>=53);assert.ok(review.backupFunctions>=37);assert.ok(review.backupMediaObjects>=28);assert.equal(review.backupMediaIntegrity,'PASS');
 assert.equal(review.frontendTestsStatus,'PASS');assert.ok(review.frontendTests>=199);assert.equal(review.backendTestsStatus,'PASS');assert.ok(review.backendTests>=390);assert.ok(review.nativeDatabaseChecks>=42);
 assert.equal(review.typeChecks,'PASS');assert.equal(review.lint,'PASS');assert.equal(review.mobileStatus,'PASS');assert.ok(review.mobileCases>=32);assert.equal(review.realTelegramAuth,'PASS');
 verifyLuna34AiEvidence(review);
 assert.equal(review.achievementCount,50);assert.equal(review.uniqueAchievementAssets,50);assert.equal(review.uniqueStatusAssets,10);assert.equal(review.legacyProgressPreserved,true);
 assert.equal(review.migrationStatus,'verified-production');assert.equal(review.unrelatedObjectsUnchanged,true);assert.equal(review.balancesAndPaidRightsPreserved,true);
 assert.equal(review.monetizationEnabled,false);assert.equal(review.achievementRewardsEnabled,false);assert.equal(review.newCommercialQuotasEnabled,false);assert.equal(review.aiBudgetBaselinePreserved,true);assert.equal(review.approvedAiCapUsd,100);
 const names=['20261016174059_luna34_verified_progress_and_catalog.sql','20261016175930_luna34_commercial_catalog_and_allowances.sql','20261016182919_luna34_monthly_allocations_and_referral_evidence.sql','20261016190335_luna34_allowance_operation_finality.sql'];
 assert.deepEqual(Object.keys(review.migrationHashes).sort(),names.sort());for(const name of names)assert.equal(createHash('sha256').update(readFileSync(resolve(root,'supabase/migrations',name))).digest('hex'),review.migrationHashes[name],'Migration changed after review: '+name);
 assert.equal(review.sourceDigest,releaseSourceDigest(root),'Source changed after release verification');
}
