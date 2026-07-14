import { useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Flower2,
  Leaf,
  LockKeyhole,
  Moon,
  Snowflake,
  Sparkles,
  Sprout
} from 'lucide-react';
import type { AppLanguage, DailyCheckin, ProfileStats, WellnessSummary } from '../../api';

export type ProgressAchievement = {
  id: string;
  title: string;
  description: string;
  category: string;
  unlocked: boolean;
  progress?: number;
};

export type ProgressGarden = {
  level: number;
  title: string;
  image: string;
  seeds: number;
  plantedCount: number;
  totalElements: number;
};

type WeeklyDayState = 'completed' | 'current' | 'missed' | 'future' | 'freeze_used' | 'premium_freeze';
type WeeklyDay = {
  key: string;
  label: string;
  shortLabel: string;
  state: WeeklyDayState;
  minutes: number;
};

type WeeklyRhythm = {
  days: WeeklyDay[];
  freezeCount: number;
  maxFreezes: number;
  completedDays: number;
};

type Copy = {
  progress: string;
  subtitle: string;
  currentRhythm: string;
  keepRhythm: string;
  day: string;
  days: string;
  freeze: string;
  todayReflection: string;
  moonGarden: string;
  gardenSubtitle: string;
  level: string;
  moonSeeds: string;
  plantsGrown: string;
  gardenEvolution: string;
  visitGarden: string;
  emotionalJourney: string;
  emotionalSubtitle: string;
  calmSignal: string;
  stressSignal: string;
  sleepQuality: string;
  personalInsights: string;
  personalSubtitle: string;
  monthlyRhythm: string;
  averageSession: string;
  favoriteTime: string;
  yourWeek: string;
  nextStep: string;
  achievements: string;
  achievementsSubtitle: string;
  viewAll: string;
  showFeatured: string;
  unlocked: string;
  locked: string;
  openLibrary: string;
  min: string;
  noPattern: string;
};

const progressCopy: Record<AppLanguage, Copy> = {
  en: {
    progress: 'Your Progress',
    subtitle: 'A quieter mind grows one return at a time.',
    currentRhythm: 'Current Rhythm',
    keepRhythm: 'Keep your rhythm alive.',
    day: 'day',
    days: 'days',
    freeze: 'Freeze',
    todayReflection: 'Today’s Reflection',
    moonGarden: 'Moon Garden',
    gardenSubtitle: 'Your calm is becoming a place you can see.',
    level: 'Garden level',
    moonSeeds: 'Moon Seeds',
    plantsGrown: 'Plants grown',
    gardenEvolution: 'Garden evolution',
    visitGarden: 'Visit Moon Garden',
    emotionalJourney: 'Emotional Journey',
    emotionalSubtitle: 'A gentle view of the states you shared this week.',
    calmSignal: 'Calm signal',
    stressSignal: 'Stress signal',
    sleepQuality: 'Sleep quality',
    personalInsights: 'Personal Insights',
    personalSubtitle: 'Patterns Luna can see in your real practice history.',
    monthlyRhythm: 'Monthly rhythm',
    averageSession: 'Average session',
    favoriteTime: 'Favorite time',
    yourWeek: 'Your Week With Luna',
    nextStep: 'Next Gentle Step',
    achievements: 'Achievements',
    achievementsSubtitle: 'A few quiet milestones from your journey.',
    viewAll: 'View all',
    showFeatured: 'Show featured',
    unlocked: 'Unlocked',
    locked: 'Still growing',
    openLibrary: 'Choose a practice',
    min: 'min',
    noPattern: 'Still taking shape'
  },
  ru: {
    progress: 'Твой прогресс',
    subtitle: 'Спокойствие растёт с каждым мягким возвращением.',
    currentRhythm: 'Текущий ритм',
    keepRhythm: 'Береги свой мягкий ритм.',
    day: 'день',
    days: 'дней',
    freeze: 'Заморозка',
    todayReflection: 'Сегодняшнее отражение',
    moonGarden: 'Лунный сад',
    gardenSubtitle: 'Твоё спокойствие становится местом, которое можно увидеть.',
    level: 'Уровень сада',
    moonSeeds: 'Лунные семена',
    plantsGrown: 'Выращено',
    gardenEvolution: 'Рост сада',
    visitGarden: 'Открыть Лунный сад',
    emotionalJourney: 'Эмоциональный путь',
    emotionalSubtitle: 'Мягкий взгляд на состояния, которыми ты делился на этой неделе.',
    calmSignal: 'Сигнал спокойствия',
    stressSignal: 'Сигнал напряжения',
    sleepQuality: 'Качество сна',
    personalInsights: 'Личные наблюдения',
    personalSubtitle: 'Закономерности, которые Luna видит в реальной истории практики.',
    monthlyRhythm: 'Ритм месяца',
    averageSession: 'Средняя сессия',
    favoriteTime: 'Любимое время',
    yourWeek: 'Твоя неделя с Luna',
    nextStep: 'Следующий мягкий шаг',
    achievements: 'Достижения',
    achievementsSubtitle: 'Несколько тихих вех твоего пути.',
    viewAll: 'Показать все',
    showFeatured: 'Свернуть',
    unlocked: 'Открыто',
    locked: 'Ещё растёт',
    openLibrary: 'Выбрать практику',
    min: 'мин',
    noPattern: 'Пока формируется'
  }
};

