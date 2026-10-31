import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import {importTypescript} from './import-typescript.mjs';

const ts = createRequire(import.meta.url)('typescript');
const src = path => readFileSync(resolve(process.cwd(), 'src', path), 'utf8');
async function module(path) {
  return importTypescript(resolve(process.cwd(),'src',path));
}
const nav = await module('navigation/navigationModel.ts');
const {breathPractices, breathPhaseAt} = await module('features/breathing/practices.ts');
const {breathVisualScale} = await module('features/breathing/visual.ts');
const {luna2Copy} = await module('luna2/copy.ts');
const app = src('App.tsx');
const styles = src('luna2/luna2.css');

test('Luna 2.5 keeps legacy five tabs and enables exactly three in approved order', () => {
  assert.deepEqual(nav.primaryNavigation(false).map(x => x.page), ['home','library','luna','progress','profile']);
  assert.deepEqual(nav.primaryNavigation(true).map(x => x.page), ['home','luna','profile']);
  for(const [locale,labels] of [['en',['Home','Luna AI','Profile']],['ru',['Главная','Луна ИИ','Профиль']]]) {
    assert.deepEqual(nav.primaryNavigation(true).map(x => luna2Copy[locale][x.labelKey]),labels);
  }
  assert.match(styles,/\.bottom-navigation-luna2 \.luna2-nav-ai/);
});

test('new route hierarchy and deep links fail closed without new_navigation', () => {
  for(const page of ['tarot','astrology','wallet','activity','achievements']) {
    assert.equal(nav.pageFromStartParam(page,false),'home');
    assert.equal(nav.pageFromStartParam(page,true),page);
  }
  assert.equal(nav.pageFromStartParam('explore',false),'library');
  assert.equal(nav.pageFromStartParam('explore',true),'home');
  assert.equal(nav.pageFromStartParam('library',true),'library');
  assert.equal(nav.pageFromStartParam('saved',true),'library');
  assert.equal(nav.fallbackPage('library',true),'home');
  for(const page of ['progress','moonGarden','wallet','activity','achievements','pricing']) assert.equal(nav.primaryParent(page,true),'profile');
  let state = nav.reduceRouteState({current:'home',trail:[]},{type:'navigate',page:'tarot'},true);
  state = nav.reduceRouteState(state,{type:'navigate',page:'library'},true);
  state = nav.reduceRouteState(state,{type:'navigate',page:'player'},true);
  for(const page of ['library','tarot','home']) { state=nav.reduceRouteState(state,{type:'back'},true); assert.equal(state.current,page); }
});

test('Explore contains only four categories and previews cannot perform paid or backend actions', () => {
  const explore=src('luna2/ExplorePage.tsx');
  assert.match(explore,/\['tarot', 'astrology', 'meditations', 'breathwork'\]/);
  assert.doesNotMatch(explore,/fetch\(|sendLunaMessage|createInvoiceLink|plantMoonGardenElement|Math\.random|new Date/);
  assert.match(explore,/data-feature-enabled=\{featureEnabled\}/);
  assert.match(app,/if \(kind === 'breathwork'\) openBreathCircle\(\)/);
  assert.match(app,/kind === 'meditations'.*setPage\('library'\)/);
});

test('Phase 2.1 uses original bundled illustrations without broken remote assets or distortion', () => {
  const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'public/images/explore/artwork-manifest.json'), 'utf8'));
  assert.equal(manifest.generator, 'Built-in image_gen');
  assert.equal(manifest.assets.length, 2);
  for (const asset of manifest.assets) {
    assert.equal(asset.externalStockAssets, false);
    assert.equal(asset.transparent, true);
    const bytes = readFileSync(resolve(process.cwd(), `public${asset.path}`));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(bytes.readUInt32BE(16), bytes.readUInt32BE(20));
    assert.ok(bytes.readUInt32BE(16) >= 1024);
    assert.equal(bytes[25], 6, 'PNG must preserve RGBA transparency');
    assert.ok(src('luna2/ExplorePage.tsx').includes(asset.path));
  }
  assert.match(styles, /\.luna2-celestial-art.*object-fit: contain/);
  assert.doesNotMatch(src('luna2/ExplorePage.tsx'), /<svg|hero-light\.png|https:\/\//);
  assert.doesNotMatch(src('luna2/ProfileOverview.tsx'), /hero-light\.png|https:\/\//);
});

