import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {resolve} from 'node:path';import {releaseSourceDigest} from './release-source-digest.mjs';
export const luna40MigrationNames=['20261017051755_luna40_language_preferences.sql','20261017052134_luna40_action_observability.sql','20261017052535_luna40_admin_read_foundation.sql','20261017070223_luna40_admin_operations.sql'];
/** Evidence-only gate. It cannot turn old smoke results or synthetic browser data
 * into a new provider/persistence/Telegram verification. */
export function verifyLuna40ReleaseEvidence(review,root){
 assert.equal(review.status,'PASS');assert.equal(review.release,'luna40');assert.equal(review.baseCommit,'13939525e72557378e18268602a709c895bbebd3');
 assert.equal(review.projectId,'vkcdtasbdoeilgfucoax');assert.equal(review.stagingProjectId,'funvzpmpbgazsisehiru');
 assert.equal(review.backupRestorePasses,2);assert.ok(review.backupTables>=63);assert.ok(review.backupFunctions>=60);assert.ok(review.backupMediaObjects>=28);assert.equal(review.backupMediaIntegrity,'PASS');assert.ok(Date.now()-Date.parse(review.backupCapturedAt)<24*3600000,'Recovery proof must be fresh');
 for(const field of ['frontendTestsStatus','backendTestsStatus','typeChecks','lint','mobileStatus','stagingPersistence','realTelegramAuth','aiSmokeStatus','aiQualityStatus'])assert.equal(review[field],'PASS',field);
 assert.ok(review.frontendTests>=226);assert.ok(review.backendTests>=475);assert.ok(review.nativeDatabaseChecks>=29);assert.ok(review.mobileCases>=120);
 assert.ok(review.aiProviderCalls>0&&review.aiProviderCalls<=4);assert.ok(review.aiCostUsd>0&&review.aiCostUsd<=.03);assert.equal(review.unknownAiSpendUsd,0);assert.equal(review.savedResultsProviderCalls,0);
 assert.equal(review.migrationStatus,'verified-production');assert.equal(review.unrelatedObjectsUnchanged,true);assert.equal(review.balancesAndPaidRightsPreserved,true);assert.equal(review.aiBudgetBaselinePreserved,true);assert.equal(review.approvedAiCapUsd,100);
 for(const field of ['monetizationEnabled','newCommercialQuotasEnabled','financialAdminMutationsEnabled','realStarsTransactions'])assert.equal(review[field],field==='realStarsTransactions'?0:false,field);
 assert.deepEqual(review.criticalBlockers,[]);assert.deepEqual(Object.keys(review.migrationHashes).sort(),[...luna40MigrationNames].sort());for(const file of luna40MigrationNames)assert.equal(createHash('sha256').update(readFileSync(resolve(root,'supabase/migrations',file))).digest('hex'),review.migrationHashes[file]);
 assert.equal(review.sourceDigest,releaseSourceDigest(root),'Source changed after Luna 4.0 verification');
}