const moodScore: Record<DailyCheckin['mood'], number> = {
  stressed: 18,
  anxious: 26,
  low_energy: 38,
  tired: 44,
  focused: 72,
  calm: 86
};

function sleepScore(value: DailyCheckin['sleep_range'] | undefined) {
  if (value === 'less_than_4') return 26;
  if (value === '4_6') return 48;
  if (value === '6_8') return 76;
  if (value === '8_plus') return 90;
  return null;
}

function moodLabel(value: DailyCheckin['mood'], language: AppLanguage) {
  const labels: Record<DailyCheckin['mood'], Record<AppLanguage, string>> = {
    calm: { en: 'Calm', ru: 'Спокойно' },
    stressed: { en: 'Stressed', ru: 'Стресс' },
    tired: { en: 'Tired', ru: 'Усталость' },
    anxious: { en: 'Anxious', ru: 'Тревожно' },
    focused: { en: 'Focused', ru: 'Фокус' },
    low_energy: { en: 'Low energy', ru: 'Мало энергии' }
  };
  return labels[value][language];
}

function categoryLabel(value: string | null | undefined, language: AppLanguage) {
  if (!value) return null;
  const labels: Record<string, Record<AppLanguage, string>> = {
    sleep: { en: 'sleep', ru: 'сон' },
    focus: { en: 'focus', ru: 'фокус' },
    anxiety: { en: 'anxiety relief', ru: 'снижение тревоги' },
    breath: { en: 'breathing', ru: 'дыхание' },
    breathing: { en: 'breathing', ru: 'дыхание' },
    calm: { en: 'calm', ru: 'спокойствие' },
    morning: { en: 'morning clarity', ru: 'утренняя ясность' },
    evening: { en: 'evening calm', ru: 'вечернее спокойствие' },
    stress: { en: 'stress relief', ru: 'снижение стресса' }
  };
  return labels[value.toLowerCase()]?.[language] ?? value;
}

function practiceTimeLabel(value: ProfileStats['progressInsights'] extends infer T ? T extends { favoritePracticeTime: infer U } ? U : never : never, language: AppLanguage) {
  const labels = {
    morning: { en: 'Morning', ru: 'Утро' },
    afternoon: { en: 'Afternoon', ru: 'День' },
    evening: { en: 'Evening', ru: 'Вечер' },
    night: { en: 'Night', ru: 'Ночь' }
  } as const;
  return value ? labels[value][language] : null;
}

function weekdayLabel(value: number | null | undefined, language: AppLanguage) {
  if (value == null || value < 0 || value > 6) return null;
  const labels = language === 'en'
    ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    : ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
  return labels[value];
}

