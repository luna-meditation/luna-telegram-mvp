// Consolidate existing execution records; never run providers or mutate data.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {coreSourceDigest,coreBase,coreRelease,verifyCoreReleaseEvidence} from '../frontend/scripts/core-v1-release-gates.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),directory=resolve(root,'qa/core-release');
const files=['commands','dependency-audit','native-full','hosted-sql','candidate-http','production-acl','telegram-auth','credential-retirement','recovery','mobile','performance'];
const evidence=Object.fromEntries(files.map(name=>{const path=`qa/core-release/${name}.json`;return[name,{path,sha256:createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex')}];}));
const count=(file)=>{const text=readFileSync(resolve(root,'qa/intelligence-core-v1/local',file),'utf8');const match=text.match(/^# pass (\d+)$/m);if(!match)throw Error('Missing executed test count: '+file);return Number(match[1]);};
const review={release:coreRelease,status:'PASS',preparedAt:new Date().toISOString(),baseCommit:coreBase,projectId:'vkcdtasbdoeilgfucoax',stagingProjectId:'funvzpmpbgazsisehiru',productionModel:'gpt-5-mini',aiCapUsd:100,modelChanged:false,aiCapChanged:false,financialPolicyChanged:false,customerDataMutatedByTests:false,newProviderGenerations:0,realFinancialOperations:0,additionalProductionMigrations:0,aiQuality:'historical-exploratory-with-known-limitations',historicalEvaluation:{attempts:80,costUsd:.053901,blindedHumanReview:false},physicalTelegramAcceptance:'pending-owner-review',backendTests:count('backend-tests.log'),frontendTests:count('frontend-tests.log'),evidence,sourceDigest:coreSourceDigest(root),criticalBlockers:[],knownLimitations:[
 'Fresh provider prose was not generated in this release run. The historical 80-attempt exploratory comparison is not final-source or statistical proof; Russian phrasing, inference and symbolic certainty limitations remain.',
 'Discoveries require explicit user confirmation. Automatic personal discovery quality and full cross-domain synthesis are not accepted capabilities.',
 'Chat finalization spans existing writes and is not a new all-or-nothing transaction. Existing immutable retries and tested idempotency are preserved.',
 'The full product currently uses dark theme. A CSS light fallback is diagnostic, not a complete selectable light theme.',
 'Browser mobile emulation does not prove physical iPhone/Telegram GPU, power, keyboard or suspension behavior.',
 'Direct administrative parent-account cascade deletion can hit the existing portrait-state FK trigger. No user-facing full-account delete route exists; supported memory/profile deletion was verified. Maintenance cleanup must delete owned source records before the parent. A schema fix is deferred for separate reviewed migration.',
 'Supabase leaked-password protection is off; default ACLs for future objects in the shared project need a scoped follow-up. Current Luna browser access and all 16 corrected tables are verified.'
]};
verifyCoreReleaseEvidence(review,root);
writeFileSync(resolve(root,'qa/core-v1-release-review.json'),JSON.stringify(review,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',sourceDigest:review.sourceDigest,backendTests:review.backendTests,frontendTests:review.frontendTests,evidence:files.length}));
