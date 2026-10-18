import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {releaseSourceDigest} from './release-source-digest.mjs';

export const luna43MigrationNames=[
 '20261018025945_luna43_commercial_activation_foundation.sql',
 '20261018033506_luna43_admin_commercial_entitlement_visibility.sql'
];
/** No unchecked prices, stale recovery evidence, unknown provider outcomes or
 * hidden quota changes may pass the production build. Device checks are honest
 * limitations, not inferred from a desktop microphone fixture. */
export function verifyLuna43ReleaseEvidence(r,root){
 assert.equal(r.status,'PASS');assert.equal(r.release,'luna43');
 assert.equal(r.baseCommit,'2ab6cc0b651b06a85e41b811f6da003425135732');
 assert.equal(r.projectId,'vkcdtasbdoeilgfucoax');assert.equal(r.stagingProjectId,'funvzpmpbgazsisehiru');
 assert.equal(r.backupRestorePasses,2);assert.equal(r.backupTables,79);assert.equal(r.backupFunctions,79);
 assert.equal(r.backupMediaObjects,28);assert.equal(r.backupMediaIntegrity,'PASS');
 assert.ok(Date.now()-Date.parse(r.backupCapturedAt)>=0&&Date.now()-Date.parse(r.backupCapturedAt)<86400000);
 for(const key of ['frontendTestsStatus','backendTestsStatus','typeChecks','lint','mobileStatus','stagingPersistence','telegramAuthorization','aiSmokeStatus','voiceCaptureStatus','voiceTranscriptionStatus','savedReplayStatus','productionRecoveryMigrationReview'])assert.equal(r[key],'PASS',key);
 assert.ok(r.frontendTests>=249);assert.ok(r.backendTests>=602);assert.ok(r.nativeDatabaseChecks>=56);assert.ok(r.mobileCases>=16);
 assert.ok(r.stagingPersistenceChecks>=20);assert.equal(r.voiceLanguages,2);assert.equal(r.savedResultsProviderCalls,0);
 assert.ok(r.aiProviderCalls>0&&r.aiProviderCalls<=40);assert.ok(r.transcriptionCalls>=2&&r.transcriptionCalls<=8);
 assert.ok(r.aiCostUsd>0&&r.aiCostUsd<=.50);assert.equal(r.unknownAiSpendUsd,0);
 assert.equal(r.productionModel,'gpt-5-mini');assert.equal(r.approvedAiCapUsd,100);
 assert.deepEqual(r.newStarsPrices,{weekly:500,monthly:1000,annual:5000,lifetime:10000});
 assert.deepEqual(r.newSeedPrices,{aiMessages:{seeds:50,quantity:20},deepAnalysis:{seeds:100}});
 assert.equal(r.realTelegramInvoices,'PASS');assert.equal(r.realStarsTransactions,0);
 // Publish the new UI before opening checkout: old clients must not display
 // outdated renewal terms during the coordinated backend/frontend rollout.
 for(const key of ['monetizationApproved','financialAdminMutationsApproved','backendStagingVerified','checkoutClosedForCoordinatedPublish','voiceInputEnabled','balancesAndPaidRightsPreserved','aiBudgetBaselinePreserved','unrelatedObjectsUnchanged','legacyReceiptsPreserved','prepaidNewSubscriptions'])assert.equal(r[key],true,key);
 for(const key of ['newCommercialQuotasEnabled','newRewardRulesEnabled','guidedBreathEnabled','modelSwitchEnabled'])assert.equal(r[key],false,key);
 assert.equal(r.migrationStatus,'verified-production');assert.deepEqual(r.criticalBlockers,[]);
 assert.ok(r.knownLimitations?.length>0);assert.match(r.stagingSourceCommit,/^[a-f0-9]{40}$/);assert.match(r.stagingDeploymentId,/^[a-f0-9]{24}$/);
 assert.deepEqual(Object.keys(r.migrationHashes).sort(),[...luna43MigrationNames].sort());
 for(const name of luna43MigrationNames)assert.equal(createHash('sha256').update(readFileSync(resolve(root,'supabase/migrations',name))).digest('hex'),r.migrationHashes[name]);
 assert.equal(r.sourceDigest,releaseSourceDigest(root),'Source changed after Luna 4.3 verification');
}
