import { useState } from 'react';

type MoodChip = 'Sleep' | 'Calm' | 'Focus' | 'Anxiety' | 'Breath' | 'Energy';

type V2HeroProps = {
  greeting: string;
  firstName: string;
  headline: string;
  moods: MoodChip[];
  activeMood?: MoodChip;
  moodLabel: (mood: MoodChip) => string;
  language: 'en' | 'ru';
  checkinLine: string;
  moodSaved: boolean;
  moodSaving: boolean;
  changeLabel: string;
  detailsLabel: string;
  onChangeMood: () => void;
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
  moodSaved,
  moodSaving,
  changeLabel,
  detailsLabel,
  onChangeMood,
  onCheckinDetails,
  onMood
}: V2HeroProps) {
  const visualMoods: Array<{ mood: MoodChip; active: MoodChip[]; symbol: string; label: Record<'en' | 'ru', string> }> = [
    { mood: 'Focus', active: ['Focus', 'Energy'], symbol: '😊', label: { en: 'Great', ru: 'Отлично' } },
    { mood: 'Calm', active: ['Calm'], symbol: '🙂', label: { en: 'Good', ru: 'Хорошо' } },
    { mood: 'Breath', active: ['Breath'], symbol: '😐', label: { en: 'Meh', ru: 'Норм' } },
    { mood: 'Anxiety', active: ['Anxiety'], symbol: '😟', label: { en: 'Anxious', ru: 'Тревожно' } },
    { mood: 'Sleep', active: ['Sleep'], symbol: '😴', label: { en: 'Tired', ru: 'Устал' } }
  ];
  const heroImage = '/images/home/hero-night.png';
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <section className="home-v2-atmosphere">
      <div className="home-v2-atmosphere-art" aria-hidden="true">
        {!imageFailed ? (
          <img
            src={heroImage}
            alt=""
            loading="eager"
            onError={() => {
              if (import.meta.env.DEV) console.info('[Luna Home V2 hero image missing]', heroImage);
              setImageFailed(true);
            }}
          />
        ) : null}
      </div>

      <div className="home-v2-atmosphere-copy">
        <p className="home-v2-greeting">{greeting}, {firstName}</p>
        <h1>{headline}</h1>
      </div>

      {moodSaved && activeMood ? (
        <div className="home-v2-mood-saved" role="status">
          <span>{visualMoods.find((item) => item.active.includes(activeMood))?.symbol ?? '◌'}</span>
          <strong>{checkinLine}</strong>
          <div className="home-v2-mood-actions">
            <button type="button" onClick={onCheckinDetails}>{detailsLabel}</button>
            <button type="button" onClick={onChangeMood}>{changeLabel}</button>
          </div>
        </div>
      ) : (
        <div className="home-v2-mood-row" aria-label={checkinLine}>
          {visualMoods.map(({ mood, active, symbol, label }) => (
          <button
            key={mood}
            type="button"
            onClick={() => onMood(mood)}
            disabled={moodSaving}
            className={`home-v2-mood-pill ${activeMood && active.includes(activeMood) ? 'home-v2-mood-pill-active' : ''}`}
            title={moodLabel(mood)}
          >
            <span>{symbol}</span>
            <small>{label[language]}</small>
          </button>
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