function buildWeeklyRhythm(profile: ProfileStats | null, language: AppLanguage): WeeklyRhythm {
  const maxFreezes = Math.max(1, Number(profile?.freezeMax ?? 1));
  const source = profile?.currentWeek?.days?.length === 7
    ? profile.currentWeek.days
    : (() => {
      const today = new Date();
      const dayIndex = (today.getDay() + 6) % 7;
      const monday = new Date(today);
      monday.setHours(12, 0, 0, 0);
      monday.setDate(today.getDate() - dayIndex);
      return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        return {
          key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
          label: '',
          state: (index < dayIndex ? 'missed' : index === dayIndex ? 'current' : 'future') as WeeklyDayState,
          minutes: 0,
          sessions: 0
        };
      });
    })();
  const days = source.map((day) => {
    const date = new Date(`${day.key}T12:00:00`);
    return {
      key: day.key,
      label: date.toLocaleDateString(language === 'en' ? 'en-US' : 'ru-RU', { weekday: 'long' }),
      shortLabel: date.toLocaleDateString(language === 'en' ? 'en-US' : 'ru-RU', { weekday: 'short' }).slice(0, 2),
      state: day.state,
      minutes: day.minutes
    };
  });
  return {
    days,
    freezeCount: Math.min(maxFreezes, Math.max(0, Number(profile?.freezeCount ?? maxFreezes))),
    maxFreezes,
    completedDays: profile?.currentWeek?.completedDays ?? days.filter((day) => day.state === 'completed').length
  };
}

function reflectionForToday(profile: ProfileStats | null, weekly: WeeklyRhythm, language: AppLanguage) {
  const streak = profile?.currentStreak ?? 0;
  const minutes = profile?.weeklyStats?.listeningMinutes ?? 0;
  const sessions = profile?.weeklyStats?.completedSessions ?? 0;
  const variant = Math.floor(Date.now() / 86_400_000) % 3;
  if (streak > 0) {
    const en = [
      `You have returned to your practice for ${streak} ${streak === 1 ? 'day' : 'days'}. The rhythm is becoming familiar.`,
      `${streak} quiet ${streak === 1 ? 'return is' : 'returns are'} already part of your rhythm. Nothing needs to be forced today.`,
      `You keep making room for calm. This ${streak}-day rhythm is something gentle worth protecting.`
    ];
    const ru = [
      `Ты возвращаешься к практике уже ${streak} ${streak === 1 ? 'день' : 'дней'}. Этот ритм становится знакомым.`,
      `${streak} тихих возвращений уже стали частью твоего ритма. Сегодня ничего не нужно делать через силу.`,
      `Ты продолжаешь находить место для спокойствия. Этот ритм длиной ${streak} дней стоит беречь мягко.`
    ];
    return (language === 'en' ? en : ru)[variant];
  }
  if (weekly.completedDays > 0 || sessions > 0) {
    return language === 'en'
      ? `You made space for yourself on ${weekly.completedDays || 1} ${weekly.completedDays === 1 ? 'day' : 'days'} this week. That return already matters.`
      : `На этой неделе ты нашёл время для себя ${weekly.completedDays || 1} ${weekly.completedDays === 1 ? 'день' : 'дня'}. Это возвращение уже имеет значение.`;
  }
  if (minutes > 0) {
    return language === 'en'
      ? `You gave yourself ${minutes} quiet minutes this week. A rhythm can begin without being perfect.`
      : `На этой неделе ты подарил себе ${minutes} тихих минут. Ритм может начаться без стремления к идеалу.`;
  }
  return language === 'en'
    ? 'Your progress does not begin with a number. It begins the moment you choose to return.'
    : 'Твой прогресс начинается не с числа, а с момента, когда ты решаешь вернуться к себе.';
}

function smoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const midX = (previous.x + point.x) / 2;
    const midY = (previous.y + point.y) / 2;
    return `${path} Q ${previous.x} ${previous.y}, ${midX} ${midY}`;
  }, `M ${points[0].x} ${points[0].y}`) + ` T ${points[points.length - 1]?.x ?? 0} ${points[points.length - 1]?.y ?? 0}`;
}

