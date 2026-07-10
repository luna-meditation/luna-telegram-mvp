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
  return (
    <section className="home-v2-stage">
      <button type="button" onClick={onOpen} className="home-v2-stage-image">
        <img src={meditation.cover_image} alt="" loading="eager" />
        <span className="home-v2-stage-badge">{label}</span>
        <span className="home-v2-stage-access">{meditation.premium ? premiumLabel : freeLabel}</span>
        <span className="home-v2-stage-play"><Play size={20} fill="currentColor" /></span>
      </button>

      <div className="home-v2-stage-copy">
        <p className="home-v2-stage-meta">{categoryLabel} · {durationLabel}</p>
        <h1 className="home-v2-stage-title">{view.title}</h1>
        <p className="home-v2-stage-subtitle">{view.subtitle || view.description}</p>
      </div>

      <div className="home-v2-mood-dock" aria-label={checkinLine}>
        {moods.map((mood) => (
          <button
            key={mood}
            type="button"
            onClick={() => onMood(mood)}
            className={`home-v2-mood-dot ${activeMood === mood ? 'home-v2-mood-dot-active' : ''}`}
          >
            <span>{moodLabel(mood)}</span>
          </button>
        ))}
      </div>
      <div className="home-v2-checkin-note">
        <p>{checkinLine}</p>
        {checkinMeta ? <span>{checkinMeta}</span> : null}
      </div>
    </section>
  );
}

export function V2HeroFallback({ title, body }: { title: string; body: string }) {
  return (
    <section className="home-v2-stage home-v2-stage-empty">
      <div className="home-v2-stage-copy">
        <h1 className="home-v2-stage-title">{title}</h1>
        <p className="home-v2-stage-subtitle">{body}</p>
      </div>
    </section>
  );
}
