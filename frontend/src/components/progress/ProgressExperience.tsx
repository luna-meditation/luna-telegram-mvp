import { useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  BatteryLow,
  CalendarDays,
  Check,
  ChevronRight,
  Circle,
  Clock3,
  Cloud,
  CloudRain,
  Crown,
  Flower2,
  Focus,
  HeartHandshake,
  Leaf,
  LockKeyhole,
  Medal,
  Moon,
  Snowflake,
  Sparkles,
  Sprout,
  Sun,
  Sunrise,
  Sunset,
  Wind,
  X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppLanguage, DailyCheckin, Meditation, ProfileStats, ProfileWeek, WellnessSummary } from '../../api';
import { progressCopy, progressText } from './progressCopy';
import { resolveProgressRecommendation } from './progressRecommendation';

export type ProgressAchievement = {
  id: string;
  title: string;
  description: string;
  category: string;
  unlocked: boolean;
  unlockedAt?: string | null;
  progress?: number;
  current?: number;
  target?: number;
};

export type ProgressGarden = {
  level: number;
  title: string;
  image: string;
  seeds: number;
  plantedCount: number;
  totalElements: number;
  nextUpgrade: { name: string; cost: number } | null;
};

type MoodDay = NonNullable<ProfileStats['moodTrend']>[number];
type AchievementFilter = 'all' | 'unlocked' | 'progress' | 'locked';

function localDayLabel(key: string, language: AppLanguage, long = false) {
  return new Date(`${key}T12:00:00`).toLocaleDateString(language === 'en' ? 'en-US' : 'ru-RU', {
    weekday: long ? 'long' : 'short',
    ...(long ? { month: 'long', day: 'numeric' } : {})
  });
}

function localizedMeditation(meditation: Meditation, language: AppLanguage) {
  const translation = meditation.translations?.[language];
  return {
    title: translation?.title?.trim() || meditation.title,
    subtitle: translation?.subtitle?.trim() || meditation.subtitle
  };
}

function practiceTimeLabel(value: 'morning' | 'afternoon' | 'evening' | 'night' | null | undefined, language: AppLanguage) {
  const labels = {
    morning: { en: 'Morning', ru: 'Утро' },
    afternoon: { en: 'Afternoon', ru: 'День' },
    evening: { en: 'Evening', ru: 'Вечер' },
    night: { en: 'Night', ru: 'Ночь' }
  } as const;
  return value ? labels[value][language] : null;
}

function categoryLabel(value: string | null | undefined, language: AppLanguage) {
  if (!value) return null;
  const labels: Record<string, Record<AppLanguage, string>> = {
    sleep: { en: 'Sleep', ru: 'Сон' },
    focus: { en: 'Focus', ru: 'Фокус' },
    anxiety: { en: 'Anxiety relief', ru: 'Снижение тревоги' },
    breath: { en: 'Breathing', ru: 'Дыхание' },
    breathing: { en: 'Breathing', ru: 'Дыхание' },
    calm: { en: 'Calm', ru: 'Спокойствие' },
    morning: { en: 'Morning clarity', ru: 'Утренняя ясность' },
    stress: { en: 'Stress relief', ru: 'Снижение стресса' }
  };
  return labels[value.toLowerCase()]?.[language] ?? value;
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

function sleepLabel(value: DailyCheckin['sleep_range'] | undefined, language: AppLanguage) {
  if (!value) return language === 'en' ? 'Not recorded' : 'Не указан';
  const labels = {
    less_than_4: { en: '<4 h', ru: '<4 ч' },
    '4_6': { en: '4–6 h', ru: '4–6 ч' },
    '6_8': { en: '6–8 h', ru: '6–8 ч' },
    '8_plus': { en: '8+ h', ru: '8+ ч' }
  } as const;
  return labels[value][language];
}

function MoodIcon({ mood, size = 19 }: { mood: DailyCheckin['mood'] | null; size?: number }) {
  if (mood === 'calm') return <Sun size={size} />;
  if (mood === 'stressed') return <CloudRain size={size} />;
  if (mood === 'tired') return <Cloud size={size} />;
  if (mood === 'anxious') return <Wind size={size} />;
  if (mood === 'focused') return <Focus size={size} />;
  if (mood === 'low_energy') return <BatteryLow size={size} />;
  return <Circle size={size - 3} />;
}

function fallbackWeek(): ProfileWeek {
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const weekday = (today.getDay() + 6) % 7;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - weekday, 12);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return {
      key,
      label: key,
      state: (key === localDate ? 'current' : key < localDate ? 'missed' : 'future') as ProfileWeek['days'][number]['state'],
      minutes: 0,
      sessions: 0
    };
  });
  return { weekStart: days[0]?.key ?? localDate, completedDays: 0, completedSessions: 0, listeningMinutes: 0, days };
}

