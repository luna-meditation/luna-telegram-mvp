import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {releaseSourceDigest} from './release-source-digest.mjs';

export const coreRelease='luna-intelligence-core-v1-ux';
export const coreBase='d68968805e4f52f78dd108025c87f55664f03e00';
const preservationSha='6b30f98927337fd65ce08f3e69aa7d852efaa035549c84579e248c8642f42df9';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=(root,path)=>JSON.parse(readFileSync(resolve(root,path),'utf8'));
export function coreSourceDigest(root){
 const additional=['railway.json','pnpm-workspace.yaml','scripts/verify-core-hosted.mjs','scripts/prepare-core-release.mjs'];
 return sha(JSON.stringify({app:releaseSourceDigest(root),additional:additional.map(path=>[path,sha(readFileSync(resolve(root,path)))])}));
}
function passed(report,min){assert.equal(report.status,'PASS');assert.ok(report.checks.length>=min);assert.ok(report.checks.every(c=>c.status==='PASS'));}
/** Source-bound release acceptance. Historical AI comparisons remain labelled
 * historical; isolated fixtures are never treated as production user data. */
export function verifyCoreReleaseEvidence(r,root,{now=Date.now()}={}){
 assert.equal(read(root,'railway.json').deploy.startCommand,'NODE_ENV=production pnpm --filter @luna/backend start');
 assert.equal(r.release,coreRelease);assert.equal(r.status,'PASS');assert.equal(r.baseCommit,coreBase);
 assert.equal(r.projectId,'vkcdtasbdoeilgfucoax');assert.equal(r.stagingProjectId,'funvzpmpbgazsisehiru');
 assert.deepEqual(r.criticalBlockers,[]);assert.ok(r.knownLimitations.length>=4);
 assert.equal(r.productionModel,'gpt-5-mini');assert.equal(r.aiCapUsd,100);
 for(const key of ['modelChanged','aiCapChanged','financialPolicyChanged','customerDataMutatedByTests'])assert.equal(r[key],false,key);
 for(const key of ['newProviderGenerations','realFinancialOperations','additionalProductionMigrations'])assert.equal(r[key],0,key);
 assert.equal(r.aiQuality,'historical-exploratory-with-known-limitations');
 assert.equal(r.physicalTelegramAcceptance,'pending-owner-review');
 const required=['commands','dependency-audit','native-full','hosted-sql','candidate-http','production-acl','telegram-auth','credential-retirement','recovery','mobile','performance'];
 assert.deepEqual(Object.keys(r.evidence).sort(),required.sort());
 const evidence={};
 for(const key of required){const entry=r.evidence[key];assert.match(entry.path,/^qa\/core-release\/[a-z0-9-]+\.json$/);const bytes=readFileSync(resolve(root,entry.path));assert.equal(sha(bytes),entry.sha256,`${key}: evidence changed`);evidence[key]=JSON.parse(bytes);}
 const commands=evidence.commands;assert.match(commands.node,/^v22\./);assert.equal(commands.externalNetworkBlocked,true);assert.equal(commands.results.length,9);assert.ok(commands.results.every(c=>c.exitCode===0));
 assert.ok(r.backendTests>=979);assert.ok(r.frontendTests>=294);
 assert.ok(Object.values(evidence['dependency-audit'].metadata.vulnerabilities).every(n=>n===0),'Unresolved dependency advisory');
 passed(evidence['native-full'],31);assert.equal(evidence['native-full'].realFinancialOperations,0);assert.equal(evidence['native-full'].copiedCustomerRows,0);
 passed(evidence['hosted-sql'],14);assert.equal(evidence['hosted-sql'].projectId,r.stagingProjectId);
 const http=evidence['candidate-http'];passed(http,20);assert.equal(http.stagingProjectId,r.stagingProjectId);assert.equal(http.realHttp,true);assert.equal(http.realSupabaseSdk,true);assert.equal(http.cleanup,'PASS');assert.equal(http.providerCalls,0);assert.equal(http.productionWrites,0);assert.equal(http.requests.blocked,0);
 const acl=evidence['production-acl'];assert.equal(acl.tables,16);assert.equal(acl.rlsEnabled,16);assert.equal(acl.appliedMigrationPresent,true);for(const key of ['missingServiceCrud','browserPrivilegeMismatches','unexpectedExplicitBrowserColumnGrants'])assert.equal(acl[key],0);
 const auth=evidence['telegram-auth'];assert.equal(auth.telegramReadOnlyApi.botUsername,'myluna_app');for(const key of ['identityMatches','webhookMatches','miniAppUrlMatches'])assert.equal(auth.telegramReadOnlyApi[key],true);assert.equal(auth.deployedAuthChecks.find(c=>c.name==='valid_signature').httpStatus,200);assert.ok(auth.deployedAuthChecks.filter(c=>c.name!=='valid_signature').every(c=>[401,403].includes(c.httpStatus)));
 const retired=evidence['credential-retirement'];assert.equal(retired.databasePasswordRotation.status,'owner_confirmed');assert.equal(retired.oldOpenAIKeyRetirement.status,'owner_confirmed');assert.ok(retired.legacyApiKeysDisabled.verifiedAt);assert.equal(retired.checks.newSecretFormat,true);assert.equal(retired.checks.projectMatches,true);assert.equal(retired.postDisableRuntimeChecks.memoriesZeroRowRead.status,200);
 const recovery=evidence.recovery;assert.equal(recovery.status,'PASS');assert.equal(recovery.backupOutsideSyncedDocuments,true);assert.equal(recovery.temporaryPlaintextRemoved,true);assert.equal(recovery.passes.length,2);assert.ok(recovery.passes.every(p=>p.status==='PASS'&&p.allRowsCompared&&p.allTableAndFunctionAclsCompared&&p.functionDefinitionsCompared&&p.rlsCompared));assert.deepEqual([recovery.coverage.tables,recovery.coverage.functions,recovery.media.objects],[91,127,28]);assert.equal(recovery.media.status,'PASS');assert.equal(recovery.media.sourceVersionsVerified,true);assert.equal(recovery.media.allArchivesDecryptedAndContentHashesVerified,true);const age=now-Date.parse(recovery.capturedAt);assert.ok(age>=0&&age<86400000,'Fresh verified recovery required');
 const mobile=evidence.mobile;assert.equal(mobile.status,'PASS');assert.equal(mobile.totalChecks,704);assert.equal(mobile.variants.length,16);assert.equal(mobile.variants.reduce((sum,c)=>sum+c.checks,0),704);assert.ok(mobile.variants.every(c=>c.status==='PASS'&&c.checks===44));for(const engine of ['chromium','webkit'])for(const width of [360,375,390,393])for(const language of ['ru','en'])assert.equal(mobile.variants.filter(c=>c.engine===engine&&c.width===width&&c.language===language).length,1);assert.match(mobile.localDetailedEvidenceSha256,/^[a-f0-9]{64}$/);
 const performance=evidence.performance;assert.equal(performance.status,'PASS');assert.equal(performance.results.length,2);assert.ok(performance.results.every(r=>r.status==='PASS'&&r.backgroundRemounts===0));
 const preservedPath='qa/intelligence-core-v1/preservation.json';assert.equal(sha(readFileSync(resolve(root,preservedPath))),preservationSha);const preserved=read(root,preservedPath);assert.equal(Object.keys(preserved.hashes).length,687);assert.equal(preserved.financialBackendFiles,33);
 for(const[path,expected]of Object.entries(preserved.hashes))assert.equal(sha(readFileSync(resolve(root,path))),expected,`Protected source changed: ${path}`);
 execFileSync('git',['diff','--exit-code',preserved.baseline,'--',...Object.keys(preserved.hashes)],{cwd:root,stdio:'pipe'});
 assert.equal(r.sourceDigest,coreSourceDigest(root),'Source changed after Core release verification');
 return true;
}
