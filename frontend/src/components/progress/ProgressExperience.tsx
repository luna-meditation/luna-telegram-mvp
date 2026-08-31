import { useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  ChevronRight,
  Clock3,
  Crown,
  Flower2,
  Focus,
  HeartHandshake,
  Leaf,
  Medal,
  Moon,
  Snowflake,
  Sparkles,
  Sprout,
  Sunrise,
  Sunset,
  X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppLanguage, ProfileStats } from '../../api';
import { progressCopy, progressText } from './progressCopy';

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

type AchievementFilter = 'all' | 'unlocked' | 'progress' | 'locked';

function localDayLabel(key: string, language: AppLanguage, long = false) {
  return new Date(`${key}T12:00:00`).toLocaleDateString(language === 'en' ? 'en-US' : 'ru-RU', {
    weekday: long ? 'long' : 'short',
    ...(long ? { month: 'long', day: 'numeric' } : {})
  });
}

function russianNoun(count: number, one: string, few: string, many: string) {
  const lastTwo = Math.abs(count) % 100;
  const last = Math.abs(count) % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function rhythmSentence(streak: number, language: AppLanguage) {
  if (streak <= 0) return language === 'en'
    ? 'Your next quiet return can begin a new rhythm.'
    : 'Следующее тихое возвращение может начать новый ритм.';
  return language === 'en'
    ? `You have returned ${streak} ${streak === 1 ? 'day' : 'days'} in a row.`
    : `Ты возвращаешься ${streak} ${russianNoun(streak, 'день', 'дня', 'дней')} подряд.`;
}

export type JourneyStatusId = NonNullable<ProfileStats['journeyStatus']>['id'];
export type JourneyStatus = NonNullable<ProfileStats['journeyStatus']>;
type JourneyRequirement = NonNullable<NonNullable<ProfileStats['journeyStatus']>['next']>['remaining'][number];

export const journeyStatusNames: Record<AppLanguage, Record<JourneyStatusId, string>> = {
  en: {
    initiate: 'Initiate', seeker: 'Seeker', adept: 'Adept', guardian: 'Guardian', luminary: 'Luminary',
    sage: 'Sage', ascendant: 'Ascendant', celestial: 'Celestial', ethereal: 'Ethereal', lunaris: 'Lunaris'
  },
  ru: {
    initiate: 'Посвящённый', seeker: 'Искатель', adept: 'Адепт', guardian: 'Хранитель', luminary: 'Светоч',
    sage: 'Мудрец', ascendant: 'Возвышенный', celestial: 'Небесный', ethereal: 'Эфирный', lunaris: 'Лунарис'
  }
};

export function JourneyStatusMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`progress-v5-status-seal ${compact ? 'is-compact' : ''}`} aria-hidden="true">
      <Moon size={compact ? 18 : 28} />
      <Sparkles size={compact ? 9 : 13} />
    </span>
  );
}

export function resolveJourneyStatus(profile: ProfileStats | null): JourneyStatus {
  const completedMeditations = Math.max(0, profile?.completedMeditations ?? 0);
  return profile?.journeyStatus ?? {
    id: 'initiate',
    rank: completedMeditations > 0 ? 0 : -1,
    earned: completedMeditations > 0,
    eligibleRank: completedMeditations > 0 ? 0 : -1,
    next: {
      id: 'initiate',
      rank: 0,
      progressPercent: Math.min(100, completedMeditations * 100),
      remaining: completedMeditations > 0 ? [] : [{ key: 'completedMeditations', current: 0, target: 1, remaining: 1 }]
    }
  };
}

const journeyStatusDescriptions: Record<AppLanguage, Record<JourneyStatusId, string>> = {
  en: {
    initiate: 'Your first quiet return.', seeker: 'Calm is becoming a rhythm.', adept: 'Practice is taking root.',
    guardian: 'You protect space for yourself.', luminary: 'Your consistency carries light.', sage: 'Stillness has become familiar.',
    ascendant: 'Your practice keeps rising.', celestial: 'A rare rhythm under the moon.', ethereal: 'Calm moves with you.', lunaris: 'The full Luna path is yours.'
  },
  ru: {
    initiate: 'Твоё первое тихое возвращение.', seeker: 'Спокойствие становится ритмом.', adept: 'Практика пускает корни.',
    guardian: 'Ты бережёшь пространство для себя.', luminary: 'Твоя регулярность несёт свет.', sage: 'Тишина стала знакомой.',
    ascendant: 'Твоя практика продолжает расти.', celestial: 'Редкий ритм под светом луны.', ethereal: 'Спокойствие остаётся с тобой.', lunaris: 'Полный путь Luna открыт.'
  }
};

