import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
const progressSource = readFileSync(resolve(process.cwd(), 'src/components/progress/ProgressExperience.tsx'), 'utf8');

test('Progress uses the narrative experience instead of the legacy metric dashboard', () => {
  const progressPage = appSource.slice(appSource.indexOf('function ProgressPage'), appSource.indexOf('function PageSkeleton'));
  assert.match(progressPage, /<ProgressExperience/);
  assert.doesNotMatch(progressPage, /ProgressMetricCard|Week Progress|Completed Weeks|Longest Streak/);
  assert.doesNotMatch(appSource, /function ProgressMetricCard|function HeroProgressCard|function WeeklySummaryCard/);
});

test('Progress story includes rhythm, reflection, garden, journey, insights, weekly letter, next step, and achievements', () => {
  for (const component of [
    'CurrentRhythmHero',
    'TodayReflection',
    'GardenStory',
    'EmotionalJourney',
    'PersonalInsights',
    'WeeklyLetter',
    'NextStepCard',
    'AchievementsStory'
  ]) {
    assert.match(progressSource, new RegExp(`<${component}`));
  }
});

test('Progress insights and emotional curves use real profile data with safe empty states', () => {
  assert.match(progressSource, /profile\?\.progressInsights/);
  assert.match(progressSource, /profile\?\.moodTrend/);
  assert.match(progressSource, /profile\?\.currentWeek/);
  assert.match(progressSource, /sleepRange/);
  assert.match(progressSource, /Complete a few practices/);
  assert.doesNotMatch(progressSource, /calm score has improved|stress reduced|meditation appears to improve/i);
});

test('Progress experience has complete English and Russian primary copy', () => {
  for (const text of [
    'Your Progress',
    'Твой прогресс',
    'Today’s Reflection',
    'Сегодняшнее отражение',
    'Your Week With Luna',
    'Твоя неделя с Luna',
    'Next Gentle Step',
    'Следующий мягкий шаг'
  ]) {
    assert.match(progressSource, new RegExp(text));
  }
});
