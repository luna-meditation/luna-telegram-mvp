import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
const hubSource = readFileSync(resolve(process.cwd(), 'src/components/journey/JourneyHub.tsx'), 'utf8');
const hubStyles = readFileSync(resolve(process.cwd(), 'src/components/journey/journeyHub.css'), 'utf8');
const navSource = readFileSync(resolve(process.cwd(), 'src/v2/components/V2BottomNav.tsx'), 'utf8');
const homeStyles = readFileSync(resolve(process.cwd(), 'src/v2/design-system/homeV2.css'), 'utf8');

test('bottom navigation remains five items and labels Progress as Journey and Путь', () => {
  const pages = [...navSource.matchAll(/\{ page: '([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(pages, ['home', 'library', 'luna', 'progress', 'profile']);
  assert.match(appSource, /navProgress: 'Journey'/);
  assert.match(appSource, /navProgress: 'Путь'/);
  assert.doesNotMatch(navSource, /BarChart3/);
  assert.match(navSource, /Route/);
});

test('Journey Hub switches locally between Journey and Garden without nested navigation', () => {
  assert.match(hubSource, /activeTab === 'journey' \? journey : garden/);
  assert.match(hubSource, /role="tablist"/);
  assert.match(hubSource, /onTabChange\(nextTab\)/);
  assert.doesNotMatch(hubSource, /V2BottomNav/);
  assert.match(appSource, /activeTab=\{page === 'moonGarden' \? 'garden' : 'journey'\}/);
});

test('Journey is the default direct tab and Garden supports direct startapp navigation', () => {
  assert.match(appSource, /normalized === 'journey'\) return 'progress'/);
  assert.match(appSource, /normalized === 'garden'\) return 'moonGarden'/);
  assert.match(appSource, /normalized === 'moon-garden'\) return 'moonGarden'/);
  assert.match(appSource, /onTabChange=\{\(tab\) => setPage\(tab === 'garden' \? 'moonGarden' : 'progress'\)\}/);
});

test('Journey and Garden preserve independent session scroll positions', () => {
  assert.match(appSource, /min-h-screen overflow-x-clip bg-night/);
  assert.doesNotMatch(appSource, /min-h-screen overflow-hidden bg-night/);
  assert.match(appSource, /journeyScrollPositionsRef = useRef<Record<JourneyHubTab, number>>\(\{ journey: 0, garden: 0 \}\)/);
  assert.match(hubSource, /scrollPositions\.current\[activeTab\] = window\.scrollY/);
  assert.match(hubSource, /window\.scrollTo\(\{ top: scrollPositions\.current\[activeTab\]/);
});

test('Garden entry is restrained, reduced-motion aware, and uses art-directed imagery', () => {
  assert.match(hubStyles, /journeyGardenEnter 680ms/);
  assert.match(hubStyles, /prefers-reduced-motion: reduce/);
  assert.match(hubStyles, /object-fit: cover/);
  assert.match(hubStyles, /object-position: 50% 10%/);
  assert.match(hubStyles, /aspect-ratio: 10 \/ 13\.8/);
});

test('Journey tabs scroll normally and use the compact Library-style pill treatment', () => {
  const tabs = hubStyles.match(/\.journey-hub-tabs\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(tabs, /position:\s*relative/);
  assert.doesNotMatch(tabs, /sticky/);
  assert.doesNotMatch(tabs, /safe-area-inset-top/);
  assert.match(tabs, /border-radius:\s*999px/);
});

test('Journey reuses Home typography and surface tokens without loading another font', () => {
  for (const token of ['--v2-surface', '--v2-line', '--v2-ivory', '--v2-muted', '--v2-violet', '--v2-gold']) {
    assert.match(homeStyles, new RegExp(token));
    assert.match(hubStyles, new RegExp(token));
  }
  assert.match(hubStyles, /font-family: Inter/);
  assert.doesNotMatch(hubStyles, /@import|fonts\.googleapis/);
});

test('stale profiles cannot render a fresh-looking zero week beside cached lifetime data', () => {
  assert.match(appSource, /hasFreshJourneySummary/);
  assert.match(appSource, /profile\?\.currentWeek/);
  assert.match(appSource, /profile\.currentWeek\.weekStart === currentLocalWeekStart\(\)/);
  assert.match(appSource, /journeySummaryRefreshing/);
  assert.match(appSource.slice(appSource.indexOf('function ProgressPage'), appSource.indexOf('function PageSkeleton')), /if \(loading\) \{\s*return <ProgressExperienceSkeleton/);
  assert.match(appSource, /profile\.progressInsights/);
  assert.doesNotMatch(appSource.slice(appSource.indexOf('function ProgressPage'), appSource.indexOf('function PageSkeleton')), /fallbackWeek/);
});

test('Garden has eight stages, seven approved upgrades, and no seasons', () => {
  const stageBlock = appSource.slice(appSource.indexOf('const gardenStages'), appSource.indexOf('function createSceneAudioUrl'));
  const elementBlock = appSource.slice(appSource.indexOf('const gardenElements'), appSource.indexOf('const gardenStages'));
  assert.equal([...stageBlock.matchAll(/level:\s*[0-7],/g)].length, 8);
  assert.equal([...elementBlock.matchAll(/cost:\s*10,/g)].length, 7);
  assert.doesNotMatch(stageBlock, /level:\s*8/);
  assert.doesNotMatch(appSource, /gardenCollections/);
});

test('Garden uses one contextual upgrade card instead of repeating seven vertical upgrade rows', () => {
  const gardenPage = appSource.slice(appSource.indexOf('function MoonGardenPage'), appSource.indexOf('function resizeAvatarImage'));
  assert.match(gardenPage, /journey-garden-next-card/);
  assert.match(gardenPage, /journey-garden-stage-track/);
  assert.doesNotMatch(gardenPage, /gardenElements\.map\(/);
  assert.match(gardenPage, /plantedCount} \/ 7/);
  assert.match(gardenPage, /journey-garden-milestones/);
});

test('Journey and Garden share one comfortable bottom clearance above navigation', () => {
  const hub = hubStyles.match(/\.journey-hub\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(hub, /padding:\s*6px 0 24px/);
  assert.match(appSource, /pb-\[calc\(112px\+env\(safe-area-inset-bottom\)\)\]/);
});

test('Journey diagnostics remain behind the real admin authorization branch', () => {
  assert.match(appSource, /isAdmin=\{adminStatus === 'allowed'\}/);
  const progressSource = readFileSync(resolve(process.cwd(), 'src/components/progress/ProgressExperience.tsx'), 'utf8');
  assert.match(progressSource, /\{isAdmin && <ProgressDiagnostics/);
  assert.match(appSource, /\{isAdmin && \(/);
});
