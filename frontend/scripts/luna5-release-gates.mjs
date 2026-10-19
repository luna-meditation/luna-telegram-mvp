import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {releaseSourceDigest} from './release-source-digest.mjs';
export const luna5BaseCommit='949d7d2857c65724f2e90d2046a38cb83c3a8c27';
export const luna5Migration='20261019184219_luna5_chat_role_boundary.sql';
/** Focused owner-approved release. Historical paid benchmarks are not relabelled
 * as new conversational evidence; no new provider budget is consumed here. */
export function verifyLuna5ReleaseEvidence(r,root){
 assert.equal(r.release,'luna5-personal-intelligence');assert.equal(r.status,'PASS');assert.equal(r.baseCommit,luna5BaseCommit);assert.equal(r.projectId,'vkcdtasbdoeilgfucoax');
 for(const key of ['frontendTestsStatus','backendTestsStatus','typeChecks','lint','backendBuild','mobileStatus','nativeSecurity','backupIntegrity','backupMediaIntegrity','financialCompatibility','localWorkflowPersistence','deferredTarot','freshChatEntry','privacyConsent','legacyOnboardingRemoved','symbolicSources'])assert.equal(r[key],'PASS',key);
 assert.ok(r.frontendTests>=287&&r.backendTests>=947);assert.ok(r.nativeDatabaseChecks>=9);assert.ok(r.mobileCases>=16&&r.mobileChecks>=256);
 assert.equal(r.stagingPublications,0);assert.equal(r.productionPublicationsBeforeRelease,0);assert.equal(r.approvedProductionPublications,1);
 assert.equal(r.paidProviderCalls,0);assert.equal(r.paidTranscriptions,0);assert.equal(r.aiTestCostUsd,0);assert.equal(r.freshProviderQuality,'not-run-owner-focused-policy');assert.equal(r.subjectiveIphoneQuality,'pending-owner-review');
 assert.equal(r.productionModel,'gpt-5-mini');assert.equal(r.modelChanged,false);assert.equal(r.aiCapUsd,100);assert.equal(r.aiCapChanged,false);assert.equal(r.financialPolicyChanged,false);assert.equal(r.realStarsTransactions,0);assert.equal(r.userDataMutatedByTests,false);
 assert.equal(r.backupRestorePasses,2);assert.equal(r.backupTables,91);assert.equal(r.backupFunctions,127);assert.equal(r.backupMediaObjects,28);assert.ok(r.backupRows>=0);assert.equal(r.backupTemporaryPlaintextRemoved,true);assert.equal(r.backupOutsideSyncedDocuments,true);const age=Date.now()-Date.parse(r.backupCapturedAt);assert.ok(age>=0&&age<86400000,'Current recoverable backup required');
 assert.equal(r.migrationStatus,'verified-native-rollback');assert.equal(r.blockedHistoricalSecurityMigrationApplied,false);assert.deepEqual(Object.keys(r.migrationHashes),[luna5Migration]);assert.equal(r.migrationHashes[luna5Migration],createHash('sha256').update(readFileSync(resolve(root,'supabase/migrations',luna5Migration))).digest('hex'));
 // Fail if a financial/configuration module was changed under this nonfinancial
 // release. Tarot orchestration is reviewed/tested separately, not a new wallet.
 const protectedPaths=['backend/src/plans.ts','backend/src/config.ts','backend/src/db.ts',':(glob)backend/src/luna4*.ts','backend/src/luna32-runtime.ts','backend/src/luna32-ai-budget.ts','backend/src/tarot.ts','backend/src/tarot-spreads.ts','frontend/src/features/membership'];
 execFileSync('git',['diff','--exit-code',luna5BaseCommit,'--',...protectedPaths],{cwd:root,stdio:'pipe'});
 assert.ok(r.knownLimitations.length>0);assert.deepEqual(r.criticalBlockers,[]);assert.equal(r.sourceDigest,releaseSourceDigest(root),'Source changed after Luna 5 verification');
}
