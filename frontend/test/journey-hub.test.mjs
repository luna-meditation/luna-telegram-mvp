import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
const hubSource = readFileSync(resolve(process.cwd(), 'src/components/journey/JourneyHub.tsx'), 'utf8');
const hubStyles = readFileSync(resolve(process.cwd(), 'src/components/journey/journeyHub.css'), 'utf8');
const navSource = readFileSync(resolve(process.cwd(), 'src/v2/components/V2BottomNav.tsx'), 'utf8');

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
  assert.match(hubStyles, /aspect-ratio: 4 \/ 5/);
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

test('Journey diagnostics remain behind the real admin authorization branch', () => {
  assert.match(appSource, /isAdmin=\{adminStatus === 'allowed'\}/);
  const progressSource = readFileSync(resolve(process.cwd(), 'src/components/progress/ProgressExperience.tsx'), 'utf8');
  assert.match(progressSource, /\{isAdmin && <ProgressDiagnostics/);
  assert.match(appSource, /\{isAdmin && \(/);
});
