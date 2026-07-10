import { useState } from 'react';

type MoodChip = 'Sleep' | 'Calm' | 'Focus' | 'Anxiety' | 'Breath' | 'Energy';

type V2HeroProps = {
  greeting: string;
  firstName: string;
  headline: string;
  moods: MoodChip[];
  activeMood: MoodChip;
  moodLabel: (mood: MoodChip) => string;
  checkinLine: string;
  onMood: (mood: MoodChip) => void;
};

export function V2Hero({
  greeting,
  firstName,
  headline,
  moods,
  activeMood,
  moodLabel,
  checkinLine,
  onMood
}: V2HeroProps) {
  const moodSymbols: Record<MoodChip, string> = {
    Sleep: '☾',
    Calm: '☺',
    Focus: '✦',
    Anxiety: '○',
    Breath: '〰',
    Energy: '⚡'
  };
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

      <div className="home-v2-mood-row" aria-label={checkinLine}>
        {moods.map((mood) => (
          <button
            key={mood}
            type="button"
            onClick={() => onMood(mood)}
            className={`home-v2-mood-pill ${activeMood === mood ? 'home-v2-mood-pill-active' : ''}`}
          >
            <span>{moodSymbols[mood]}</span>
            <small>{moodLabel(mood)}</small>
          </button>
        ))}
      </div>
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
