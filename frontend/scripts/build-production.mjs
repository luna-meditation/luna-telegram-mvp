// A real release build, not the synthetic offline preview server.
import assert from 'node:assert/strict';
import {verifyLuna32ReleaseBudget} from './luna32-release-budget.mjs';
import {spawnSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyLuna34ReleaseEvidence} from './luna34-release-gates.mjs';
import {verifyLuna35ReleaseEvidence} from './luna35-release-gates.mjs';
import {verifyLuna40ReleaseEvidence} from './luna40-release-gates.mjs';
import {verifyLuna41ReleaseEvidence} from './luna41-release-gates.mjs';
import {verifyLuna42ReleaseEvidence} from './luna42-release-gates.mjs';
import {verifyLuna43ReleaseEvidence} from './luna43-release-gates.mjs';
import {verifyLunaIntelligenceReleaseEvidence} from './luna-intelligence-release-gates.mjs';
import {verifyLuna4CompletionEvidence} from './luna4-completion-release-gates.mjs';
import {verifyLuna5ReleaseEvidence} from './luna5-release-gates.mjs';
import {verifyCoreReleaseEvidence} from './core-v1-release-gates.mjs';
import {verifyProductV2Evidence} from './product-v2-release-gates.mjs';
import {waitForProductBackend} from './wait-product-v2-backend.mjs';
import {releaseSourceDigest} from './release-source-digest.mjs';
assert.equal(process.versions.node.split('.')[0],'22','Production requires Node.js 22');
const frontend=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const api=new URL(process.env.VITE_API_URL?.trim()||'https://invalid.invalid');
assert.ok(api.protocol==='https:'&&!['invalid.invalid','localhost','127.0.0.1','::1'].includes(api.hostname),'Provide the verified production VITE_API_URL');
assert.ok(!api.username&&!api.password&&!api.search&&!api.hash,'The public API URL must not carry credentials or tokens');
const profile=process.env.LUNA_RELEASE_PROFILE??'tarot-phase2';
const capabilityProfile=['luna35','luna40','luna41','luna42','luna43','intelligence','luna4-completion','luna5','core-v1','product-v2'].includes(profile)?'luna34':profile;
assert.ok(['luna24','luna25','luna251','luna30','luna31','luna32','luna33','luna34'].includes(capabilityProfile)||!process.env.VITE_FEATURE_AI_CENTRAL_EXPERIENCE||process.env.VITE_FEATURE_AI_CENTRAL_EXPERIENCE==='false','Luna development is not approved for production');
assert.ok(['tarot-phase2','luna2','luna21','luna23','luna24','luna25','luna251','luna30','luna31','luna32','luna33','luna34'].includes(capabilityProfile),'Unknown approved release profile');
const foundation=['PERSONALIZATION','AI_MODES','TAROT_HISTORY','TAROT_AI'];
const required=['NEW_NAVIGATION','TAROT_DAILY',...(['luna2','luna21','luna23','luna24','luna25','luna251','luna30','luna31','luna32','luna33','luna34'].includes(capabilityProfile)?foundation:[]),...(['luna21','luna23','luna24','luna25','luna251','luna30','luna31','luna32','luna33','luna34'].includes(capabilityProfile)?['DAILY_CARD_V2']:[]),...(['luna23','luna24','luna25','luna251','luna30','luna31','luna32','luna33','luna34'].includes(capabilityProfile)?['PERSONAL_MEMORY']:[]),...(['luna24','luna25','luna251','luna30','luna31','luna32','luna33','luna34'].includes(capabilityProfile)?['AI_CENTRAL_EXPERIENCE','TAROT_SPREADS']:[]),...(['luna30','luna31','luna32','luna33','luna34'].includes(capabilityProfile)?['ASTROLOGY','BREATHWORK_AUDIO']:[])];
const disabled=[...(['luna23','luna24','luna25','luna251','luna30','luna31','luna32','luna33','luna34'].includes(capabilityProfile)?[]:['PERSONAL_MEMORY']),...(['luna24','luna25','luna251','luna30','luna31','luna32','luna33','luna34'].includes(capabilityProfile)?[]:['TAROT_SPREADS']),...(['luna30','luna31','luna32','luna33','luna34'].includes(capabilityProfile)?[]:['ASTROLOGY','BREATHWORK_AUDIO']),...(['luna43','intelligence','luna4-completion','luna5','core-v1','product-v2'].includes(profile)?[]:['MOON_SEEDS_WALLET_V2','MOON_SEEDS_PURCHASES','TAROT_PAID_READINGS']),...(['luna4-completion','luna5','core-v1','product-v2'].includes(profile)?[]:['ECONOMY_REWARDS_V2','PREMIUM_V2']),...(['luna2','luna21','luna23','luna24','luna25','luna251','luna30','luna31','luna32','luna33','luna34'].includes(capabilityProfile)?[]:foundation)];
for(const key of required)assert.equal(process.env[`VITE_FEATURE_${key}`],'true',`${key} must be explicitly enabled for this release`);
for(const key of disabled)assert.ok(!process.env[`VITE_FEATURE_${key}`]||process.env[`VITE_FEATURE_${key}`]==='false',`${key} is not part of the approved release`);
if(profile==='luna2'){
 const reviewPath=process.env.LUNA_RELEASE_DB_REVIEW;
 assert.ok(reviewPath,'Luna 2.0 requires the isolated database review report');
 const review=JSON.parse(readFileSync(reviewPath,'utf8'));
 assert.equal(review.status,'PASS');assert.equal(review.productionWrites,0);
 assert.ok(review.checks.length>=20,'The required migration, RLS and rollback checks must pass');
 const files=['20261014034527_luna_garden_atomic_mutations.sql','20261014035512_luna_personalization_foundation.sql','20261014041334_luna_tarot_ai_reading_history.sql','20261013061155_luna_security_boundary_hardening.sql'];
 for(const name of files){const sql=readFileSync(resolve(frontend,'../supabase/migrations',name));assert.equal(createHash('sha256').update(sql).digest('hex'),review.migrationHashes?.[name],`Migration changed since review: ${name}`);}
 // This verifies the local artifact, not live schema installation. Rollout still
 // requires backend-first runtime checks and explicit production SQL verification.
}
if(profile==='luna21'){
 const reviewPath=process.env.LUNA_RELEASE_DB_REVIEW;assert.ok(reviewPath,'Luna 2.1 requires the isolated database review');
 const review=JSON.parse(readFileSync(reviewPath,'utf8'));assert.equal(review.status,'PASS');assert.equal(review.productionWrites,0);assert.equal(review.projectId,'vkcdtasbdoeilgfucoax');assert.ok(review.checks.length>=23);
 for(const name of ['20261014141843_luna21_daily_card.sql','20261014141847_luna21_economy_foundation.sql','20261014141850_luna21_atomic_stars_fulfillment.sql','20261014142638_luna21_tarot_spreads.sql'])assert.equal(createHash('sha256').update(readFileSync(resolve(frontend,'../supabase/migrations',name))).digest('hex'),review.migrationHashes?.[name],`Migration changed since review: ${name}`);
}
const commit=process.env.VITE_COMMIT_SHA||process.env.COMMIT_REF||process.env.GIT_COMMIT_SHA;
if(['luna23','luna24','luna25','luna251'].includes(profile)){
 const reviewPath=process.env.LUNA_RELEASE_DB_REVIEW;assert.ok(reviewPath,'Luna 2.3 requires verified backup/restore and database review');
 const review=JSON.parse(readFileSync(reviewPath,'utf8'));
 assert.equal(review.status,'PASS');assert.equal(review.projectId,'vkcdtasbdoeilgfucoax');assert.equal(review.productionWrites,0);
 assert.equal(review.backupRestorePasses,2);assert.ok(review.checks.length>=23);
 const name=['luna24','luna25','luna251'].includes(profile)?'20261015115049_luna24_release_qa_ai_budget.sql':'20261015032917_luna23_personal_memory.sql';
 assert.equal(createHash('sha256').update(readFileSync(resolve(frontend,'../supabase/migrations',name))).digest('hex'),review.migrationHashes?.[name],`Migration changed since review: ${name}`);
}
if(profile==='luna25'){
 const review=JSON.parse(readFileSync(process.env.LUNA_RELEASE_DB_REVIEW,'utf8'));
 assert.equal(review.release,'luna25');assert.equal(review.noDatabaseMigrations,true);
 assert.equal(review.baseCommit,'acac0ffc4680ea40092c6c77ffa2fd7723cef7f4');
 assert.equal(review.mobileCases,48);assert.equal(review.mobileStatus,'PASS');
}
if(profile==='luna251'){
 const review=JSON.parse(readFileSync(process.env.LUNA_RELEASE_DB_REVIEW,'utf8'));
 assert.equal(review.release,'luna251');assert.equal(review.noDatabaseMigrations,true);
 assert.equal(review.baseCommit,'56199e8849e342921dbf15f387d6838156eeabe8');
 assert.equal(review.mobileCases,48);assert.equal(review.mobileStatus,'PASS');
 assert.equal(review.savedAttachmentProviderCalls,0);assert.equal(review.isolatedDbChecks,17);
}
if(profile==='luna30'){
 const review=JSON.parse(readFileSync(process.env.LUNA_RELEASE_DB_REVIEW,'utf8'));
 assert.equal(review.status,'PASS');assert.equal(review.release,'luna30');assert.equal(review.projectId,'vkcdtasbdoeilgfucoax');assert.equal(review.baseCommit,'c04f78c59f8a5bd5aaf394bb73d44e43d2808020');
 assert.equal(review.productionWrites,0);assert.equal(review.backupRestorePasses,2);assert.equal(review.backupMediaObjects,28);assert.ok(review.checks.length>=24);
 assert.equal(review.mobileStatus,'PASS');assert.ok(review.mobileCases>=80);assert.equal(review.aiSmokeStatus,'PASS');assert.equal(review.aiSmokeCalls,2);assert.ok(review.aiSmokeCostUsd>0&&review.aiSmokeCostUsd<=0.02);assert.equal(review.monetizationEnabled,false);
 for(const [name,expected]of Object.entries(review.migrationHashes))assert.equal(createHash('sha256').update(readFileSync(resolve(frontend,'../supabase/migrations',name))).digest('hex'),expected,`Migration changed since review: ${name}`);
 assert.equal(Object.keys(review.migrationHashes).length,5);
}
if(profile==='luna31'){
 const review=JSON.parse(readFileSync(process.env.LUNA_RELEASE_DB_REVIEW,'utf8'));
 assert.equal(review.status,'PASS');assert.equal(review.release,'luna31');assert.equal(review.baseCommit,'232c6e08fdcbc8ec5cd550df88242a1728dc79ef');
 assert.equal(review.projectId,'vkcdtasbdoeilgfucoax');assert.equal(review.productionWrites,0);assert.equal(review.noDatabaseMigrations,true);
 assert.equal(review.backupRestorePasses,2);assert.equal(review.backupTables,48);assert.equal(review.backupFunctions,33);assert.equal(review.backupMediaObjects,28);
 assert.equal(review.mobileStatus,'PASS');assert.ok(review.mobileCases>=96);assert.equal(review.aiSmokeStatus,'PASS');assert.equal(review.aiSmokeCalls,8);assert.ok(review.aiSmokeCostUsd>0&&review.aiSmokeCostUsd<=0.04);assert.equal(review.aiAdditionalCalls,2);assert.ok(review.aiAdditionalCostUsd>0&&review.aiAdditionalCostUsd<=0.01);assert.equal(review.aiQualityStatus,'PASS');assert.equal(review.monetizationEnabled,false);
 assert.equal(review.sourceDigest,releaseSourceDigest(resolve(frontend,'..')),'Source changed after the verified release checks');
}
if(profile==='luna33'){
 const review=JSON.parse(readFileSync(process.env.LUNA_RELEASE_DB_REVIEW,'utf8'));
 assert.equal(review.status,'PASS');assert.equal(review.release,'luna33');assert.equal(review.baseCommit,'c2dc4adbeab51fc34bafca7111aee711a7037b37');
 assert.equal(review.projectId,'vkcdtasbdoeilgfucoax');assert.equal(review.stagingProjectId,'funvzpmpbgazsisehiru');assert.equal(review.noDatabaseMigrations,true);
 assert.equal(review.backupRestorePasses,2);assert.equal(review.backupTables,53);assert.ok(review.backupFunctions>=37);assert.equal(review.backupMediaObjects,28);
 assert.equal(review.frontendTestsStatus,'PASS');assert.ok(review.frontendTests>=197);assert.equal(review.backendTestsStatus,'PASS');assert.ok(review.backendTests>=324);assert.ok(review.nativeDatabaseChecks>=15);
 assert.equal(review.mobileStatus,'PASS');assert.ok(review.mobileCases>=8&&review.mobileChecks>=112);assert.equal(review.aiSmokeStatus,'PASS');assert.ok(review.aiSmokeCalls>0&&review.aiSmokeCalls<=4);assert.ok(review.aiSmokeCostUsd>0&&review.aiSmokeCostUsd<=.03);assert.equal(review.unknownAiSpendUsd,0);
 assert.equal(review.balancesAndPaidRightsPreserved,true);assert.equal(review.sharedExistingDailyQuotasPreserved,true);assert.equal(review.monetizationEnabled,false);assert.equal(review.productionSettingsUnchanged,true);
 assert.equal(review.sourceDigest,releaseSourceDigest(resolve(frontend,'..')),'Source changed after release verification');
}
if(profile==='luna34')verifyLuna34ReleaseEvidence(JSON.parse(readFileSync(process.env.LUNA_RELEASE_DB_REVIEW,'utf8')),resolve(frontend,'..'));
if(profile==='luna35')verifyLuna35ReleaseEvidence(JSON.parse(readFileSync(process.env.LUNA_RELEASE_DB_REVIEW,'utf8')),resolve(frontend,'..'));
if(profile==='luna40')verifyLuna40ReleaseEvidence(JSON.parse(readFileSync(process.env.LUNA_RELEASE_DB_REVIEW,'utf8')),resolve(frontend,'..'));
if(profile==='luna41'){
 assert.equal(process.env.VITE_FEATURE_ADMIN_V4,'true');assert.equal(process.env.VITE_FEATURE_COSMOS_V2,'true');
 assert.ok(!process.env.VITE_FEATURE_BREATHWORK_GUIDED||process.env.VITE_FEATURE_BREATHWORK_GUIDED==='false');
 verifyLuna41ReleaseEvidence(JSON.parse(readFileSync(process.env.LUNA_RELEASE_DB_REVIEW,'utf8')),resolve(frontend,'..'));
}
if(profile==='luna42'){
 assert.equal(process.env.VITE_FEATURE_ADMIN_V4,'true');assert.equal(process.env.VITE_FEATURE_COSMOS_V2,'true');assert.equal(process.env.VITE_FEATURE_AI_VOICE_INPUT,'true');assert.equal(process.env.VITE_FEATURE_BREATHWORK_GUIDED,'false');
 verifyLuna42ReleaseEvidence(JSON.parse(readFileSync(process.env.LUNA_RELEASE_DB_REVIEW,'utf8')),resolve(frontend,'..'));
}
if(profile==='luna43'){
 for(const key of ['ADMIN_V4','COSMOS_V2','AI_VOICE_INPUT','MOON_SEEDS_WALLET_V2','MOON_SEEDS_PURCHASES','TAROT_PAID_READINGS','PAYMENT_ATOMIC'])assert.equal(process.env[`VITE_FEATURE_${key}`],'true',key);
 assert.equal(process.env.VITE_FEATURE_BREATHWORK_GUIDED,'false');
 verifyLuna43ReleaseEvidence(JSON.parse(readFileSync(process.env.LUNA_RELEASE_DB_REVIEW,'utf8')),resolve(frontend,'..'));
}
if(profile==='intelligence'){
 for(const key of ['ADMIN_V4','COSMOS_V2','AI_VOICE_INPUT','MOON_SEEDS_WALLET_V2','MOON_SEEDS_PURCHASES','TAROT_PAID_READINGS','PAYMENT_ATOMIC','LUNA_INTELLIGENCE'])assert.equal(process.env[`VITE_FEATURE_${key}`],'true',key);
 assert.equal(process.env.VITE_FEATURE_BREATHWORK_GUIDED,'false');
 verifyLunaIntelligenceReleaseEvidence(JSON.parse(readFileSync(process.env.LUNA_RELEASE_DB_REVIEW,'utf8')),resolve(frontend,'..'));
}
if(profile==='luna4-completion'){
 for(const key of ['ADMIN_V4','COSMOS_V2','AI_VOICE_INPUT','MOON_SEEDS_WALLET_V2','MOON_SEEDS_PURCHASES','TAROT_PAID_READINGS','PAYMENT_ATOMIC','LUNA_INTELLIGENCE','ECONOMY_REWARDS_V2','PREMIUM_V2'])assert.equal(process.env[`VITE_FEATURE_${key}`],'true',key);
 assert.equal(process.env.VITE_FEATURE_BREATHWORK_GUIDED,'false');
 verifyLuna4CompletionEvidence(JSON.parse(readFileSync(process.env.LUNA_RELEASE_DB_REVIEW,'utf8')),resolve(frontend,'..'));
}
if(profile==='luna5'){
 for(const key of ['ADMIN_V4','COSMOS_V2','AI_VOICE_INPUT','MOON_SEEDS_WALLET_V2','MOON_SEEDS_PURCHASES','TAROT_PAID_READINGS','PAYMENT_ATOMIC','LUNA_INTELLIGENCE','ECONOMY_REWARDS_V2','PREMIUM_V2'])assert.equal(process.env[`VITE_FEATURE_${key}`],'true',key);
 assert.equal(process.env.VITE_FEATURE_BREATHWORK_GUIDED,'false');
 verifyLuna5ReleaseEvidence(JSON.parse(readFileSync(process.env.LUNA_RELEASE_DB_REVIEW,'utf8')),resolve(frontend,'..'));
}
if(profile==='core-v1'||profile==='product-v2'){
 for(const key of ['ADMIN_V4','COSMOS_V2','AI_VOICE_INPUT','MOON_SEEDS_WALLET_V2','MOON_SEEDS_PURCHASES','TAROT_PAID_READINGS','PAYMENT_ATOMIC','LUNA_INTELLIGENCE','ECONOMY_REWARDS_V2','PREMIUM_V2'])assert.equal(process.env[`VITE_FEATURE_${key}`],'true',key);
 assert.equal(process.env.VITE_FEATURE_BREATHWORK_GUIDED,'false');
 assert.equal(process.env.VITE_BOT_USERNAME,'myluna_app');
 assert.equal(api.origin,'https://lunabackend-production-08c8.up.railway.app');
 assert.ok(['','/'].includes(api.pathname));
 const review=JSON.parse(readFileSync(process.env.LUNA_RELEASE_DB_REVIEW,'utf8'));
 if(profile==='core-v1')verifyCoreReleaseEvidence(review,resolve(frontend,'..'));
 else{
  verifyProductV2Evidence(review,resolve(frontend,'..'));
  if(process.env.NETLIFY==='true'&&process.env.CONTEXT==='production')await waitForProductBackend(commit);
 }
}
if(profile==='luna32'){
 const reviewPath=process.env.LUNA_RELEASE_DB_REVIEW;
 assert.ok(reviewPath,'Luna 3.2 requires verified production recovery and staging evidence');
 const review=JSON.parse(readFileSync(reviewPath,'utf8'));
 assert.equal(review.status,'PASS');assert.equal(review.release,'luna32');
 assert.equal(review.baseCommit,'2eaad97551637bdc1112fd4c1d55a00844028f89');
 assert.equal(review.projectId,'vkcdtasbdoeilgfucoax');assert.equal(review.stagingProjectId,'funvzpmpbgazsisehiru');
 assert.equal(review.backupRestorePasses,2);assert.equal(review.backupTables,48);assert.equal(review.backupFunctions,33);assert.equal(review.backupMediaObjects,28);
 assert.equal(review.migrationStatus,'verified-production');assert.equal(review.unrelatedObjectsUnchanged,true);
 const name='20261016112135_luna32_beta_ai_budget_and_dreams.sql';
 assert.equal(createHash('sha256').update(readFileSync(resolve(frontend,'../supabase/migrations',name))).digest('hex'),review.migrationHashes?.[name],'Migration changed since native and staging review');
 assert.ok(review.nativeDatabaseChecks>=14);assert.equal(review.mobileStatus,'PASS');assert.ok(review.mobileCases>=24&&review.mobileScreenStates>=192);
 assert.equal(review.aiSmokeStatus,'PASS');assert.equal(review.aiQualityStatus,'PASS');assert.ok(review.aiSmokeCalls>0&&review.aiSmokeCalls<=7);assert.ok(review.aiSmokeCostUsd>0&&review.aiSmokeCostUsd<=0.03);assert.ok(review.aiAdditionalCalls>0&&review.aiAdditionalCalls<=2&&review.aiAdditionalCostUsd>0&&review.aiAdditionalCostUsd<=0.01);assert.equal(review.unknownAiSpendUsd,0);
 verifyLuna32ReleaseBudget(review);
 assert.equal(review.sharedExistingDailyQuotasPreserved,true);assert.equal(review.balancesAndPaidRightsPreserved,true);assert.equal(review.monetizationEnabled,false);
 assert.equal(review.sourceDigest,releaseSourceDigest(resolve(frontend,'..')),'Source changed after release verification');
}
assert.match(commit??'',/^[a-f0-9]{40}$/,'A verified source commit is required');
const env={...process.env,VITE_COMMIT_SHA:commit,VITE_DEPLOY_ENV:'production',VITE_RELEASE_PROFILE:profile};
for(const script of ['node_modules/typescript/bin/tsc','node_modules/vite/bin/vite.js']){
 const child=spawnSync(process.execPath,[resolve(frontend,script),...(script.includes('vite')?['build']:[])],{cwd:frontend,env,stdio:'inherit'});
 assert.equal(child.status,0,'Production build failed');
}
const index=readFileSync(resolve(frontend,'dist/index.html'),'utf8');
assert.ok(index.includes('https://telegram.org/js/telegram-web-app.js'),'The real Telegram SDK must remain connected');
assert.ok(!/offline-local-qa|synthetic-local|window\.Telegram\?\?=/.test(index),'Never ship the offline Telegram bridge');
console.log(`Production artifact ready for source ${commit}; no deployment was started.`);