function milestoneFor(streak: number) {
  const target = [7, 14, 30, 60, 100, 365].find((value) => value > streak) ?? Math.ceil((streak + 1) / 100) * 100;
  return { target, remaining: Math.max(1, target - streak) };
}

function russianNoun(count: number, one: string, few: string, many: string) {
  const lastTwo = Math.abs(count) % 100;
  const last = Math.abs(count) % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function milestoneSentence(language: AppLanguage, remaining: number, target: number) {
  if (remaining === 1) return progressText(language, 'oneMoreDay', { target });
  if (language === 'en') return progressText(language, 'moreDays', { count: remaining, target });
  const lastTwo = remaining % 100;
  const last = remaining % 10;
  const key = lastTwo >= 11 && lastTwo <= 14
    ? 'moreDaysMany'
    : last >= 2 && last <= 4
      ? 'moreDaysFew'
      : 'moreDaysMany';
  return progressText(language, key, { count: remaining, target });
}

function rhythmSentence(streak: number, language: AppLanguage) {
  if (streak <= 0) return language === 'en'
    ? 'Your next quiet return can begin a new rhythm.'
    : 'Следующее тихое возвращение может начать новый ритм.';
  return language === 'en'
    ? `You have returned ${streak} ${streak === 1 ? 'day' : 'days'} in a row.`
    : `Ты возвращаешься ${streak} ${russianNoun(streak, 'день', 'дня', 'дней')} подряд.`;
}

function lunaReflection(profile: ProfileStats | null, language: AppLanguage) {
  const current = profile?.currentWeek;
  const previous = profile?.previousWeek;
  const lifetimeDays = profile?.lifetimeStats?.practiceDays ?? 0;
  const samples = profile?.progressInsights?.completedPracticeSamples ?? 0;
  const preferredTime = profile?.progressInsights?.favoritePracticeTime;
  const preferredTimeCount = profile?.progressInsights?.favoritePracticeTimeCount ?? 0;

  if (!current || (samples < 2 && lifetimeDays < 2 && !(profile?.moodTrend ?? []).some((day) => day.mood))) {
    return language === 'en'
      ? 'Your story is still taking shape. A few more check-ins and completed practices will help Luna notice meaningful patterns.'
      : 'Твоя история ещё формируется. Несколько чек-инов и завершённых практик помогут Луне заметить значимые закономерности.';
  }
  const previousHasActivity = Boolean(previous && (previous.listeningMinutes > 0 || previous.completedDays > 0 || previous.completedSessions > 0));
  if (previousHasActivity && current.completedDays > (previous?.completedDays ?? 0)) {
    const time = preferredTimeCount >= 2 ? practiceTimeLabel(preferredTime, language) : null;
    return language === 'en'
      ? `You have returned on more days than last week.${time ? ` ${time} remains your most familiar practice window.` : ''}`
      : `На этой неделе у тебя больше дней практики, чем на прошлой.${time ? ` ${time} остаётся твоим привычным временем практики.` : ''}`;
  }
  if (previousHasActivity && current.completedSessions > (previous?.completedSessions ?? 0) && current.listeningMinutes < (previous?.listeningMinutes ?? 0)) {
    return language === 'en'
      ? 'You completed more practices than last week, even though the sessions were shorter. Your rhythm is becoming easier to return to.'
      : 'Завершённых практик больше, чем на прошлой неделе, хотя сессии были короче. Возвращаться к ритму становится проще.';
  }
  if ((profile?.currentStreak ?? 0) === 1 && lifetimeDays > 1) {
    return language === 'en'
      ? 'You returned after time away. That return matters more than the days between practices.'
      : 'После паузы ты снова с Luna. Это возвращение важнее дней между практиками.';
  }
  if (current.completedDays >= 2 && preferredTimeCount >= 2 && preferredTime) {
    const time = practiceTimeLabel(preferredTime, language);
    return language === 'en'
      ? `${time} is becoming a steadier part of your rhythm. You practiced across ${current.completedDays} days this week.`
      : `${time} становится более устойчивой частью твоего ритма. На этой неделе практика была в ${current.completedDays} днях.`;
  }
  if (current.listeningMinutes > 0) {
    return language === 'en'
      ? `You made room for ${current.listeningMinutes} verified minutes this week. Nothing in this progress needs to be rushed.`
      : `На этой неделе у тебя было ${current.listeningMinutes} подтверждённых минут практики. Этот прогресс не нужно торопить.`;
  }
  return language === 'en'
    ? 'This week is still open. One honest return is enough to give the rhythm a place to begin.'
    : 'Эта неделя ещё открыта. Одного честного возвращения достаточно, чтобы ритм начался.';
}

function CurrentRhythmHero({ profile, language }: { profile: ProfileStats | null; language: AppLanguage }) {
  const t = progressCopy[language];
  const week = profile?.currentWeek ?? fallbackWeek();
  const streak = Math.max(0, profile?.currentStreak ?? 0);
  const longest = Math.max(streak, profile?.longestStreak ?? 0);
  const milestone = milestoneFor(streak);
  const ring = Math.min(100, Math.round((streak / milestone.target) * 100));
  return (
    <section className="progress-v3-hero progress-v4-rhythm progress-v3-enter">
      <img src="/images/progress/progress-bg-01.webp" alt="" className="progress-v3-hero-image" />
      <div className="progress-v3-hero-shade" />
      <span className="progress-v3-moon-glow" aria-hidden="true" />
      <div className="progress-v3-hero-content">
        <div className="progress-v3-hero-topline">
          <div>
            <p className="progress-v3-eyebrow">{t.currentRhythm}</p>
            <p className="progress-v3-hero-note">{rhythmSentence(streak, language)}</p>
          </div>
          <div className="progress-v3-freeze-pill" title={t.freeze}>
            <Snowflake size={14} aria-hidden="true" />
            <span>{t.freeze}</span>
            <strong>{Math.max(0, profile?.freezeCount ?? 0)}/{Math.max(1, profile?.freezeMax ?? 1)}</strong>
          </div>
        </div>

        <div className="progress-v4-rhythm-main">
          <div className="progress-v3-rhythm-ring" style={{ '--ring-progress': `${ring}` } as CSSProperties}>
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="52" className="progress-v3-ring-track" />
              <circle cx="60" cy="60" r="52" className="progress-v3-ring-value" pathLength="100" />
            </svg>
            <div><strong>{streak}</strong><span>{t.dayStreak}</span></div>
          </div>
          <div className="progress-v4-rhythm-facts">
            <div><span>{t.longestRhythm}</span><strong>{longest} {language === 'en' ? (longest === 1 ? 'day' : 'days') : 'дн.'}</strong></div>
            <div><span>{t.activeThisWeek}</span><strong>{week.completedDays} / 7 {t.activeDays}</strong></div>
          </div>
        </div>

        <div className="progress-v4-week-dots" aria-label={t.activeThisWeek}>
          {week.days.map((day) => (
            <div key={day.key} title={`${localDayLabel(day.key, language, true)}: ${day.minutes} ${t.min}`}>
              <span>{localDayLabel(day.key, language).slice(0, 2)}</span>
              <i className={`progress-v4-week-dot progress-v4-week-dot-${day.state}`}>
                {day.state === 'completed' ? <Check size={13} /> : day.state === 'freeze_used' ? <Snowflake size={11} /> : null}
              </i>
            </div>
          ))}
        </div>
        <div className="progress-v4-next-milestone">
          <span>{t.nextMilestone}</span>
          <p>{milestoneSentence(language, milestone.remaining, milestone.target)}</p>
        </div>
      </div>
    </section>
  );
}

function LunasReflection({ profile, language }: { profile: ProfileStats | null; language: AppLanguage }) {
  return (
    <section className="progress-v3-reflection progress-v4-reflection progress-v3-enter">
      <div className="progress-v3-section-icon"><Sparkles size={17} /></div>
      <div>
        <p className="progress-v3-eyebrow">{progressCopy[language].reflection}</p>
        <p className="progress-v3-reflection-copy">{lunaReflection(profile, language)}</p>
      </div>
    </section>
  );
}

function weekComparison(profile: ProfileStats | null, language: AppLanguage) {
  const current = profile?.currentWeek;
  const previous = profile?.previousWeek;
  if (!current || !previous || (previous.listeningMinutes <= 0 && previous.completedDays <= 0 && previous.completedSessions <= 0)) {
    return progressCopy[language].noComparison;
  }
  const difference = current.listeningMinutes - previous.listeningMinutes;
  if (difference > 0) return progressText(language, 'comparedMore', { count: difference });
  if (difference < 0) return progressText(language, 'comparedLess', { count: Math.abs(difference) });
  return progressCopy[language].comparedSame;
}

function ThisWeek({ profile, language }: { profile: ProfileStats | null; language: AppLanguage }) {
  const t = progressCopy[language];
  const week = profile?.currentWeek ?? fallbackWeek();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = week.days.find((day) => day.key === selectedKey)
    ?? week.days.find((day) => day.state === 'current')
    ?? week.days[week.days.length - 1];
  const maxMinutes = Math.max(1, ...week.days.map((day) => day.minutes));
  const hasActivity = week.listeningMinutes > 0 || week.completedDays > 0 || week.completedSessions > 0;
  return (
    <section className="progress-v4-week-section progress-v3-enter">
      <div className="progress-v3-section-heading">
        <div>
          <p className="progress-v3-eyebrow">{t.thisWeek}</p>
          <h3>{week.listeningMinutes} {t.min} <span>{language === 'en' ? `across ${week.completedDays} ${week.completedDays === 1 ? 'day' : 'days'}` : `за ${week.completedDays} ${russianNoun(week.completedDays, 'день', 'дня', 'дней')}`}</span></h3>
        </div>
        <CalendarDays size={21} aria-hidden="true" />
      </div>
      <div className="progress-v4-week-metrics">
        <div><span>{t.listeningMinutes}</span><strong>{week.listeningMinutes}</strong></div>
        <div><span>{t.completedPractices}</span><strong>{week.completedSessions}</strong></div>
        <div><span>{t.practiceDays}</span><strong>{week.completedDays}/7</strong></div>
      </div>
      <div className="progress-v4-activity-heading"><span>{t.weeklyActivity}</span><small>{t.minutesUnit}</small></div>
      <div className="progress-v4-bars" role="group" aria-label={t.weeklyActivity}>
        {week.days.map((day) => {
          const selectedDay = selected?.key === day.key;
          const height = day.minutes > 0 ? Math.max(12, Math.round((day.minutes / maxMinutes) * 100)) : 4;
          return (
            <button key={day.key} type="button" className={selectedDay ? 'is-selected' : ''} onClick={() => setSelectedKey(day.key)} aria-label={`${localDayLabel(day.key, language, true)}: ${day.minutes} ${t.min}`}>
              <span className="progress-v4-bar-track"><i style={{ height: `${height}%` }} data-empty={day.minutes === 0} /></span>
              <b>{localDayLabel(day.key, language).slice(0, 2)}</b>
            </button>
          );
        })}
      </div>
      {hasActivity && selected ? (
        <div className="progress-v4-selected-day">
          <strong>{localDayLabel(selected.key, language, true)}</strong>
          <span>{selected.minutes} {t.min} · {selected.sessions} {language === 'en' ? (selected.sessions === 1 ? 'completed practice' : 'completed practices') : russianNoun(selected.sessions, 'завершённая практика', 'завершённые практики', 'завершённых практик')}</span>
        </div>
      ) : <p className="progress-v3-empty-copy">{t.noWeeklyActivity}</p>}
      <p className="progress-v4-comparison">{weekComparison(profile, language)}</p>
    </section>
  );
}

function moodNote(day: MoodDay, language: AppLanguage) {
  if (day.mood && day.practiceTitle && (day.completedSessions ?? 0) > 0) {
    return language === 'en'
      ? `You recorded ${moodLabel(day.mood, language)} and completed ${day.practiceTitle} on the same day.`
      : `В этот день в чек-ине было состояние «${moodLabel(day.mood, language)}», и была завершена практика ${day.practiceTitle}.`;
  }
  if (day.mood && (day.listeningMinutes ?? 0) > 0) {
    return language === 'en'
      ? `You recorded ${moodLabel(day.mood, language)} and spent ${day.listeningMinutes} minutes in practice that day.`
      : `В чек-ине было состояние «${moodLabel(day.mood, language)}», а на практику пришлось ${day.listeningMinutes} мин.`;
  }
  if (day.mood) return language === 'en'
    ? 'This check-in is one honest point in your emotional timeline.'
    : 'Этот чек-ин — одна честная точка в твоём эмоциональном пути.';
  return language === 'en'
    ? 'No mood was recorded for this day. Luna leaves it empty rather than guessing.'
    : 'В этот день настроение не отмечено. Луна оставляет день пустым и ничего не придумывает.';
}

function MoodJourney({ profile, meditations, language }: { profile: ProfileStats | null; meditations: Meditation[]; language: AppLanguage }) {
  const t = progressCopy[language];
  const days = profile?.moodTrend ?? [];
  const [selectedDay, setSelectedDay] = useState<MoodDay | null>(null);
  const todayKey = days[days.length - 1]?.key;
  const hasMood = days.some((day) => day.mood);
  const selectedPractice = selectedDay?.practiceId ? meditations.find((item) => item.id === selectedDay.practiceId) : null;
  const practiceTitle = selectedPractice ? localizedMeditation(selectedPractice, language).title : selectedDay?.practiceTitle;
  return (
    <section className="progress-v4-mood progress-v3-enter">
      <div className="progress-v3-section-heading">
        <div>
          <p className="progress-v3-eyebrow">{t.moodJourney}</p>
          <h3>{t.moodSubtitle}</h3>
        </div>
        <Moon size={21} aria-hidden="true" />
      </div>
      <div className="progress-v4-mood-line" role="list" aria-label={t.moodJourney}>
        {days.map((day) => (
          <button key={day.key} type="button" role="listitem" onClick={() => setSelectedDay(day)} className={`${day.mood ? `has-mood mood-${day.mood}` : 'is-empty'} ${day.key === todayKey ? 'is-today' : ''}`} aria-label={`${localDayLabel(day.key, language, true)}: ${day.mood ? moodLabel(day.mood, language) : t.noCheckin}`}>
            <span>{day.key === todayKey ? t.today : localDayLabel(day.key, language).slice(0, 2)}</span>
            <i><MoodIcon mood={day.mood} /></i>
            <small>{day.mood ? moodLabel(day.mood, language) : '—'}</small>
          </button>
        ))}
      </div>
      {!hasMood && <p className="progress-v3-empty-copy">{t.noMoodHistory}</p>}

      {selectedDay && typeof document !== 'undefined' && createPortal(
        <div className="progress-v4-sheet-backdrop" role="presentation" onClick={() => setSelectedDay(null)}>
          <section className="progress-v4-detail-sheet" role="dialog" aria-modal="true" aria-label={localDayLabel(selectedDay.key, language, true)} onClick={(event) => event.stopPropagation()}>
            <div className="progress-v4-sheet-handle" />
            <button type="button" className="progress-v4-sheet-close" onClick={() => setSelectedDay(null)} aria-label={t.close}><X size={18} /></button>
            <p className="progress-v3-eyebrow">{localDayLabel(selectedDay.key, language, true)}</p>
            <div className="progress-v4-detail-mood"><MoodIcon mood={selectedDay.mood} size={24} /><h3>{selectedDay.mood ? moodLabel(selectedDay.mood, language) : t.noCheckin}</h3></div>
            <dl className="progress-v4-detail-list">
              <div><dt>{t.mood}</dt><dd>{selectedDay.mood ? moodLabel(selectedDay.mood, language) : t.noCheckin}</dd></div>
              <div><dt>{t.sleep}</dt><dd>{sleepLabel(selectedDay.sleepRange, language)}</dd></div>
              <div><dt>{t.practice}</dt><dd>{practiceTitle || t.noPractice}</dd></div>
              <div><dt>{t.listening}</dt><dd>{selectedDay.listeningMinutes ?? 0} {t.min}</dd></div>
            </dl>
            <p className="progress-v4-detail-note">{moodNote({ ...selectedDay, practiceTitle }, language)}</p>
          </section>
        </div>,
        document.body
      )}
    </section>
  );
}

function weekdayLabel(value: number | null | undefined, language: AppLanguage) {
  if (value == null || value < 0 || value > 6) return null;
  const labels = language === 'en'
    ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    : ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
  return labels[value];
}

function PersonalPatterns({ profile, language }: { profile: ProfileStats | null; language: AppLanguage }) {
  const t = progressCopy[language];
  const insight = profile?.progressInsights;
  if (!insight || insight.completedPracticeSamples < 3) return null;
  const time = insight.favoritePracticeTimeCount >= 2 ? practiceTimeLabel(insight.favoritePracticeTime, language) : null;
  const category = insight.favoriteCategoryCount >= 2 ? categoryLabel(insight.favoriteCategory, language) : null;
  const weekday = insight.monthlyPracticeDays >= 4 ? weekdayLabel(insight.bestPracticeWeekday, language) : null;
  const observations: string[] = [];
  if (time) observations.push(language === 'en' ? `${time} is your most consistent completed-practice window.` : `${time} — время, когда ты чаще всего завершаешь практики.`);
  if (category) observations.push(language === 'en' ? `${category} is the category you complete most often.` : `Категорию «${category}» ты завершаешь чаще всего.`);
  if (weekday) observations.push(language === 'en' ? `${weekday} carries the most practice activity in your history.` : `Больше всего практики в твоей истории приходится на ${weekday}.`);
  return (
    <section className="progress-v3-insights progress-v4-patterns progress-v3-enter">
      <div className="progress-v3-section-heading">
        <div><p className="progress-v3-eyebrow">{t.personalPatterns}</p><h3>{t.patternsSubtitle}</h3></div>
        <Leaf size={21} aria-hidden="true" />
      </div>
      <div className="progress-v3-signals">
        <div><CalendarDays size={16} /><span>{t.monthlyRhythm}</span><strong>{insight.monthlyPracticeDays} {language === 'en' ? 'days' : 'дн.'}</strong></div>
        <div><Clock3 size={16} /><span>{t.averagePractice}</span><strong>{insight.averageSessionMinutes} {t.min}</strong></div>
        <div><Moon size={16} /><span>{t.favoriteTime}</span><strong>{time ?? '—'}</strong></div>
      </div>
      {observations.length ? (
        <div className="progress-v3-observations">{observations.slice(0, 3).map((line, index) => <p key={line}><span>{String(index + 1).padStart(2, '0')}</span>{line}</p>)}</div>
      ) : <p className="progress-v3-empty-copy">{t.patternsForming}</p>}
    </section>
  );
}

function GardenStory({ garden, language, onOpen }: { garden: ProgressGarden; language: AppLanguage; onOpen: () => void }) {
  const t = progressCopy[language];
  const [imageFailed, setImageFailed] = useState(false);
  const level = Math.max(0, Math.min(7, garden.plantedCount));
  return (
    <section className="progress-v4-garden progress-v3-enter">
      <button type="button" onClick={onOpen} className={`progress-v4-garden-scene ${imageFailed ? 'image-failed' : ''}`} aria-label={t.enterGarden}>
        {!imageFailed && <img src={garden.image} alt="" onError={() => {
          setImageFailed(true);
          if (import.meta.env.DEV) console.info('[Luna Progress garden image missing]', garden.image);
        }} />}
        <span className="progress-v4-garden-shade" />
        <span className="progress-v4-garden-mist" aria-hidden="true" />
        <span className="progress-v4-garden-glow" aria-hidden="true" />
        <div className="progress-v4-garden-overlay">
          <p className="progress-v3-eyebrow">{t.moonGarden}</p>
          <h3>{t.gardenLevel} {level} · {garden.title}</h3>
          <div className="progress-v4-garden-data">
            <span>{t.availableSeeds}<strong>{garden.seeds}</strong></span>
            <span>{t.plantedUpgrades}<strong>{level} / 7</strong></span>
          </div>
          <div className="progress-v4-garden-next">
            <span>{t.nextGardenUpgrade}</span>
            <strong>{garden.nextUpgrade ? `${garden.nextUpgrade.name} · ${garden.nextUpgrade.cost} ${language === 'en' ? 'Moon Seeds' : russianNoun(garden.nextUpgrade.cost, 'лунное семя', 'лунных семени', 'лунных семян')}` : t.gardenComplete}</strong>
          </div>
          <span className="progress-v4-garden-cta">{t.enterGarden}<ChevronRight size={16} /></span>
        </div>
      </button>
    </section>
  );
}

function achievementIcon(item: ProgressAchievement): LucideIcon {
  if (item.id.includes('garden')) return Sprout;
  if (item.id.includes('checkin')) return Sparkles;
  if (item.id.includes('morning')) return Sunrise;
  if (item.id.includes('evening') || item.id.includes('sleep')) return Sunset;
  if (item.id.includes('premium')) return Crown;
  if (item.id.includes('focus')) return Focus;
  if (item.id.includes('anxiety')) return HeartHandshake;
  if (item.id.includes('rhythm') || item.id.includes('week') || item.id.includes('day')) return Moon;
  if (item.category === 'practice') return Flower2;
  return Medal;
}

function achievementStatus(item: ProgressAchievement): AchievementFilter {
  if (item.unlocked) return 'unlocked';
  return (item.progress ?? 0) > 0 ? 'progress' : 'locked';
}

function AchievementCard({ item, language, compact = false }: { item: ProgressAchievement; language: AppLanguage; compact?: boolean }) {
  const t = progressCopy[language];
  const Icon = achievementIcon(item);
  const status = achievementStatus(item);
  const earnedDate = item.unlockedAt ? new Date(item.unlockedAt).toLocaleDateString(language === 'en' ? 'en-US' : 'ru-RU', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
  return (
    <article className={`progress-v4-achievement ${item.unlocked ? 'is-unlocked' : ''} ${compact ? 'is-compact' : ''}`}>
      <div className="progress-v4-achievement-icon">{item.unlocked ? <Icon size={19} /> : <LockKeyhole size={17} />}</div>
      <div className="progress-v4-achievement-copy">
        <span>{status === 'unlocked' ? t.unlocked : status === 'progress' ? t.inProgress : t.locked}</span>
        <h4>{item.title}</h4>
        <p>{item.description}</p>
        {!compact && item.unlocked && earnedDate && <small>{progressText(language, 'earned', { date: earnedDate })}</small>}
        {!compact && !item.unlocked && (item.target ?? 0) > 0 && (
          <div className="progress-v4-achievement-progress">
            <div><span style={{ width: `${Math.max(0, Math.min(100, item.progress ?? 0))}%` }} /></div>
            <small>{progressText(language, 'achievementProgress', { current: item.current ?? 0, target: item.target ?? 0 })}</small>
          </div>
        )}
      </div>
    </article>
  );
}

function AchievementsStory({ items, language }: { items: ProgressAchievement[]; language: AppLanguage }) {
  const t = progressCopy[language];
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AchievementFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const unlocked = items.filter((item) => item.unlocked).sort((left, right) => String(right.unlockedAt ?? '').localeCompare(String(left.unlockedAt ?? '')));
  const featured = unlocked.slice(0, 4);
  const filtered = items
    .filter((item) => statusFilter === 'all' || achievementStatus(item) === statusFilter)
    .filter((item) => categoryFilter === 'all' || item.category === categoryFilter)
    .sort((left, right) => Number(right.unlocked) - Number(left.unlocked) || (right.progress ?? 0) - (left.progress ?? 0));
  const categories = [
    ['all', t.all], ['practice', t.practiceCategory], ['rhythm', t.rhythmCategory], ['wellness', t.wellnessCategory], ['garden', t.gardenCategory], ['premium', t.premiumCategory]
  ];
  return (
    <section className="progress-v4-achievements progress-v3-enter">
      <div className="progress-v3-section-heading">
        <div><p className="progress-v3-eyebrow">{t.achievements}</p><h3>{t.latestAchievements}</h3></div>
        <span className="progress-v4-achievement-count">{progressText(language, 'unlockedCount', { unlocked: unlocked.length, total: items.length })}</span>
      </div>
      {featured.length ? <div className="progress-v4-achievement-grid">{featured.map((item) => <AchievementCard key={item.id} item={item} language={language} compact />)}</div> : <p className="progress-v3-empty-copy">{t.noAchievements}</p>}
      {items.length > 0 && <button type="button" className="progress-v4-view-achievements" onClick={() => setOpen(true)}>{t.viewAllAchievements}<ChevronRight size={16} /></button>}

      {open && typeof document !== 'undefined' && createPortal(
        <div className="progress-v4-achievements-page" role="dialog" aria-modal="true" aria-label={t.allAchievements}>
          <header>
            <div><p className="progress-v3-eyebrow">{t.achievements}</p><h2>{t.allAchievements}</h2><span>{progressText(language, 'unlockedCount', { unlocked: unlocked.length, total: items.length })}</span></div>
            <button type="button" onClick={() => setOpen(false)} aria-label={t.close}><X size={20} /></button>
          </header>
          <div className="progress-v4-status-filters">
            {([['all', t.all], ['unlocked', t.unlocked], ['progress', t.inProgress], ['locked', t.locked]] as Array<[AchievementFilter, string]>).map(([id, label]) => (
              <button key={id} type="button" className={statusFilter === id ? 'is-active' : ''} onClick={() => setStatusFilter(id)}>{label}</button>
            ))}
          </div>
          <div className="progress-v4-category-filters">
            {categories.map(([id, label]) => <button key={id} type="button" className={categoryFilter === id ? 'is-active' : ''} onClick={() => setCategoryFilter(id)}>{label}</button>)}
          </div>
          <div className="progress-v4-achievements-list">{filtered.map((item) => <AchievementCard key={item.id} item={item} language={language} />)}</div>
        </div>,
        document.body
      )}
    </section>
  );
}

function NextGentleStep({
  profile, wellness, meditations, language, hasPremium, onOpenMeditation, onLibrary
}: {
  profile: ProfileStats | null;
  wellness: WellnessSummary | null;
  meditations: Meditation[];
  language: AppLanguage;
  hasPremium: boolean;
  onOpenMeditation: (meditation: Meditation) => void;
  onLibrary: () => void;
}) {
  const t = progressCopy[language];
  const [actionError, setActionError] = useState('');
  const recommendation = useMemo(() => resolveProgressRecommendation({ meditations, profile, wellness, language, hasPremium }), [hasPremium, language, meditations, profile, wellness]);
  if (!recommendation) {
    return (
      <section className="progress-v3-next progress-v4-next progress-v3-enter">
        <p className="progress-v3-eyebrow">{t.nextStep}</p>
        <h3>{t.recommendationUnavailable}</h3>
        <button type="button" onClick={onLibrary}>{t.openLibrary}<ChevronRight size={16} /></button>
      </section>
    );
  }
  const localized = localizedMeditation(recommendation.meditation, language);
  const duration = Math.max(1, Math.round(Number(recommendation.meditation.duration || 0) / 60));
  const open = () => {
    setActionError('');
    try {
      onOpenMeditation(recommendation.meditation);
    } catch {
      setActionError(language === 'en' ? 'The practice could not open. Please try again.' : 'Не удалось открыть практику. Попробуй ещё раз.');
    }
  };
  return (
    <section className="progress-v3-next progress-v4-next progress-v3-enter">
      <div className="progress-v4-next-heading"><div><p className="progress-v3-eyebrow">{t.nextStep}</p><h3>{language === 'en' ? 'One practice that fits your rhythm now.' : 'Одна практика, которая подходит твоему ритму сейчас.'}</h3></div><Sparkles size={20} /></div>
      <div className="progress-v4-next-practice">
        <img src={recommendation.meditation.cover_image} alt="" />
        <div><h4>{localized.title}</h4><p>{localized.subtitle}</p><span>{duration} {t.min} · {recommendation.locked ? t.premium : t.included}</span></div>
      </div>
      <p className="progress-v4-next-reason">{recommendation.reason}</p>
      {actionError && <p className="progress-v4-action-error" role="alert">{actionError}</p>}
      <button type="button" onClick={open}>{t.startPractice}<ChevronRight size={16} /></button>
    </section>
  );
}

function ProgressDiagnostics({ profile, language }: { profile: ProfileStats | null; language: AppLanguage }) {
  const data = profile?.progressDiagnostics;
  if (!data) return null;
  const t = progressCopy[language];
  const rows = [
    [t.diagnosticCurrentWeek, `${data.localWeekStart} → ${data.localWeekEnd}`],
    [t.diagnosticPreviousWeek, `${data.previousWeekStart} → ${data.previousWeekEnd}`],
    [t.diagnosticSessions, data.sourceSessionCount],
    [t.diagnosticSeconds, data.verifiedListeningSeconds],
    [t.diagnosticDates, data.dailyActiveDates.join(', ') || '—'],
    [t.diagnosticStreak, `${data.currentStreak} / ${data.longestStreak}`],
    [t.diagnosticMoods, data.moodEntriesCount],
    [t.diagnosticGarden, `${data.plantedGardenUpgrades} / 7`],
    [t.diagnosticAchievements, data.achievementCount],
    [t.diagnosticRefresh, data.lastProgressRefreshAt]
  ];
  return (
    <details className="progress-v4-diagnostics">
      <summary><span>{t.diagnostics}</span><small>{t.show}</small></summary>
      <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </details>
  );
}

export function ProgressExperienceSkeleton({ language }: { language: AppLanguage }) {
  return (
    <main className="progress-v3-page progress-v4-page" aria-busy="true" aria-label={language === 'en' ? 'Loading progress' : 'Загрузка прогресса'}>
      <header className="progress-v3-header"><div className="progress-v4-skeleton h-title" /><div className="progress-v4-skeleton h-subtitle" /></header>
      <div className="progress-v4-skeleton h-hero" />
      <div className="progress-v4-skeleton h-reflection" />
      <div className="progress-v4-skeleton h-week" />
      <div className="progress-v4-skeleton h-mood" />
      <div className="progress-v4-skeleton h-garden" />
    </main>
  );
}

export function ProgressExperience({
  profile,
  wellness,
  language,
  garden,
  achievements,
  meditations,
  hasPremium,
  isAdmin,
  onMoonGarden,
  onOpenMeditation,
  onLibrary
}: {
  profile: ProfileStats | null;
  wellness: WellnessSummary | null;
  language: AppLanguage;
  garden: ProgressGarden;
  achievements: ProgressAchievement[];
  meditations: Meditation[];
  hasPremium: boolean;
  isAdmin: boolean;
  onMoonGarden: () => void;
  onOpenMeditation: (meditation: Meditation) => void;
  onLibrary: () => void;
}) {
  const t = progressCopy[language];
  return (
    <main className="progress-v3-page progress-v4-page">
      <header className="progress-v3-header"><h2>{t.progress}</h2><p>{t.subtitle}</p></header>
      <CurrentRhythmHero profile={profile} language={language} />
      <LunasReflection profile={profile} language={language} />
      <ThisWeek profile={profile} language={language} />
      <MoodJourney profile={profile} meditations={meditations} language={language} />
      <PersonalPatterns profile={profile} language={language} />
      <GardenStory garden={garden} language={language} onOpen={onMoonGarden} />
      <AchievementsStory items={achievements} language={language} />
      <NextGentleStep profile={profile} wellness={wellness} meditations={meditations} language={language} hasPremium={hasPremium} onOpenMeditation={onOpenMeditation} onLibrary={onLibrary} />
      {isAdmin && <ProgressDiagnostics profile={profile} language={language} />}
    </main>
  );
}
