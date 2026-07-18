import { useState } from 'react';
import { Brain, CloudMoon, Focus, HeartPulse, Sparkles, type LucideIcon } from 'lucide-react';

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
  const visualMoods: Array<{ mood: MoodChip; active: MoodChip[]; icon: LucideIcon; label: Record<'en' | 'ru', string> }> = [
    { mood: 'Focus', active: ['Focus', 'Energy'], icon: Sparkles, label: { en: 'Great', ru: 'Отлично' } },
    { mood: 'Calm', active: ['Calm'], icon: Focus, label: { en: 'Good', ru: 'Хорошо' } },
    { mood: 'Breath', active: ['Breath'], icon: HeartPulse, label: { en: 'Meh', ru: 'Норм' } },
    { mood: 'Anxiety', active: ['Anxiety'], icon: Brain, label: { en: 'Anxious', ru: 'Тревожно' } },
    { mood: 'Sleep', active: ['Sleep'], icon: CloudMoon, label: { en: 'Tired', ru: 'Устал' } }
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

      {showCheckinToast ? (
        <div className="home-v2-checkin-toast" role="status">
          <span aria-hidden="true">✓</span>
          <strong>{checkinToast}</strong>
        </div>
      ) : null}

      {moodSaved && activeMood ? (
        <div className="home-v2-mood-saved">
          {(() => { const SavedIcon = visualMoods.find((item) => item.active.includes(activeMood))?.icon ?? Focus; return <span><SavedIcon size={16} aria-hidden="true" /></span>; })()}
          <strong>{checkinLine}</strong>
          <div className="home-v2-mood-actions">
            <button type="button" onClick={onCheckinDetails}>{changeLabel}</button>
          </div>
        </div>
      ) : (
        <div className="home-v2-mood-row" aria-label={checkinLine}>
          {visualMoods.map(({ mood, active, icon: Icon, label }) => (
          <button
            key={mood}
            type="button"
            onClick={() => onMood(mood)}
            disabled={moodSaving}
            className={`home-v2-mood-pill ${activeMood && active.includes(activeMood) ? 'home-v2-mood-pill-active' : ''}`}
            title={moodLabel(mood)}
          >
            <span><Icon size={15} aria-hidden="true" /></span>
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
