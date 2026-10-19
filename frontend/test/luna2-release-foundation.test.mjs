import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('the personal Luna entry uses the existing chat and optional profile, without an AI avatar',()=>{
 const home=readFileSync('src/luna2/HomeDiscovery.tsx','utf8');
 assert.match(home,/Talk to Luna/);assert.match(home,/Поговорить с Luna/);
 assert.match(home,/onTalk/);assert.match(home,/onPersonalize/);assert.doesNotMatch(home,/ai-avatar|generated-avatar/);
 const app=readFileSync('src/App.tsx','utf8');assert.match(app,/onPersonalize=\{featureFlags.personalization/);assert.match(app,/initialView=\{profileEntry\}/);
});
test('optional setup retains Skip, does not ask birth details before astrology, and preserves edits across language switches',()=>{
 const setup=readFileSync('src/luna2/PersonalizationSettings.tsx','utf8');
 assert.match(setup,/What should Luna call you/);assert.match(setup,/Preferred language/);assert.match(setup,/What matters to you right now/);
 assert.match(setup,/Skip \/ return to Profile/);assert.match(setup,/!featureFlags.astrology&&featureFlags.personal_memory/);assert.match(setup,/Birth profiles are managed once in Astrology/);assert.match(setup,/\},\[initData\]\)/);
 assert.match(setup,/Birth details are excluded/);assert.doesNotMatch(setup,/telegram_id:/);
});
test('Luna 2.0 production profile checks exact SQL review hashes; the old profile stays default',()=>{
 const script=readFileSync('scripts/build-production.mjs','utf8');assert.match(script,/LUNA_RELEASE_PROFILE\?\?'tarot-phase2'/);assert.match(script,/LUNA_RELEASE_DB_REVIEW/);assert.match(script,/migrationHashes/);assert.match(script,/Migration changed since review/);
 const flags=readFileSync('src/config/featureFlagDefinitions.ts','utf8');assert.match(flags,/\?\? ''/);
});
test('Luna 2.3 memory release is explicit, backup-gated and cannot enable unfinished paid features',()=>{
 const script=readFileSync('scripts/build-production.mjs','utf8');
 assert.match(script,/\['luna23','luna24','luna25','luna251','luna30','luna31','luna32','luna33','luna34'\]\.includes\(capabilityProfile\)\?\['PERSONAL_MEMORY'\]/);
 assert.ok(script.includes("capabilityProfile=['luna35','luna40','luna41','luna42','luna43','intelligence','luna4-completion','luna5'].includes(profile)?'luna34':profile"));
 assert.ok(script.includes("['luna43','intelligence','luna4-completion','luna5'].includes(profile)?[]:['MOON_SEEDS_WALLET_V2','MOON_SEEDS_PURCHASES','TAROT_PAID_READINGS']"));
 assert.match(script,/verifyLunaIntelligenceReleaseEvidence/);
 assert.match(script,/if\(profile==='luna40'\)verifyLuna40ReleaseEvidence/);
 assert.match(script,/if\(profile==='luna35'\)verifyLuna35ReleaseEvidence/);
 assert.match(script,/review\.backupRestorePasses,2/);
 assert.match(script,/20261015032917_luna23_personal_memory\.sql/);
 for(const flag of ['TAROT_SPREADS','ASTROLOGY','MOON_SEEDS_PURCHASES','TAROT_PAID_READINGS','PREMIUM_V2'])assert.ok(script.includes("'"+flag+"'"));
 assert.match(script,/LUNA_RELEASE_PROFILE\?\?'tarot-phase2'/);
});
