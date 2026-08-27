import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
const hubSource = readFileSync(resolve(process.cwd(), 'src/components/journey/JourneyHub.tsx'), 'utf8');
const hubStyles = readFileSync(resolve(process.cwd(), 'src/components/journey/journeyHub.css'), 'utf8');
const navSource = readFileSync(resolve(process.cwd(), 'src/design-system/components/BottomNavigation.tsx'), 'utf8');
const primitiveStyles = readFileSync(resolve(process.cwd(), 'src/design-system/primitives.css'), 'utf8');
const homeStyles = readFileSync(resolve(process.cwd(), 'src/v2/design-system/homeV2.css'), 'utf8');

test('bottom navigation remains five items and labels Progress as Journey and Путь', () => {
  const pages = [...navSource.matchAll(/\{ page: '([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(pages, ['home', 'library', 'luna', 'progress', 'profile']);
  assert.match(appSource, /navProgress: 'Journey'/);
  assert.match(appSource, /navProgress: 'Путь'/);
  assert.doesNotMatch(navSource, /BarChart3/);
  assert.match(navSource, /Route/);
});

test('Journey Hub combines Journey and Garden into one continuous screen', () => {
  assert.match(hubSource, /\{journey\}/);
  assert.doesNotMatch(hubSource, /garden: ReactNode/);
  assert.doesNotMatch(hubSource, /<SegmentedTabs|onTabChange|activeTab/);
  assert.doesNotMatch(hubSource, /V2BottomNav/);
  assert.match(appSource, /<JourneyHub[\s\S]*journey=\{\([\s\S]*<ProgressPage[\s\S]*garden=\{\([\s\S]*<MoonGardenPage/);
});

test('Journey is the default route and legacy Garden links open the same unified screen', () => {
  assert.match(appSource, /normalized === 'journey'\) return 'progress'/);
  assert.match(appSource, /normalized === 'garden'\) return 'moonGarden'/);
  assert.match(appSource, /normalized === 'moon-garden'\) return 'moonGarden'/);
  assert.match(appSource, /\(page === 'progress' \|\| page === 'moonGarden'\)/);
  assert.doesNotMatch(appSource, /onTabChange=\{\(tab\) => setPage/);
});

test('unified Journey uses one natural page scroll without tab scroll bookkeeping', () => {
  assert.match(appSource, /app-root overflow-x-clip bg-night/);
  assert.doesNotMatch(appSource, /journeyScrollPositionsRef|JourneyHubTab/);
  assert.doesNotMatch(hubSource, /scrollPositions|window\.scrollTo/);
});

test('Garden entry is restrained, reduced-motion aware, and never crops stage artwork', () => {
  assert.match(hubStyles, /journeyGardenEnter 680ms/);
  assert.match(hubStyles, /prefers-reduced-motion: reduce/);
  assert.match(hubStyles, /object-fit: contain/);
  assert.doesNotMatch(hubStyles, /object-fit: cover/);
  assert.doesNotMatch(hubStyles, /aspect-ratio: 10 \/ 11\.2/);
});

test('Journey removes nested tabs while preserving shared design-system primitives', () => {
  assert.doesNotMatch(hubStyles, /\.journey-hub-tabs/);
  assert.match(hubStyles, /\.journey-hub-content/);
  assert.match(hubStyles, /\.journey-hub-garden/);
  assert.match(primitiveStyles, /\.segmented-tabs/);
});

test('Journey reuses Home typography and surface tokens without loading another font', () => {
  for (const token of ['--v2-surface', '--v2-line', '--v2-ivory', '--v2-muted', '--v2-violet', '--v2-gold']) {
    assert.match(homeStyles, new RegExp(token));
    assert.match(hubStyles, new RegExp(token));
  }
  assert.match(hubStyles, /font-family: var\(--font-sans\)/);
  assert.doesNotMatch(hubStyles, /@import|fonts\.googleapis/);
});

test('stale profiles cannot render a fresh-looking zero week beside cached lifetime data', () => {
  assert.match(appSource, /hasFreshJourneySummary/);
  assert.match(appSource, /profile\?\.currentWeek/);
  assert.match(appSource, /profile\.currentWeek\.weekStart === currentLocalWeekStart\(\)/);
  assert.match(appSource, /journeySummaryRefreshing/);
  assert.match(appSource.slice(appSource.indexOf('function ProgressPage'), appSource.indexOf('function PageSkeleton')), /if \(loading\) \{\s*return <ProgressExperienceSkeleton/);
  assert.doesNotMatch(appSource.slice(appSource.indexOf('function ProgressPage'), appSource.indexOf('function PageSkeleton')), /profile\.progressInsights|profile\.moodTrend|profile\.lifetimeStats/);
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

test('Garden keeps one compact upgrade action and moves all eight stages behind a detail action', () => {
  const gardenPage = appSource.slice(appSource.indexOf('function MoonGardenPage'), appSource.indexOf('function resizeAvatarImage'));
  assert.match(gardenPage, /journey-garden-next-row/);
  assert.match(gardenPage, /journey-garden-journey-link/);
  assert.match(gardenPage, /journey-garden-sheet/);
  assert.doesNotMatch(gardenPage, /gardenElements\.map\(/);
  assert.match(gardenPage, /plantedCount}\/7 upgrades/);
  assert.doesNotMatch(gardenPage, /journey-garden-milestones/);
});

test('Journey and Garden share one comfortable bottom clearance above navigation', () => {
  const hub = hubStyles.match(/\.journey-hub\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(hub, /padding:\s*6px 0 24px/);
  assert.match(primitiveStyles, /padding: var\(--app-top-padding\) var\(--page-gutter\) var\(--app-content-bottom\)/);
});

test('Journey diagnostics remain behind the real admin authorization branch', () => {
  assert.match(appSource, /isAdmin=\{adminStatus === 'allowed'\}/);
  const progressSource = readFileSync(resolve(process.cwd(), 'src/components/progress/ProgressExperience.tsx'), 'utf8');
  assert.match(progressSource, /\{import\.meta\.env\.DEV && isAdmin && <ProgressDiagnostics/);
  assert.match(appSource, /\{import\.meta\.env\.DEV && isAdmin && \(/);
});

test('all approved Moon Garden PNGs keep their original portrait dimensions', () => {
  for (let level = 0; level <= 7; level += 1) {
    const match = appSource.match(new RegExp(`level: ${level},[\\s\\S]*?path: '([^']+)'`));
    assert.ok(match, `missing stage ${level}`);
    const png = readFileSync(resolve(process.cwd(), `public${match[1]}`));
    const dimensions = [png.readUInt32BE(16), png.readUInt32BE(20)];
    assert.deepEqual(dimensions, level === 6 ? [936, 1680] : [941, 1672]);
  }
});
