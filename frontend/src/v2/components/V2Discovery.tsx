import { Sparkles } from 'lucide-react';
import type { Meditation } from '../../api';

type MeditationView = {
  title: string;
  subtitle: string;
  description: string;
};

type V2DiscoveryProps = {
  title: string;
  meditations: Meditation[];
  onOpen: (meditation: Meditation) => void;
  meditationView: (meditation: Meditation) => MeditationView;
  categoryLabel: (category: string) => string;
  durationLabel: (seconds: number) => string;
};

export function V2Discovery({ title, meditations, onOpen, meditationView, categoryLabel, durationLabel }: V2DiscoveryProps) {
  if (!meditations.length) return null;
  const [featured, ...rest] = meditations;
  const featuredView = meditationView(featured);

  return (
    <section className="home-v2-discovery-grid">
      <div className="home-v2-section-heading">
        <h2>{title}</h2>
      </div>
      <button type="button" onClick={() => onOpen(featured)} className="home-v2-feature-tile">
        <img src={featured.cover_image} alt="" loading="lazy" />
        <span>
          <strong>{featuredView.title}</strong>
          <small>{categoryLabel(featured.category)} · {durationLabel(featured.duration)}</small>
        </span>
      </button>
      <div className="home-v2-mini-list">
        {rest.slice(0, 3).map((meditation) => {
          const view = meditationView(meditation);
          return (
            <button key={meditation.id} type="button" onClick={() => onOpen(meditation)} className="home-v2-mini-row">
              <img src={meditation.cover_image} alt="" loading="lazy" />
              <span>
                <strong>{view.title}</strong>
                <small>{durationLabel(meditation.duration)}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function V2PracticeTiles({
  breathTitle,
  breathBody,
  insightTitle,
  insightBody,
  insightMeta,
  onBreath
}: {
  breathTitle: string;
  breathBody: string;
  insightTitle: string;
  insightBody?: string;
  insightMeta?: string;
  onBreath: () => void;
}) {
  return (
    <section className="home-v2-practice-tiles">
      <button type="button" onClick={onBreath} className="home-v2-practice-tile home-v2-practice-breath">
        <Sparkles size={18} />
        <strong>{breathTitle}</strong>
        <span>{breathBody}</span>
      </button>
      {insightBody ? (
        <article className="home-v2-practice-tile">
          <small>{insightTitle}</small>
          <p>{insightBody}</p>
          {insightMeta ? <span>{insightMeta}</span> : null}
        </article>
      ) : null}
    </section>
  );
}
