import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
const progressSource = readFileSync(resolve(process.cwd(), 'src/components/progress/ProgressExperience.tsx'), 'utf8');
const progressCopySource = readFileSync(resolve(process.cwd(), 'src/components/progress/progressCopy.ts'), 'utf8');
const stylesSource = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
const patternsSource = readFileSync(resolve(process.cwd(), 'src/components/progress/progressPatterns.ts'), 'utf8');

test('Progress uses the narrative experience instead of the legacy metric dashboard', () => {
  const progressPage = appSource.slice(appSource.indexOf('function ProgressPage'), appSource.indexOf('function PageSkeleton'));
  assert.match(progressPage, /<ProgressExperience/);
  assert.doesNotMatch(progressPage, /ProgressMetricCard|Week Progress|Completed Weeks|Longest Streak/);
  assert.doesNotMatch(appSource, /function ProgressMetricCard|function HeroProgressCard|function WeeklySummaryCard/);
});

test('Journey story follows the approved order and does not duplicate Garden', () => {
  for (const component of [
    'CurrentRhythmHero',
    'LunasReflection',
    'ThisWeek',
    'MoodJourney',
    'PersonalPatterns',
    'AchievementsStory',
    'NextGentleStep'
  ]) {
    assert.match(progressSource, new RegExp(`<${component}`));
  }
  assert.doesNotMatch(progressSource, /function GardenStory|<GardenStory/);
  const order = ['<CurrentRhythmHero', '<LunasReflection', '<ThisWeek', '<MoodJourney', '<PersonalPatterns', '<AchievementsStory', '<NextGentleStep'];
  assert.deepEqual([...order].sort((left, right) => progressSource.indexOf(left) - progressSource.indexOf(right)), order);
});

test('Progress insights and emotional curves use real profile data with safe empty states', () => {
  assert.match(progressSource, /profile\?\.progressInsights/);
  assert.match(progressSource, /profile\?\.moodTrend/);
  assert.match(progressSource, /profile\?\.currentWeek/);
  assert.match(progressSource, /profile\?\.previousWeek/);
  assert.match(progressSource, /sleepRange/);
  assert.match(progressSource, /listeningMinutes/);
  assert.doesNotMatch(progressSource, /calm score has improved|stress reduced|meditation appears to improve/i);
  assert.doesNotMatch(progressSource, /moodScore|meditation reduced your anxiety/i);
  assert.match(progressSource, /wellbeingSignalsForCheckin/);
  assert.match(progressSource, /wellbeingSignalPath/);
});

test('Progress experience has complete English and Russian primary copy', () => {
  for (const text of [
    'Your Journey',
    'Ваш путь',
    "journeyTab: 'Journey'",
    "journeyTab: 'Путь'",
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
  assert.match(progressSource, /role="button"/);
  assert.match(progressSource, /wellbeingSignalPoint/);
});

test('Progress next step opens a catalog meditation directly', () => {
  assert.match(progressSource, /resolveProgressRecommendation/);
  assert.match(progressSource, /onOpenMeditation\(recommendation\.meditation\)/);
  assert.doesNotMatch(progressSource, /Choose a practice/);
});

test('Journey keeps a two-achievement preview and uses one shared bottom inset', () => {
  const progressPageStyles = stylesSource.match(/\.progress-v4-page\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(progressSource, /unlocked\.slice\(0, 2\)/);
  assert.match(progressPageStyles, /padding-bottom:\s*0/);
  assert.doesNotMatch(progressPageStyles, /safe-area-inset-bottom/);
});

test('Personal Patterns encode explicit minimum evidence thresholds', () => {
  assert.match(patternsSource, /preferredTimeSessions:\s*5/);
  assert.match(patternsSource, /preferredTimeDays:\s*3/);
  assert.match(patternsSource, /familiarCategoryCompletions:\s*3/);
  assert.match(patternsSource, /strongestWeekdayWeeks:\s*2/);
  assert.match(progressCopySource, /Luna is still learning your rhythm/);
  assert.match(progressCopySource, /Луна пока изучает ваш ритм/);
});

test('Garden progression remains clamped to levels zero through seven', () => {
  assert.match(appSource, /Math\.max\(0, Math\.min\(gardenElements\.length, plantedCount\)\)/);
  assert.match(appSource, /const plantedCount = Math\.min\(7, planted\.size\)/);
  assert.doesNotMatch(appSource, /Seasonal Gardens|Сезонные сады/);
  assert.match(stylesSource, /min-height: 44px/);
});