function chartPoints(values: Array<number | null>) {
  return values.flatMap((value, index) => value == null ? [] : [{
    x: 18 + index * (284 / Math.max(1, values.length - 1)),
    y: 104 - value * 0.82
  }]);
}

function emotionalSummary(profile: ProfileStats | null, language: AppLanguage) {
  const moods = (profile?.moodTrend ?? []).filter((item): item is typeof item & { mood: DailyCheckin['mood'] } => Boolean(item.mood));
  if (moods.length < 2) {
    return language === 'en'
      ? 'A few more check-ins will reveal how your emotional rhythm changes.'
      : 'Ещё несколько чек-инов помогут увидеть, как меняется твой эмоциональный ритм.';
  }
  const first = moods[0].mood;
  const last = moods[moods.length - 1]?.mood ?? first;
  if (moodScore[last] > moodScore[first] + 8) {
    return language === 'en'
      ? `Your check-ins moved from ${moodLabel(first, language)} toward ${moodLabel(last, language)} this week.`
      : `На этой неделе чек-ины изменились от состояния «${moodLabel(first, language)}» к «${moodLabel(last, language)}».`;
  }
  if (moodScore[last] < moodScore[first] - 8) {
    return language === 'en'
      ? `Your latest check-in feels heavier than the start of the week. A shorter practice may fit better today.`
      : 'Последний чек-ин ощущается тяжелее, чем в начале недели. Сегодня может подойти более короткая практика.';
  }
  return language === 'en'
    ? 'Your recent check-ins stayed relatively steady. Consistency can be quiet, too.'
    : 'Последние чек-ины были довольно ровными. Стабильность тоже может быть тихой.';
}

function personalInsightLines(profile: ProfileStats | null, language: AppLanguage) {
  const insight = profile?.progressInsights;
  if (!insight) return [];
  const lines: string[] = [];
  const time = practiceTimeLabel(insight.favoritePracticeTime, language);
  const category = categoryLabel(insight.favoriteCategory, language);
  const weekday = weekdayLabel(insight.bestPracticeWeekday, language);
  if (time) lines.push(language === 'en' ? `${time} is when you return to Luna most often.` : `${time} — время, когда ты чаще всего возвращаешься к Luna.`);
  if (category) lines.push(language === 'en' ? `${category[0].toUpperCase()}${category.slice(1)} is becoming your most familiar kind of practice.` : `Практики на тему «${category}» ты выбираешь чаще всего.`);
  if (weekday) lines.push(language === 'en' ? `${weekday} carries the strongest practice rhythm in your history.` : `Самый устойчивый ритм практики обычно приходится на ${weekday}.`);
  if (insight.averageSessionMinutes > 0) lines.push(language === 'en'
    ? `Your average completed practice lasts ${insight.averageSessionMinutes} minutes.`
    : `Средняя завершённая практика длится ${insight.averageSessionMinutes} мин.`);
  return lines.slice(0, 3);
}

