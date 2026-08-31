import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, LockKeyhole, Moon, Sparkles, X } from 'lucide-react';
import type { AppLanguage, ProfileStats } from '../../api';
import {
  journeyStatusDefinitions,
  type JourneyStatusId,
  type JourneyStatusRequirement
} from '../../../../backend/src/journey-status';

export type JourneyStatus = NonNullable<ProfileStats['journeyStatus']>;

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

export const journeyStatusDescriptions: Record<AppLanguage, Record<JourneyStatusId, string>> = {
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

export function JourneyStatusMark({ statusId = 'initiate', compact = false }: { statusId?: JourneyStatusId; compact?: boolean }) {
  return (
    <span className={`progress-v5-status-seal ${compact ? 'is-compact' : ''}`} data-status={statusId} aria-hidden="true">
      <Moon size={compact ? 18 : 28} />
      <Sparkles className="progress-v5-status-sparkle" size={compact ? 9 : 13} />
    </span>
  );
}

function requirementSummary(requirement: JourneyStatusRequirement, language: AppLanguage) {
  const { key, target } = requirement;
  if (language === 'en') {
    if (key === 'completedMeditations') return `${target} completed ${target === 1 ? 'meditation' : 'meditations'}`;
    if (key === 'longestStreak') return `${target}-day best streak`;
    if (key === 'unlockedAchievements') return `${target} unlocked achievements`;
    return `Moon Garden level ${target}`;
  }
  if (key === 'completedMeditations') return `Завершённые медитации: ${target}`;
  if (key === 'longestStreak') return `Лучший стрик: ${target} дн.`;
  if (key === 'unlockedAchievements') return `Достижения: ${target}`;
  return `Лунный сад: уровень ${target}`;
}

export function StatusProgressionSheet({
  profile,
  language,
  onClose
}: {
  profile: ProfileStats | null;
  language: AppLanguage;
  onClose: () => void;
}) {
  const status = resolveJourneyStatus(profile);
  const currentRank = Math.max(0, status.rank);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="status-progression-backdrop" onClick={onClose}>
      <section
        className="status-progression-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-progression-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="status-progression-header">
          <div>
            <p className="progress-v3-eyebrow">{language === 'en' ? 'Your Luna path' : 'Твой путь Luna'}</p>
            <h2 id="status-progression-title">{language === 'en' ? 'Luna statuses' : 'Статусы Luna'}</h2>
            <p>{language === 'en' ? 'A quiet record of your practice, rhythm and Moon Garden.' : 'Спокойная история твоей практики, ритма и Лунного сада.'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={language === 'en' ? 'Close statuses' : 'Закрыть статусы'}><X size={20} /></button>
        </header>

        <ol className="status-progression-list">
          {journeyStatusDefinitions.map((definition) => {
            const state = definition.rank < currentRank ? 'unlocked' : definition.rank === currentRank ? 'current' : 'locked';
            const name = journeyStatusNames[language][definition.id];
            return (
              <li key={definition.id} className={`status-progression-item is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                <JourneyStatusMark statusId={definition.id} compact />
                <div className="status-progression-copy">
                  <span>{definition.rank + 1} / {journeyStatusDefinitions.length}</span>
                  <h3>{name}</h3>
                  <p>{definition.requirements.map((requirement) => requirementSummary(requirement, language)).join(' · ')}</p>
                </div>
                <span className="status-progression-state">
                  {state === 'unlocked' ? <Check size={15} /> : state === 'locked' ? <LockKeyhole size={14} /> : <Sparkles size={14} />}
                  {state === 'unlocked'
                    ? (language === 'en' ? 'Unlocked' : 'Открыт')
                    : state === 'current'
                      ? (language === 'en' ? 'Current' : 'Текущий')
                      : (language === 'en' ? 'Locked' : 'Закрыт')}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>,
    document.body
  );
}