function journeyRequirementText(requirement: JourneyRequirement, nextName: string, language: AppLanguage) {
  const { key, remaining } = requirement;
  if (language === 'en') {
    if (key === 'completedMeditations') return `${remaining} more ${remaining === 1 ? 'meditation' : 'meditations'} to ${nextName}`;
    if (key === 'longestStreak') return `${remaining} more best-streak ${remaining === 1 ? 'day' : 'days'} to ${nextName}`;
    if (key === 'unlockedAchievements') return `${remaining} more ${remaining === 1 ? 'achievement' : 'achievements'} to ${nextName}`;
    return `${remaining} more garden ${remaining === 1 ? 'level' : 'levels'} to ${nextName}`;
  }
  if (key === 'completedMeditations') return `Ещё ${remaining} ${russianNoun(remaining, 'медитация', 'медитации', 'медитаций')} до статуса «${nextName}»`;
  if (key === 'longestStreak') return `Ещё ${remaining} ${russianNoun(remaining, 'день', 'дня', 'дней')} лучшего стрика до статуса «${nextName}»`;
  if (key === 'unlockedAchievements') return `Ещё ${remaining} ${russianNoun(remaining, 'достижение', 'достижения', 'достижений')} до статуса «${nextName}»`;
  return `Ещё ${remaining} ${russianNoun(remaining, 'уровень', 'уровня', 'уровней')} сада до статуса «${nextName}»`;
}

function JourneyStatusHero({ profile, language }: { profile: ProfileStats | null; language: AppLanguage }) {
  const status = resolveJourneyStatus(profile);
  const next = status.next;
  const name = journeyStatusNames[language][status.id];
  const nextName = next ? journeyStatusNames[language][next.id] : null;

  return (
    <section className="progress-v5-status progress-v3-enter" aria-label={language === 'en' ? `Journey status: ${name}` : `Статус пути: ${name}`}>
      <div className="progress-v5-status-heading">
        <JourneyStatusMark />
        <div className="progress-v5-status-copy">
          <p className="progress-v3-eyebrow">{language === 'en' ? 'Your status' : 'Твой статус'}</p>
          <h2>{name}</h2>
          <p>{journeyStatusDescriptions[language][status.id]}</p>
        </div>
        <span className="progress-v5-status-rank">{Math.max(1, status.rank + 1)} / 10</span>
      </div>
      {next ? (
        <div className="progress-v5-status-progress">
          <div className="progress-v5-status-progress-label"><span>{language === 'en' ? 'Next status' : 'Следующий статус'}</span><strong>{nextName}</strong><b>{next.progressPercent}%</b></div>
          <div className="progress-v5-status-progress-track" aria-label={`${next.progressPercent}%`}><span style={{ width: `${next.progressPercent}%` }} /></div>
          <div className="progress-v5-status-requirements">
            {next.remaining.slice(0, 3).map((requirement) => <span key={requirement.key}>{journeyRequirementText(requirement, nextName ?? name, language)}</span>)}
          </div>
        </div>
      ) : (
        <p className="progress-v5-status-complete"><Sparkles size={14} />{language === 'en' ? 'Highest Journey status reached' : 'Высший статус пути достигнут'}</p>
      )}
    </section>
  );
}