function nextGentleStep(profile: ProfileStats | null, wellness: WellnessSummary | null, weekly: WeeklyRhythm, language: AppLanguage) {
  const today = weekly.days.find((day) => day.state === 'current' || day.key === new Date().toISOString().slice(0, 10));
  const latestMood = [...(profile?.moodTrend ?? [])].reverse().find((item) => item.mood)?.mood ?? wellness?.todayCheckin?.mood ?? null;
  if (today?.state === 'completed') {
    return {
      title: language === 'en' ? 'Let today’s practice settle.' : 'Позволь сегодняшней практике улечься.',
      body: language === 'en' ? 'Your rhythm is protected. Visit the garden and notice what has grown.' : 'Твой ритм сохранён. Загляни в сад и заметь, что уже выросло.',
      action: 'garden' as const
    };
  }
  if (latestMood === 'anxious' || latestMood === 'stressed') {
    return {
      title: language === 'en' ? 'Choose one short breathing practice.' : 'Выбери одну короткую дыхательную практику.',
      body: language === 'en' ? 'A small reset fits the state you shared most recently.' : 'Небольшая перезагрузка подходит состоянию из последнего чек-ина.',
      action: 'library' as const
    };
  }
  if (latestMood === 'tired' || latestMood === 'low_energy') {
    return {
      title: language === 'en' ? 'Keep tonight gentle.' : 'Пусть этот вечер будет мягким.',
      body: language === 'en' ? 'A short sleep or letting-go practice may fit better than a long session.' : 'Короткая практика для сна или отпускания может подойти лучше долгой сессии.',
      action: 'library' as const
    };
  }
  if ((profile?.currentStreak ?? 0) > 0) {
    return {
      title: language === 'en' ? 'Protect your rhythm with one quiet return.' : 'Поддержи ритм одним тихим возвращением.',
      body: language === 'en' ? 'A few intentional minutes are enough for today.' : 'На сегодня достаточно нескольких осознанных минут.',
      action: 'library' as const
    };
  }
  return {
    title: language === 'en' ? 'Begin with three quiet minutes.' : 'Начни с трёх тихих минут.',
    body: language === 'en' ? 'The next chapter of your progress can start very small.' : 'Следующая глава твоего прогресса может начаться с малого.',
    action: 'library' as const
  };
}

