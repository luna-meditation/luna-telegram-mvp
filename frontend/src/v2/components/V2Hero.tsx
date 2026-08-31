import { useState } from 'react';

type MoodChip = 'Sleep' | 'Calm' | 'Focus' | 'Anxiety' | 'Breath' | 'Energy';
type MoodVisual = 'great' | 'good' | 'meh' | 'anxious' | 'tired';

export const homeHeroAssets = {
  dark: '/images/home/hero-night.png',
  light: '/images/home/hero-light.png'
} as const;

function MoodGlyph({ kind }: { kind: MoodVisual }) {
  if (kind === 'great') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.25c.55 4.2 2.55 6.2 6.75 6.75-4.2.55-6.2 2.55-6.75 6.75-.55-4.2-2.55-6.2-6.75-6.75C9.45 9.45 11.45 7.45 12 3.25Z" />
        <path d="M18.4 15.7c.2 1.55.95 2.3 2.5 2.5-1.55.2-2.3.95-2.5 2.5-.2-1.55-.95-2.3-2.5-2.5 1.55-.2 2.3-.95 2.5-2.5Z" />
      </svg>
    );
  }
  if (kind === 'good') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="6.75" />
        <path d="M8.7 12h6.6M12 8.7v6.6" />
      </svg>
    );
  }
  if (kind === 'meh') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 19.25 5.85 13.4a4.25 4.25 0 0 1 6.15-5.85 4.25 4.25 0 0 1 6.15 5.85L12 19.25Z" />
        <path d="M9.25 12h5.5" />
      </svg>
    );
  }
  if (kind === 'anxious') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9.35 5.15A3.3 3.3 0 0 0 6.2 8.4a3.15 3.15 0 0 0-1.45 5.95 3.6 3.6 0 0 0 4.1 4.45M14.65 5.15A3.3 3.3 0 0 1 17.8 8.4a3.15 3.15 0 0 1 1.45 5.95 3.6 3.6 0 0 1-4.1 4.45M12 4.75v14.5M8.6 9.25c1.7.15 2.65 1.05 2.85 2.65M15.4 14.75c-1.7-.15-2.65-1.05-2.85-2.65" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.8 15.65A7.3 7.3 0 0 1 8.35 6.2 7.35 7.35 0 1 0 17.8 15.65Z" />
      <path d="M17.4 5.2v2.7M16.05 6.55h2.7" />
    </svg>
  );
}

function MoodOption({
  mood,
  visual,
  label,
  title,
  selected,
  disabled,
  onSelect
}: {
  mood: MoodChip;
  visual: MoodVisual;
  label: string;
  title: string;
  selected: boolean;
  disabled: boolean;
  onSelect: (mood: MoodChip) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(mood)}
      disabled={disabled}
      aria-pressed={selected}
      className={`home-v2-mood-pill ${selected ? 'home-v2-mood-pill-active' : ''}`}
      title={title}
    >
      <span><MoodGlyph kind={visual} /></span>
      <small>{label}</small>
    </button>
  );
}

type V2HeroProps = {
  greeting: string;
  firstName: string;
  headline: string;
  moods: MoodChip[];
  activeMood?: MoodChip;
  moodLabel: (mood: MoodChip) => string;
  language: 'en' | 'ru';
  checkinLine: string;
  checkinToast: string;
  showCheckinToast: boolean;
  moodSaved: boolean;
  moodSaving: boolean;
  changeLabel: string;
  onCheckinDetails: () => void;
  onMood: (mood: MoodChip) => void;
};

export function V2Hero({
  greeting,
  firstName,
  headline,
  activeMood,
  moodLabel,
  language,
  checkinLine,
  checkinToast,
  showCheckinToast,
  moodSaved,
  moodSaving,
  changeLabel,
  onCheckinDetails,
  onMood
}: V2HeroProps) {
  const visualMoods: Array<{ mood: MoodChip; active: MoodChip[]; visual: MoodVisual; label: Record<'en' | 'ru', string> }> = [
    { mood: 'Focus', active: ['Focus', 'Energy'], visual: 'great', label: { en: 'Great', ru: 'Отлично' } },
    { mood: 'Calm', active: ['Calm'], visual: 'good', label: { en: 'Good', ru: 'Хорошо' } },
    { mood: 'Breath', active: ['Breath'], visual: 'meh', label: { en: 'Meh', ru: 'Норм' } },
    { mood: 'Anxiety', active: ['Anxiety'], visual: 'anxious', label: { en: 'Anxious', ru: 'Тревожно' } },
    { mood: 'Sleep', active: ['Sleep'], visual: 'tired', label: { en: 'Tired', ru: 'Устал' } }
  ];
  const [failedImages, setFailedImages] = useState<Record<keyof typeof homeHeroAssets, boolean>>({ dark: false, light: false });
  const selectedMood = activeMood ? visualMoods.find((item) => item.active.includes(activeMood)) : null;

  return (
    <section className="home-v2-atmosphere">
      <div className="home-v2-atmosphere-art" aria-hidden="true">
        {(Object.entries(homeHeroAssets) as Array<[keyof typeof homeHeroAssets, string]>).map(([theme, path]) => failedImages[theme] ? null : (
          <img
            key={theme}
            src={path}
            className={`home-v2-hero-image home-v2-hero-${theme}`}
            alt=""
            loading="eager"
            onError={() => {
              if (import.meta.env.DEV) console.info('[Luna Home V2 hero image missing]', path);
              setFailedImages((current) => ({ ...current, [theme]: true }));
            }}
          />
        ))}
      </div>

      <div className={`home-v2-atmosphere-copy ${moodSaved ? 'is-checked-in' : ''}`}>
        <p className="home-v2-greeting">{greeting}, {firstName}</p>
        <h1>{moodSaved ? (language === 'ru' ? 'Сегодняшний чек-ин' : "Today’s check-in") : headline}</h1>
      </div>

      {showCheckinToast ? (
        <div className="home-v2-checkin-toast" role="status">
          <span aria-hidden="true">✓</span>
          <strong>{checkinToast}</strong>
        </div>
      ) : null}

      {moodSaved && activeMood ? (
        <div className="home-v2-mood-saved" aria-label={`${language === 'ru' ? 'Сегодня' : 'Today'}: ${moodLabel(activeMood)}`}>
          <span>{selectedMood ? <MoodGlyph kind={selectedMood.visual} /> : null}</span>
          <span className="home-v2-mood-saved-copy">
            <small>{language === 'ru' ? 'СЕГОДНЯ' : 'TODAY'}</small>
            <strong>{moodLabel(activeMood)}</strong>
          </span>
          <div className="home-v2-mood-actions">
            <button type="button" onClick={onCheckinDetails}>{changeLabel} →</button>
          </div>
        </div>
      ) : (
        <div className="home-v2-mood-row" aria-label={checkinLine}>
          {visualMoods.map(({ mood, active, visual, label }) => (
            <MoodOption
              key={mood}
              mood={mood}
              visual={visual}
              label={label[language]}
              title={moodLabel(mood)}
              selected={Boolean(activeMood && active.includes(activeMood))}
              disabled={moodSaving}
              onSelect={onMood}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function V2HeroFallback({ title, body }: { title: string; body: string }) {
  return (
    <section className="home-v2-atmosphere home-v2-atmosphere-empty">
      <div className="home-v2-atmosphere-copy">
        <p className="home-v2-greeting">{body}</p>
        <h1>{title}</h1>
      </div>
    </section>
  );
}
