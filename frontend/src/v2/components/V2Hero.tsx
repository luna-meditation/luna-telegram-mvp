import { Play } from 'lucide-react';
import type { Meditation } from '../../api';

type MoodChip = 'Sleep' | 'Calm' | 'Focus' | 'Anxiety' | 'Breath' | 'Energy';

type MeditationView = {
  title: string;
  subtitle: string;
  description: string;
};

type V2HeroProps = {
  meditation: Meditation;
  label: string;
  greeting: string;
  firstName: string;
  headline: string;
  view: MeditationView;
  categoryLabel: string;
  durationLabel: string;
  premiumLabel: string;
  freeLabel: string;
  moods: MoodChip[];
  activeMood: MoodChip;
  moodLabel: (mood: MoodChip) => string;
  checkinLine: string;
  checkinMeta?: string;
  onMood: (mood: MoodChip) => void;
  onOpen: () => void;
};

export function V2Hero({
  meditation,
  label,
  greeting,
  firstName,
  headline,
  view,
  categoryLabel,
  durationLabel,
  premiumLabel,
  freeLabel,
  moods,
  activeMood,
  moodLabel,
  checkinLine,
  checkinMeta,
  onMood,
  onOpen
}: V2HeroProps) {
  const moodSymbols: Record<MoodChip, string> = {
    Sleep: '☾',
    Calm: '☺',
    Focus: '✦',
    Anxiety: '○',
    Breath: '〰',
    Energy: '⚡'
  };

  return (
    <section className="home-v2-atmosphere">
      <div className="home-v2-atmosphere-art" aria-hidden="true">
        <img src={meditation.cover_image} alt="" loading="eager" />
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

      <button type="button" onClick={onOpen} className="home-v2-recommendation">
        <img src={meditation.cover_image} alt="" loading="eager" />
        <span className="home-v2-recommendation-copy">
          <small>{label} · {categoryLabel} · {durationLabel}</small>
          <strong>{view.title}</strong>
          <em>{view.subtitle || view.description}</em>
        </span>
        <span className="home-v2-recommendation-side">
          <i>{meditation.premium ? premiumLabel : freeLabel}</i>
          <b><Play size={16} fill="currentColor" /></b>
        </span>
      </button>

      <div className="home-v2-checkin-line">
        <span>{checkinLine}</span>
        {checkinMeta ? <small>{checkinMeta}</small> : null}
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