function CurrentRhythmHero({ profile, weekly, language }: { profile: ProfileStats | null; weekly: WeeklyRhythm; language: AppLanguage }) {
  const t = progressCopy[language];
  const streak = profile?.currentStreak ?? 0;
  const ringProgress = Math.max(4, Math.min(100, (weekly.completedDays / 7) * 100));
  return (
    <section className="progress-v3-hero progress-v3-enter">
      <img src="/images/progress/progress-bg-01.webp" alt="" className="progress-v3-hero-image" />
      <div className="progress-v3-hero-shade" />
      <span className="progress-v3-moon-glow" aria-hidden="true" />
      <div className="progress-v3-hero-content">
        <div className="progress-v3-hero-topline">
          <div>
            <p className="progress-v3-eyebrow">{t.currentRhythm}</p>
            <p className="progress-v3-hero-note">{t.keepRhythm}</p>
          </div>
          <div className="progress-v3-freeze-pill">
            <Snowflake size={14} aria-hidden="true" />
            <span>{t.freeze}</span>
            <strong>{weekly.freezeCount}/{weekly.maxFreezes}</strong>
          </div>
        </div>

        <div className="progress-v3-rhythm-ring" style={{ '--ring-progress': `${ringProgress}` } as React.CSSProperties}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="52" className="progress-v3-ring-track" />
            <circle cx="60" cy="60" r="52" className="progress-v3-ring-value" pathLength="100" />
          </svg>
          <div>
            <strong>{streak}</strong>
            <span>{streak === 1 ? t.day : t.days}</span>
          </div>
        </div>

        <div className="progress-v3-week" aria-label={language === 'en' ? 'This week’s practice rhythm' : 'Ритм практики на этой неделе'}>
          {weekly.days.map((day) => (
            <div className="progress-v3-week-day" key={day.key} title={`${day.label}: ${day.minutes} ${t.min}`}>
              <span>{day.shortLabel}</span>
              <b className={`progress-v3-week-mark progress-v3-week-${day.state}`}>
                {day.state === 'completed' ? <Check size={15} /> : day.state === 'freeze_used' || day.state === 'premium_freeze' ? <Snowflake size={13} /> : null}
              </b>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TodayReflection({ profile, weekly, language }: { profile: ProfileStats | null; weekly: WeeklyRhythm; language: AppLanguage }) {
  const t = progressCopy[language];
  return (
    <section className="progress-v3-reflection progress-v3-enter">
      <div className="progress-v3-section-icon"><Sparkles size={17} /></div>
      <div>
        <p className="progress-v3-eyebrow">{t.todayReflection}</p>
        <p className="progress-v3-reflection-copy">{reflectionForToday(profile, weekly, language)}</p>
      </div>
    </section>
  );
}

function GardenStory({ garden, language, onOpen }: { garden: ProgressGarden; language: AppLanguage; onOpen: () => void }) {
  const t = progressCopy[language];
  const growth = Math.min(100, Math.round((garden.plantedCount / Math.max(1, garden.totalElements)) * 100));
  return (
    <section className="progress-v3-garden progress-v3-enter">
      <div className="progress-v3-section-heading">
        <div>
          <p className="progress-v3-eyebrow">{t.moonGarden}</p>
          <h3>{garden.title}</h3>
          <p>{t.gardenSubtitle}</p>
        </div>
        <Sprout size={22} aria-hidden="true" />
      </div>
      <button type="button" onClick={onOpen} className="progress-v3-garden-visual" aria-label={t.visitGarden}>
        <img src={garden.image} alt="" />
        <span className="progress-v3-garden-mist" aria-hidden="true" />
        <span className="progress-v3-garden-light progress-v3-garden-light-one" aria-hidden="true" />
        <span className="progress-v3-garden-light progress-v3-garden-light-two" aria-hidden="true" />
        <span className="progress-v3-garden-open">{t.visitGarden}<ChevronRight size={16} /></span>
      </button>
      <div className="progress-v3-garden-stats">
        <div><span>{t.level}</span><strong>{garden.level}</strong></div>
        <div><span>{t.moonSeeds}</span><strong>{garden.seeds}</strong></div>
        <div><span>{t.plantsGrown}</span><strong>{garden.plantedCount}</strong></div>
      </div>
      <div className="progress-v3-evolution">
        <div><span>{t.gardenEvolution}</span><strong>{growth}%</strong></div>
        <div className="progress-v3-evolution-track"><span style={{ width: `${growth}%` }} /></div>
      </div>
    </section>
  );
}

function EmotionalJourney({ profile, language }: { profile: ProfileStats | null; language: AppLanguage }) {
  const t = progressCopy[language];
  const trend = profile?.moodTrend ?? [];
  const calmValues = trend.map((item) => item.mood ? moodScore[item.mood] : null);
  const stressValues = trend.map((item) => item.mood ? 100 - moodScore[item.mood] : null);
  const sleepValues = trend.map((item) => sleepScore(item.sleepRange));
  const calmPoints = chartPoints(calmValues);
  const stressPoints = chartPoints(stressValues);
  const sleepPoints = chartPoints(sleepValues);
  const hasMood = calmPoints.length > 0;
  return (
    <section className="progress-v3-journey progress-v3-enter">
      <div className="progress-v3-section-heading">
        <div>
          <p className="progress-v3-eyebrow">{t.emotionalJourney}</p>
          <h3>{hasMood ? emotionalSummary(profile, language) : t.emotionalJourney}</h3>
          <p>{t.emotionalSubtitle}</p>
        </div>
        <Moon size={21} aria-hidden="true" />
      </div>
      <div className="progress-v3-chart" aria-label={t.emotionalJourney}>
        <svg viewBox="0 0 320 122" role="img">
          <defs>
            <linearGradient id="progressCalmLine" x1="0" x2="1">
              <stop offset="0%" stopColor="#8e77e9" />
              <stop offset="100%" stopColor="#f4d67a" />
            </linearGradient>
          </defs>
          {[28, 62, 96].map((y) => <line key={y} x1="12" x2="308" y1={y} y2={y} className="progress-v3-chart-grid" />)}
          {sleepPoints.length > 1 && <path d={smoothPath(sleepPoints)} className="progress-v3-chart-line progress-v3-chart-sleep" />}
          {stressPoints.length > 1 && <path d={smoothPath(stressPoints)} className="progress-v3-chart-line progress-v3-chart-stress" />}
          {calmPoints.length > 1 && <path d={smoothPath(calmPoints)} className="progress-v3-chart-line progress-v3-chart-calm" />}
          {calmPoints.map((point) => <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="3.5" className="progress-v3-chart-dot" />)}
        </svg>
        <div className="progress-v3-chart-labels">
          {trend.map((item) => <span key={item.key}>{new Date(`${item.key}T12:00:00`).toLocaleDateString(language === 'en' ? 'en-US' : 'ru-RU', { weekday: 'short' }).slice(0, 2)}</span>)}
        </div>
      </div>
      <div className="progress-v3-legend">
        <span><i className="progress-v3-legend-calm" />{t.calmSignal}</span>
        <span><i className="progress-v3-legend-stress" />{t.stressSignal}</span>
        {sleepPoints.length > 1 && <span><i className="progress-v3-legend-sleep" />{t.sleepQuality}</span>}
      </div>
      {!hasMood && <p className="progress-v3-empty-copy">{emotionalSummary(profile, language)}</p>}
    </section>
  );
}

function PersonalInsights({ profile, language }: { profile: ProfileStats | null; language: AppLanguage }) {
  const t = progressCopy[language];
  const insight = profile?.progressInsights;
  const lines = personalInsightLines(profile, language);
  const time = practiceTimeLabel(insight?.favoritePracticeTime ?? null, language);
  return (
    <section className="progress-v3-insights progress-v3-enter">
      <div className="progress-v3-section-heading">
        <div>
          <p className="progress-v3-eyebrow">{t.personalInsights}</p>
          <h3>{t.personalSubtitle}</h3>
        </div>
        <Leaf size={21} aria-hidden="true" />
      </div>
      <div className="progress-v3-signals">
        <div><CalendarDays size={16} /><span>{t.monthlyRhythm}</span><strong>{insight?.monthlyPracticeDays ?? 0} {language === 'en' ? 'days' : 'дн.'}</strong></div>
        <div><Clock3 size={16} /><span>{t.averageSession}</span><strong>{insight?.averageSessionMinutes ? `${insight.averageSessionMinutes} ${t.min}` : t.noPattern}</strong></div>
        <div><Moon size={16} /><span>{t.favoriteTime}</span><strong>{time ?? t.noPattern}</strong></div>
      </div>
      {lines.length ? (
        <div className="progress-v3-observations">
          {lines.map((line, index) => <p key={line}><span>{String(index + 1).padStart(2, '0')}</span>{line}</p>)}
        </div>
      ) : (
        <p className="progress-v3-empty-copy">{language === 'en' ? 'Complete a few practices and Luna will begin to notice your natural rhythm.' : 'Заверши несколько практик, и Luna начнёт замечать твой естественный ритм.'}</p>
      )}
    </section>
  );
}

function WeeklyLetter({ profile, language, nextStep }: { profile: ProfileStats | null; language: AppLanguage; nextStep: ReturnType<typeof nextGentleStep> }) {
  const t = progressCopy[language];
  const stats = profile?.weeklyStats;
  const days = stats?.completedDays ?? 0;
  const minutes = stats?.listeningMinutes ?? 0;
  const sessions = stats?.completedSessions ?? 0;
  const favorite = profile?.progressInsights?.favoriteMeditationTitle;
  const practiceTime = practiceTimeLabel(profile?.progressInsights?.favoritePracticeTime ?? null, language);
  return (
    <section className="progress-v3-letter progress-v3-enter">
      <div className="progress-v3-letter-mark"><Moon size={18} /></div>
      <p className="progress-v3-eyebrow">{t.yourWeek}</p>
      <p className="progress-v3-letter-lead">
        {sessions || minutes || days
          ? (language === 'en'
            ? `You completed ${sessions} ${sessions === 1 ? 'practice' : 'practices'} across ${days} ${days === 1 ? 'day' : 'days'}, with ${minutes} minutes of listening.`
            : `Ты завершил ${sessions} ${sessions === 1 ? 'практику' : 'практики'} за ${days} дн. и провёл ${minutes} мин с Luna.`)
          : (language === 'en' ? 'This week is still open. One small practice will give Luna something real to reflect back.' : 'Эта неделя ещё открыта. Одна небольшая практика даст Luna реальную основу для отражения.')}
      </p>
      <div className="progress-v3-letter-lines">
        {favorite && <p>{language === 'en' ? `${favorite} is the meditation you return to most.` : `${favorite} — медитация, к которой ты возвращаешься чаще всего.`}</p>}
        {practiceTime && <p>{language === 'en' ? `${practiceTime} is your most familiar practice window.` : `${practiceTime} — самое привычное для тебя время практики.`}</p>}
        <p>{nextStep.title}</p>
      </div>
      <p className="progress-v3-letter-signature">Luna</p>
    </section>
  );
}

function NextStepCard({ step, language, onLibrary, onGarden }: { step: ReturnType<typeof nextGentleStep>; language: AppLanguage; onLibrary: () => void; onGarden: () => void }) {
  const t = progressCopy[language];
  return (
    <section className="progress-v3-next progress-v3-enter">
      <div>
        <p className="progress-v3-eyebrow">{t.nextStep}</p>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
      </div>
      <button type="button" onClick={step.action === 'garden' ? onGarden : onLibrary}>
        {step.action === 'garden' ? t.visitGarden : t.openLibrary}<ChevronRight size={17} />
      </button>
    </section>
  );
}

function AchievementsStory({ items, language }: { items: ProgressAchievement[]; language: AppLanguage }) {
  const t = progressCopy[language];
  const [showAll, setShowAll] = useState(false);
  const sorted = useMemo(() => [...items].sort((left, right) => Number(right.unlocked) - Number(left.unlocked)), [items]);
  const visible = showAll ? sorted : sorted.slice(0, 4);
  const icons = [Moon, Flower2, Sparkles, Sprout];
  return (
    <section className="progress-v3-achievements progress-v3-enter">
      <div className="progress-v3-section-heading">
        <div>
          <p className="progress-v3-eyebrow">{t.achievements}</p>
          <h3>{t.achievementsSubtitle}</h3>
        </div>
        <span>{items.filter((item) => item.unlocked).length}/{items.length}</span>
      </div>
      <div className="progress-v3-achievement-grid">
        {visible.map((item, index) => {
          const Icon = icons[index % icons.length];
          return (
            <article key={item.id} className={item.unlocked ? 'is-unlocked' : 'is-locked'}>
              <div className="progress-v3-achievement-icon">{item.unlocked ? <Icon size={19} /> : <LockKeyhole size={17} />}</div>
              <div>
                <span>{item.unlocked ? t.unlocked : t.locked}</span>
                <h4>{item.title}</h4>
                <p>{item.description}</p>
              </div>
            </article>
          );
        })}
      </div>
      {items.length > 4 && <button type="button" className="progress-v3-achievements-toggle" onClick={() => setShowAll((value) => !value)}>
        {showAll ? t.showFeatured : `${t.viewAll} (${items.length})`}
      </button>}
    </section>
  );
}

export function ProgressExperience({
  profile,
  wellness,
  garden,
  achievements,
  language,
  onMoonGarden,
  onLibrary
}: {
  profile: ProfileStats | null;
  wellness: WellnessSummary | null;
  garden: ProgressGarden;
  achievements: ProgressAchievement[];
  language: AppLanguage;
  onMoonGarden: () => void;
  onLibrary: () => void;
}) {
  const t = progressCopy[language];
  const weekly = buildWeeklyRhythm(profile, language);
  const nextStep = nextGentleStep(profile, wellness, weekly, language);
  return (
    <div className="luna-page luna-child-page progress-v3-page">
      <header className="progress-v3-header">
        <h2>{t.progress}</h2>
        <p>{t.subtitle}</p>
      </header>
      <CurrentRhythmHero profile={profile} weekly={weekly} language={language} />
      <TodayReflection profile={profile} weekly={weekly} language={language} />
      <GardenStory garden={garden} language={language} onOpen={onMoonGarden} />
      <EmotionalJourney profile={profile} language={language} />
      <PersonalInsights profile={profile} language={language} />
      <WeeklyLetter profile={profile} language={language} nextStep={nextStep} />
      <NextStepCard step={nextStep} language={language} onLibrary={onLibrary} onGarden={onMoonGarden} />
      <AchievementsStory items={achievements} language={language} />
    </div>
  );
}
