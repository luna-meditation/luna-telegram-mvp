import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
const progressSource = readFileSync(resolve(process.cwd(), 'src/components/progress/ProgressExperience.tsx'), 'utf8');
const progressCopySource = readFileSync(resolve(process.cwd(), 'src/components/progress/progressCopy.ts'), 'utf8');
const stylesSource = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

test('Progress uses the narrative experience instead of the legacy metric dashboard', () => {
  const progressPage = appSource.slice(appSource.indexOf('function ProgressPage'), appSource.indexOf('function PageSkeleton'));
  assert.match(progressPage, /<ProgressExperience/);
  assert.doesNotMatch(progressPage, /ProgressMetricCard|Week Progress|Completed Weeks|Longest Streak/);
  assert.doesNotMatch(appSource, /function ProgressMetricCard|function HeroProgressCard|function WeeklySummaryCard/);
});

test('Progress story follows rhythm, reflection, week, mood, patterns, garden, achievements, and next step', () => {
  for (const component of [
    'CurrentRhythmHero',
    'LunasReflection',
    'ThisWeek',
    'MoodJourney',
    'PersonalPatterns',
    'GardenStory',
    'AchievementsStory',
    'NextGentleStep'
  ]) {
    assert.match(progressSource, new RegExp(`<${component}`));
  }
});

test('Progress insights and emotional curves use real profile data with safe empty states', () => {
  assert.match(progressSource, /profile\?\.progressInsights/);
  assert.match(progressSource, /profile\?\.moodTrend/);
  assert.match(progressSource, /profile\?\.currentWeek/);
  assert.match(progressSource, /profile\?\.previousWeek/);
  assert.match(progressSource, /sleepRange/);
  assert.match(progressSource, /listeningMinutes/);
  assert.doesNotMatch(progressSource, /calm score has improved|stress reduced|meditation appears to improve/i);
  assert.doesNotMatch(progressSource, /moodScore|calmSignal|stressSignal/);
});

test('Progress experience has complete English and Russian primary copy', () => {
  for (const text of [
    'Your Progress',
    'Ваш прогресс',
    'Luna’s Reflection',
    'Наблюдение Луны',
    'This Week with Luna',
    'Эта неделя с Луной',
    'Next Gentle Step',
    'Следующий мягкий шаг'
  ]) {
    assert.match(progressCopySource, new RegExp(text));
  }
});

test('Mood days open a detail sheet and achievements open a filtered full view', () => {
  assert.match(progressSource, /setSelectedDay\(day\)/);
  assert.match(progressSource, /role="dialog"/);
  assert.match(progressSource, /createPortal/);
  assert.match(progressSource, /document\.body/);
  assert.match(progressSource, /statusFilter/);
  assert.match(progressSource, /categoryFilter/);
  assert.match(progressSource, /unlockedAt/);
});

test('Progress next step opens a catalog meditation directly', () => {
  assert.match(progressSource, /resolveProgressRecommendation/);
  assert.match(progressSource, /onOpenMeditation\(recommendation\.meditation\)/);
  assert.doesNotMatch(progressSource, /Choose a practice/);
});

test('Progress keeps seven Garden levels and mobile safe-area spacing', () => {
  assert.match(appSource, /Math\.max\(0, Math\.min\(gardenElements\.length, plantedCount\)\)/);
  assert.match(progressSource, /Math\.max\(0, Math\.min\(7, garden\.plantedCount\)\)/);
  assert.match(stylesSource, /progress-v4-page[\s\S]*safe-area-inset-bottom/);
  assert.match(stylesSource, /min-height: 44px/);
});