function CurrentRhythmHero({ profile, language }: { profile: ProfileStats | null; language: AppLanguage }) {
  const t = progressCopy[language];
  const week = profile?.currentWeek;
  if (!week) return null;
  const streak = Math.max(0, profile?.currentStreak ?? 0);
  const longest = Math.max(streak, profile?.longestStreak ?? 0);
  const activeDays = week.activeDays ?? week.completedDays;
  const ring = Math.min(100, Math.round((streak / 7) * 100));
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
            <div><strong data-digits={Math.min(3, String(streak).length)}>{streak}</strong><span>{t.dayStreak}</span></div>
          </div>
          <div className="progress-v4-rhythm-facts">
            <div><span>{t.longestRhythm}</span><strong>{longest} {language === 'en' ? (longest === 1 ? 'day' : 'days') : 'дн.'}</strong></div>
            <div><span>{t.activeThisWeek}</span><strong>{activeDays} / 7 {t.activeDays}</strong></div>
          </div>
        </div>

        <div className="progress-v4-week-dots" aria-label={t.activeThisWeek}>
          {week.days.map((day) => (
            <div key={day.key} title={`${localDayLabel(day.key, language, true)}: ${day.minutes} ${t.min}`}>
              <span>{localDayLabel(day.key, language).slice(0, 2)}</span>
              <i className={`progress-v4-week-dot progress-v4-week-dot-${day.state} ${day.isCurrent ? 'is-current-day' : ''} ${day.hasVerifiedPractice ? 'has-practice' : day.hasCheckin ? 'has-checkin' : ''}`}>
                {day.state === 'completed' ? <Check size={13} /> : day.state === 'freeze_used' ? <Snowflake size={11} /> : null}
              </i>
            </div>
          ))}
        </div>
        <div className="progress-v4-rhythm-footer">
          <div className="progress-v4-seed-reward">
            <Sprout size={15} aria-hidden="true" />
            <span>{language === 'en' ? '+1 Moon Seed each active day' : '+1 лунное семя за активный день'}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function achievementIcon(item: ProgressAchievement): LucideIcon {
  if (item.id === 'moon_garden_level_3') return Sprout;
  if (item.id === 'moon_garden_level_5') return Leaf;
  if (item.id === 'moon_garden_level_7') return Moon;
  if (item.id === 'first_checkin') return Sparkles;
  if (item.id.includes('checkin')) return HeartHandshake;
  if (item.id.includes('morning')) return Sunrise;
  if (item.id.includes('evening') || item.id.includes('sleep')) return Sunset;
  if (item.id.includes('minute')) return Clock3;
  if (item.id === 'first_meditation') return Flower2;
  if (item.id.includes('session') || item.id.includes('meditation')) return Medal;
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
    <article
      className={`progress-v4-achievement ${item.unlocked ? 'is-unlocked' : 'is-locked'} ${compact ? 'is-compact' : ''}`}
      aria-label={`${item.title}. ${item.description}`}
      title={item.description}
    >
      <div className="progress-v4-achievement-icon"><Icon size={22} /></div>
      <div className="progress-v4-achievement-copy">
        <span>{status === 'unlocked' ? t.unlocked : status === 'progress' ? t.inProgress : t.locked}</span>
        <h4>{item.title}</h4>
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
  const journeyItems = items;
  const journeyUnlocked = journeyItems.filter((item) => item.unlocked).sort((left, right) => String(right.unlockedAt ?? '').localeCompare(String(left.unlockedAt ?? '')));
  const featured = [...journeyItems]
    .sort((left, right) => Number(right.unlocked) - Number(left.unlocked)
      || String(right.unlockedAt ?? '').localeCompare(String(left.unlockedAt ?? ''))
      || (right.progress ?? 0) - (left.progress ?? 0))
    .slice(0, 3);
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
        <span className="progress-v4-achievement-count">{progressText(language, 'unlockedCount', { unlocked: journeyUnlocked.length, total: journeyItems.length })}</span>
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
    <main className="progress-v3-page progress-v4-page" aria-busy="true" aria-label={language === 'en' ? 'Loading Journey' : 'Загрузка пути'}>
      <div className="progress-v4-skeleton h-hero" />
      <div className="progress-v4-skeleton h-achievements" />
    </main>
  );
}

export function ProgressExperience({
  profile,
  language,
  achievements,
  garden,
  isAdmin
}: {
  profile: ProfileStats | null;
  language: AppLanguage;
  achievements: ProgressAchievement[];
  garden: ReactNode;
  isAdmin: boolean;
}) {
  return (
    <main className="progress-v3-page progress-v4-page">
      <JourneyStatusHero profile={profile} language={language} />
      <CurrentRhythmHero profile={profile} language={language} />
      <div className="journey-hub-garden" aria-label={progressCopy[language].moonGarden}>{garden}</div>
      <AchievementsStory items={achievements} language={language} />
      {import.meta.env.DEV && isAdmin && <ProgressDiagnostics profile={profile} language={language} />}
    </main>
  );
}
