import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const app=readFileSync('src/App.tsx','utf8');
test('new Journey contains compact progress and links, not an embedded garden',()=>{
 const compact=readFileSync('src/components/journey/CompactJourney.tsx','utf8');
 assert.match(compact,/JourneyStatusHero/);assert.match(compact,/currentStreak/);assert.match(compact,/slice\(0,3\)/);assert.match(compact,/onGarden/);assert.match(compact,/onAchievements/);assert.doesNotMatch(compact,/MoonGardenScene|MoonGardenPage/);
 assert.match(app,/featureFlags.new_navigation && !accountLoading && !accountUnavailable \? <CompactJourney/);
});
test('garden shop uses existing stage assets and authoritative responses only',()=>{
 assert.match(app,/garden-upgrade-rail/);assert.match(app,/gardenStages\[index\+1\]\.path/);assert.match(app,/planted\.has\(previewUpgrade.id\)/);assert.match(app,/disabled=\{Boolean\(workingId\)\|\|seeds<previewUpgrade.cost\}/);
 const plant=app.split('const plant = async')[1].split('const runDevAction')[0];
 assert.doesNotMatch(plant,/moonSeeds: seeds -|moonSeedsAvailable: seeds -/);assert.match(plant,/purchasePending.current = true/);assert.match(plant,/setLiveProfile\(nextProfile\)/);
});