test('Profile keeps the real balance in its account group and Garden in Wallet', () => {
  const profile = src('luna2/ProfileOverview.tsx');
  assert.match(profile, /profile-quiet-groups/);
  assert.doesNotMatch(profile, /premium-profile-stats/);
  assert.match(profile, /onWallet/);
  assert.doesNotMatch(profile, /luna2-garden-entry|premium-profile-link[^>]*onClick=\{onGarden\}/);
  assert.match(profile, /onJourney/);
  assert.match(styles, /\.luna2-wallet-copy > b.*overflow-wrap: anywhere/);
  assert.match(styles, /\.luna2-garden-entry img.*object-fit: cover/);
  assert.match(styles, /\.luna2-chat \.luna-live-empty::before.*pointer-events: none/);
});

test('Home preserves mood hero and recommendations while new dashboard is opt-in', () => {
  const home=src('v2/pages/HomeV2.tsx');
  assert.match(home, /props\.daily \|\| props\.newNavigation/);
  assert.match(home, /onMood=\{props\.setMood\}/);
  assert.match(home, /meditation=\{props\.daily\}/);
  assert.match(home, /props\.newNavigation && <HomeDiscovery/);
  assert.match(src('luna2/HomeDiscovery.tsx'),/aria-disabled=\{!tarotEnabled\}.*data-feature-flag="tarot_daily"/);
  assert.match(src('v2/components/V2Hero.tsx'), /dark: '\/images\/home\/hero-night.png'/);
  assert.match(src('v2/components/V2Hero.tsx'), /light: '\/images\/home\/hero-light.png'/);
  assert.match(styles, /:root\[data-theme="light"\] \.luna2-home \.home-v2-atmosphere-copy h1.*color: #20364c/);
});

test('Profile uses existing balances/history and has no local reward or charge mutations', () => {
  const profile=src('luna2/ProfileOverview.tsx');
  assert.match(profile,/profile\.moonSeedsAvailable \?\? profile\.moonSeeds/);
  assert.match(profile,/onMembership/);
  assert.match(profile,/onCosmos/);
  const cosmos=src('luna2/PersonalPortraitView.tsx');assert.match(cosmos,/CosmosJourney/);assert.match(cosmos,/ConfirmedDiscoveries/);
  const journal=src('luna2/JournalPage.tsx');for(const field of ['weeklyCheckins','meditation_id'])assert.ok(journal.includes(field));
  assert.doesNotMatch(profile,/localStorage|fetch\(|createInvoice|saveHistory|setProfile|moonSeeds\s*[+-]=/);
  assert.match(app,/showJourneyEntry && <ProfileOverview/);
});

test('AI starters use real app actions without sending or generating automatically', () => {
  const actions=src('luna2/LunaQuickActions.tsx');
  assert.equal((actions.match(/id: '/g)??[]).length,5);
  assert.equal((actions.match(/prompt: null/g)??[]).length,2);
  assert.match(actions,/disabled=\{disabled \|\| \(!prompt&&!openAction\)\}/);
  assert.match(actions,/Natal chart/);
  assert.match(actions,/luna-open-astrology/);
  assert.match(actions,/id:'compatibility'/);
  assert.match(actions,/id==='dream'\?onDream/);
  assert.match(actions,/id==='tarot'\?onTarot:undefined/);
  assert.doesNotMatch(actions,/sendLunaMessage|fetch\(|random/);
  assert.match(src('components/LunaChat.tsx'),/onPrompt=\{prompt=>/);
  assert.match(src('components/LunaChat.tsx'),/else void submit\(prompt\)/);
  assert.doesNotMatch(src('components/LunaChat.tsx'),/setDraft\(prompt\)/);
});

test('all nine breath rings interpolate continuously across phases and cycles', () => {
  assert.equal(breathPractices.length,9);
  for(const practice of breathPractices) {
    let elapsed=0;
    for(let i=0;i<practice.phases.length;i++) {
      const phase=practice.phases[i];
      const next=practice.phases[(i+1)%practice.phases.length];
      assert.ok(Math.abs(breathVisualScale(practice,phase.kind,1)-breathVisualScale(practice,next.kind,0))<1e-8,`${practice.id}: ${phase.kind} -> ${next.kind}`);
      const midpoint=breathPhaseAt(practice,elapsed+phase.seconds/2);
      assert.equal(midpoint.kind,phase.kind);
      assert.equal(midpoint.progress,.5);
      assert.equal(midpoint.remaining,Math.ceil(phase.seconds/2));
      const start=breathVisualScale(practice,phase.kind,0),end=breathVisualScale(practice,phase.kind,1);
      if(phase.kind==='inhale'||phase.kind==='inhale_top') assert.ok(end>start);
      if(phase.kind==='exhale') assert.ok(end<start);
      if(phase.kind==='hold'||phase.kind==='pause') assert.equal(end,start);
      elapsed+=phase.seconds;
    }
  }
});

test('breath visual respects reduced motion and keeps reward accounting untouched', () => {
  assert.match(styles,/@media \(prefers-reduced-motion: reduce\)[\s\S]*luna2-breath-ring.*transform: scale\(\.86\) !important; transition: none/);
  assert.doesNotMatch(src('luna2/BreathingVisual.tsx'),/setInterval|requestAnimationFrame|onComplete|fetch\(/);
  const session=src('features/breathing/BreathPracticeSession.tsx');
  assert.match(session,/Date\.now\(\) - startedAt/);
  assert.match(session,/onComplete\(mode,\s*durationSeconds,\s*completedBreaths,value.id\)/);
  assert.match(session,/startVerifiedBreath/);assert.match(session,/heartbeatVerifiedBreath/);
  assert.match(app,/<BreathPracticeSession/);
  assert.match(src('luna2/BreathingVisual.tsx'),/disabled=\{!featureEnabled\}/);
  assert.match(src('luna2/BreathingVisual.tsx'),/<AudioLines size=\{18\}/);
  assert.match(src('luna2/BreathingVisual.tsx'),/guidedAvailable=false/);
  assert.match(src('luna2/BreathingVisual.tsx'),/disabled=\{!featureEnabled\|\|!guidedAvailable\}/);
});

test('EN/RU strings cover every new screen and Light keeps its own blue visual palette', () => {
  assert.deepEqual(Object.keys(luna2Copy.en),Object.keys(luna2Copy.ru));
  for(const values of Object.values(luna2Copy)) for(const value of Object.values(values)) assert.ok(Array.isArray(value)?value.every(Boolean):value.length>0);
  assert.match(styles,/:root\[data-theme="light"\] \.luna2-breath-ring/);
  assert.match(styles,/\.luna2-breath-readout strong.*font-size: 54px/);
  assert.match(styles,/transition: transform 180ms linear/);
});

test('offline preview cannot use production backend, credentials, payments or rewards', () => {
  const preview=readFileSync(resolve(process.cwd(),'scripts/phase2-preview.mjs'),'utf8');
  assert.match(preview,/VITE_API_URL:''/);
  assert.match(preview,/VITE_BOT_USERNAME:''/);
  assert.match(preview,/const host=process.env.LUNA_PREVIEW_HOST==='0.0.0.0'\?'0.0.0.0':'127.0.0.1'/);
  assert.match(preview,/server\.listen\(port,host/);
  assert.match(preview,/connect-src 'self'; media-src 'self'/);
  assert.match(preview,/if\(req\.method!=='GET'\)return json\([\s\S]*501\)/);
  assert.doesNotMatch(preview,/SUPABASE_SERVICE_ROLE_KEY|BOT_TOKEN|OPENAI_API_KEY|fetch\(/);
});
