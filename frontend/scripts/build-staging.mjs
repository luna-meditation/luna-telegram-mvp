import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';

assert.equal(process.versions.node.split('.')[0],'22','Staging requires Node.js 22');
const frontend=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const commit=process.env.VITE_COMMIT_SHA;
assert.match(commit??'',/^[a-f0-9]{40}$/,'Provide the verified development commit SHA');
const requestedProfile=process.env.LUNA_STAGING_PROFILE??'luna23';
const profile=['luna35','luna40','luna41'].includes(requestedProfile)?'luna34':requestedProfile;assert.ok(['luna23','luna24','luna30','luna31','luna32','luna33','luna34'].includes(profile));
const current=['luna31','luna32','luna33','luna34'].includes(profile);
const enabled=[...(current?['DAILY_CARD_V2']:[]),'NEW_NAVIGATION','TAROT_DAILY','PERSONALIZATION','PERSONAL_MEMORY','AI_MODES','TAROT_HISTORY','TAROT_AI',...(['luna24','luna30','luna31','luna32','luna33','luna34'].includes(profile)?['AI_CENTRAL_EXPERIENCE','TAROT_SPREADS']:[]),...(['luna30','luna31','luna32','luna33','luna34'].includes(profile)?['ASTROLOGY','BREATHWORK_AUDIO']:[])];
const disabled=[...(['luna24','luna30','luna31','luna32','luna33','luna34'].includes(profile)?[]:['AI_CENTRAL_EXPERIENCE','TAROT_SPREADS']),...(['luna30','luna31','luna32','luna33','luna34'].includes(profile)?[]:['ASTROLOGY','BREATHWORK_AUDIO']),'MOON_SEEDS_WALLET_V2','MOON_SEEDS_PURCHASES',...(current?[]:['DAILY_CARD_V2']),'ECONOMY_REWARDS_V2','TAROT_PAID_READINGS','PREMIUM_V2','PAYMENT_ATOMIC'];
// Public fields only: never spread server secrets into the bundler environment.
const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,
 NODE_ENV:'production',VITE_API_URL:'',VITE_BOT_USERNAME:process.env.VITE_BOT_USERNAME??'',
 VITE_FEATURE_ADMIN_V4:['luna40','luna41'].includes(requestedProfile)?'true':'false',
 VITE_FEATURE_COSMOS_V2:requestedProfile==='luna41'?'true':'false',
 VITE_FEATURE_BREATHWORK_GUIDED:'false', // Device audition pending; local QA may opt in.
 VITE_COMMIT_SHA:commit,VITE_DEPLOY_ENV:'staging',
 ...Object.fromEntries(enabled.map(key=>[`VITE_FEATURE_${key}`,'true'])),
 ...Object.fromEntries(disabled.map(key=>[`VITE_FEATURE_${key}`,'false']))};
for(const script of ['node_modules/typescript/bin/tsc','node_modules/vite/bin/vite.js']){
 const child=spawnSync(process.execPath,[resolve(frontend,script),...(script.includes('vite')?['build','--outDir','dist-staging']:[])],{cwd:frontend,env,stdio:'inherit'});
 assert.equal(child.status,0,'Staging build failed');
}
const index=readFileSync(resolve(frontend,'dist-staging/index.html'),'utf8');
assert.ok(index.includes('https://telegram.org/js/telegram-web-app.js'),'The real Telegram SDK is required');
assert.ok(!/offline-local-qa|synthetic-local|window\.Telegram\?\?=/.test(index),'Synthetic Telegram bridges are forbidden in real staging');
console.log('Real staging artifact built locally; no cloud build or deployment started.');
