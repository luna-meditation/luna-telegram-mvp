import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
const progressSource = readFileSync(resolve(process.cwd(), 'src/components/progress/ProgressExperience.tsx'), 'utf8');
const progressCopySource = readFileSync(resolve(process.cwd(), 'src/components/progress/progressCopy.ts'), 'utf8');
const stylesSource = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
const homeStyles = readFileSync(resolve(process.cwd(), 'src/v2/design-system/homeV2.css'), 'utf8');

test('Progress uses the narrative experience instead of the legacy metric dashboard', () => {
  const progressPage = appSource.slice(appSource.indexOf('function ProgressPage'), appSource.indexOf('function PageSkeleton'));
  assert.match(progressPage, /<ProgressExperience/);
  assert.doesNotMatch(progressPage, /ProgressMetricCard|Week Progress|Completed Weeks|Longest Streak/);
  assert.doesNotMatch(appSource, /function ProgressMetricCard|function HeroProgressCard|function WeeklySummaryCard/);
});

test('Journey story renders only streaks and achievements before the unified Garden', () => {
  const rendered = progressSource.slice(progressSource.indexOf('export function ProgressExperience('));
  assert.match(rendered, /<CurrentRhythmHero[\s\S]*<AchievementsStory/);
  for (const component of ['LunasReflection', 'ThisWeek', 'MoodJourney', 'PersonalPatterns', 'NextGentleStep']) {
    assert.doesNotMatch(rendered, new RegExp(`<${component}`));
  }
  assert.doesNotMatch(progressSource, /function GardenStory|<GardenStory/);
});

test('Current Rhythm uses real streak and active-day profile data', () => {
  assert.match(progressSource, /profile\?\.currentWeek/);
  assert.match(progressSource, /profile\?\.currentStreak/);
  assert.match(progressSource, /profile\?\.longestStreak/);
  assert.match(progressSource, /week\.activeDays \?\? week\.completedDays/);
  assert.match(progressSource, /day\.hasVerifiedPractice/);
  assert.match(progressSource, /day\.hasCheckin/);
  assert.match(progressSource, /\+1 Moon Seed each active day/);
});

test('Progress experience has complete English and Russian primary copy', () => {
  for (const text of [
    'Your Journey',
    'Ваш путь',
    "journeyTab: 'Journey'",
    "journeyTab: 'Путь'",
    "achievements: 'Achievements'",
    "achievements: 'Достижения'",
    "moonGarden: 'Moon Garden'",
    "moonGarden: 'Лунный сад'"
  ]) {
    assert.match(progressCopySource, new RegExp(text));
  }
});

test('Achievements open a filtered full icon view', () => {
  assert.match(progressSource, /role="dialog"/);
  assert.match(progressSource, /createPortal/);
  assert.match(progressSource, /document\.body/);
  assert.match(progressSource, /statusFilter/);
  assert.match(progressSource, /categoryFilter/);
  assert.match(progressSource, /unlockedAt/);
  assert.match(progressSource, /aria-label={`\$\{item\.title\}\. \$\{item\.description\}`}/);
});

test('Journey shows a six-icon achievement preview and uses one shared bottom inset', () => {
  const progressPageStyles = stylesSource.match(/\.progress-v4-page\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(progressSource, /Number\(right\.unlocked\) - Number\(left\.unlocked\)/);
  assert.match(progressSource, /\.slice\(0, 6\)/);
  assert.match(progressSource, /item\.unlocked \? 'is-unlocked' : 'is-locked'/);
  assert.match(stylesSource, /\.progress-v4-achievement-grid[\s\S]*grid-template-columns: repeat\(3/);
  assert.match(stylesSource, /\.progress-v4-achievements-list[\s\S]*grid-template-columns: repeat\(3/);
  assert.match(progressSource, /const journeyItems = items/);
  assert.match(progressPageStyles, /padding-bottom:\s*0/);
  assert.doesNotMatch(progressPageStyles, /safe-area-inset-bottom/);
});

test('Journey factual typography follows the Home Inter system', () => {
  assert.match(homeStyles, /font-family: var\(--font-sans\)/);
  assert.match(stylesSource, /\.journey-hub \.progress-v3-section-heading h3/);
  assert.match(stylesSource, /\.progress-v4-achievement-copy h4[^}]*font-family: var\(--font-sans\)/s);
});

test('Garden progression remains clamped to levels zero through seven', () => {
  assert.match(appSource, /Math\.max\(0, Math\.min\(gardenElements\.length, plantedCount\)\)/);
  assert.match(appSource, /const plantedCount = Math\.min\(7, planted\.size\)/);
  assert.doesNotMatch(appSource, /Seasonal Gardens|Сезонные сады/);
  assert.match(stylesSource, /min-height: 44px/);
});
