import { Play } from 'lucide-react';
import type { Meditation } from '../../api';

type MeditationView = {
  title: string;
  subtitle: string;
  description: string;
};

export function V2Recommendation({
  title,
  meditation,
  view,
  categoryLabel,
  durationLabel,
  premiumLabel,
  freeLabel,
  checkinLine,
  checkinMeta,
  onOpen
}: {
  title: string;
  meditation: Meditation;
  view: MeditationView;
  categoryLabel: string;
  durationLabel: string;
  premiumLabel: string;
  freeLabel: string;
  checkinLine: string;
  checkinMeta?: string;
  onOpen: () => void;
}) {
  return (
    <section className="home-v2-recommendation-section">
      <div className="home-v2-section-heading home-v2-section-heading-row">
        <h2>{title}</h2>
        <span>{checkinMeta || checkinLine}</span>
      </div>
      <button type="button" onClick={onOpen} className="home-v2-recommendation">
        <img src={meditation.cover_image} alt="" loading="lazy" />
        <span className="home-v2-recommendation-copy">
          <small>{categoryLabel} · {durationLabel}</small>
          <strong>{view.title}</strong>
          <em>{view.subtitle || view.description}</em>
        </span>
        <span className="home-v2-recommendation-side">
          <i>{meditation.premium ? premiumLabel : freeLabel}</i>
          <b><Play size={15} fill="currentColor" /></b>
        </span>
      </button>
    </section>
  );
}
