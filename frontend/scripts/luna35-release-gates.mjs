import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {resolve} from 'node:path';
import {releaseSourceDigest} from './release-source-digest.mjs';
/** Safe code publication, never permission to activate real purchases. */
export function verifyLuna35ReleaseEvidence(review,root){
 assert.equal(review.status,'PASS');assert.equal(review.release,'luna35');assert.equal(review.baseCommit,'57f615338d2bd1b45bb724e4174d8943cfde2cef');
 assert.equal(review.projectId,'vkcdtasbdoeilgfucoax');assert.equal(review.stagingProjectId,'funvzpmpbgazsisehiru');
 assert.equal(review.backupRestorePasses,2);assert.ok(review.backupTables>=60);assert.ok(review.backupFunctions>=50);assert.ok(review.backupMediaObjects>=28);assert.equal(review.backupMediaIntegrity,'PASS');
 assert.equal(review.frontendTestsStatus,'PASS');assert.ok(review.frontendTests>=209);assert.equal(review.backendTestsStatus,'PASS');assert.ok(review.backendTests>=405);assert.ok(review.nativeDatabaseChecks>=56);
 assert.equal(review.typeChecks,'PASS');assert.equal(review.lint,'PASS');assert.equal(review.mobileStatus,'PASS');assert.ok(review.mobileCases>=40);assert.equal(review.stagingPersistence,'PASS');assert.equal(review.realTelegramAuth,'PASS');
 assert.equal(review.aiSmokeStatus,'PASS');assert.ok(review.aiProviderCalls>0&&review.aiProviderCalls<=3);assert.ok(review.aiCostUsd>0&&review.aiCostUsd<=.02);assert.equal(review.unknownAiSpendUsd,0);assert.equal(review.commerceOnlyProviderCalls,0);assert.equal(review.savedResultsProviderCalls,0);
 assert.equal(review.migrationStatus,'verified-production');assert.equal(review.unrelatedObjectsUnchanged,true);assert.equal(review.balancesAndPaidRightsPreserved,true);assert.equal(review.monetizationEnabled,false);assert.equal(review.newCommercialQuotasEnabled,false);assert.equal(review.aiBudgetBaselinePreserved,true);assert.equal(review.approvedAiCapUsd,100);
 assert.equal(review.realStarsTransactions,0);assert.equal(review.commercialActivationReady,false);
 const files=['20261017030230_luna35_conversational_commerce.sql','20261017032725_luna35_private_funnel_events.sql'];assert.deepEqual(Object.keys(review.migrationHashes).sort(),files.sort());for(const file of files)assert.equal(createHash('sha256').update(readFileSync(resolve(root,'supabase/migrations',file))).digest('hex'),review.migrationHashes[file]);
 assert.equal(review.sourceDigest,releaseSourceDigest(root),'Source changed after Luna 3.5 verification');
}
