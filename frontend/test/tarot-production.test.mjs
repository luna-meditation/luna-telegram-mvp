import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const text=path=>readFileSync(resolve(process.cwd(),path),'utf8');
test('only the approved frontend flags are enabled in the production context',()=>{
 const config=text('../netlify.toml');
 assert.match(config,/\[context.production\][\s\S]*build:production/);
 const production=config.split('[context.production.environment]')[1].split('[[redirects]]')[0];
 assert.match(production,/LUNA_RELEASE_PROFILE = "luna41"/);
 assert.match(production,/LUNA_RELEASE_DB_REVIEW = "\.\.\/qa\/luna41-release-review.json"/);
 assert.match(production,/VITE_FEATURE_ADMIN_V4 = "true"/);
 assert.match(production,/VITE_FEATURE_COSMOS_V2 = "true"/);
 assert.match(production,/VITE_FEATURE_BREATHWORK_GUIDED = "false"/);
 assert.match(text('scripts/build-production.mjs'),/if\(profile==='luna41'\)/);
 assert.match(text('scripts/luna41-release-gates.mjs'),/verifyLuna41ReleaseEvidence/);
 assert.match(text('scripts/build-production.mjs'),/review\.sourceDigest,releaseSourceDigest/);
 for(const key of ['NEW_NAVIGATION','TAROT_DAILY','TAROT_SPREADS','AI_CENTRAL_EXPERIENCE','ASTROLOGY','BREATHWORK_AUDIO'])assert.match(production,new RegExp(`VITE_FEATURE_${key} = "true"`));
 for(const key of ['MOON_SEEDS_WALLET_V2','MOON_SEEDS_PURCHASES','ECONOMY_REWARDS_V2','PREMIUM_V2','TAROT_PAID_READINGS'])assert.match(production,new RegExp(`VITE_FEATURE_${key} = "false"`));
 assert.match(text('src/config/featureFlagDefinitions.ts'),/source\[featureFlagEnvironment\[key\]\] \?\? ''/);
});
test('stable Tarot image URLs cache without an immutable stale-art trap or frame blocking',()=>{
 const headers=text('public/_headers');assert.match(headers,/\/assets\/tarot\/\*/);assert.match(headers,/max-age=86400/);assert.match(headers,/stale-while-revalidate=604800/);
 assert.doesNotMatch(headers.split('/assets/optimized/')[0],/Cache-Control:[^\n]*immutable/);
 assert.doesNotMatch(headers,/X-Frame-Options|frame-ancestors/);
 assert.match(headers,/\/assets\/optimized\/\*[\s\S]*immutable/);
});
test('production packaging preserves the real Telegram SDK and cannot ship a preview bridge',()=>{
 const build=text('scripts/build-production.mjs');assert.match(build,/Production requires Node.js 22/);assert.match(build,/Provide the verified production VITE_API_URL/);
 assert.match(build,/A verified source commit is required/);assert.match(build,/Never ship the offline Telegram bridge/);
 assert.doesNotMatch(build,/phase2-preview|offline-fixture|createServer|fixture.*user/);
 const html=text('index.html');assert.match(html,/https:\/\/telegram.org\/js\/telegram-web-app.js/);assert.doesNotMatch(html,/window\.Telegram\?\?=/);
});
test('Tarot loads only its card back and the selected artwork, never an eager deck of images',()=>{
 const deck=text('src/features/tarot/deck.ts'),page=text('src/features/tarot/TarotPage.tsx');
 assert.doesNotMatch(deck,/new Image|fetch\(|preload|Image\(\)/);assert.doesNotMatch(page,/preload|new Image|fetch\(/);
 assert.match(page,/const card=session.result\?tarotDeck.find/);assert.match(page,/session.choices.map\(\(_,slot\)/);
});
test('the anonymous display fallback is never synced as a production Telegram user',()=>{
 const app=text('src/App.tsx'),boot=app.slice(app.indexOf('async function boot()'),app.indexOf('await checkAdmin(initData)'));
 assert.match(boot,/if \(initData && telegram\?\.initDataUnsafe.user\)/);
 assert.match(boot,/syncUser\(telegram.initDataUnsafe.user, initData\)/);
 assert.doesNotMatch(boot,/syncUser\(user, initData\)/);
});
