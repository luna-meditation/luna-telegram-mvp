import type { Meditation } from '../../api';

type MeditationView = {
  title: string;
  subtitle: string;
  description: string;
};

export function V2Continue({
  title,
  meditations,
  onOpen,
  meditationView,
  durationLabel
}: {
  title: string;
  meditations: Meditation[];
  onOpen: (meditation: Meditation) => void;
  meditationView: (meditation: Meditation) => MeditationView;
  durationLabel: (seconds: number) => string;
}) {
  if (!meditations.length) return null;

  return (
    <section className="home-v2-continue-strip">
      <h2>{title}</h2>
      <div className={meditations.length === 1 ? 'home-v2-continue-items home-v2-continue-items-single' : 'home-v2-continue-items'}>
        {meditations.slice(0, 2).map((meditation) => {
          const view = meditationView(meditation);
          const progress = Math.max(0, Math.min(100, Number(meditation.history?.completion_percent ?? 0)));
          return (
            <button key={meditation.id} type="button" onClick={() => onOpen(meditation)} className="home-v2-continue-card">
              <img src={meditation.cover_image} alt="" loading="lazy" />
              <span>
                <strong>{view.title}</strong>
                <small>{durationLabel(meditation.duration)}</small>
                <i><b style={{ width: `${progress}%` }} /></i>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
