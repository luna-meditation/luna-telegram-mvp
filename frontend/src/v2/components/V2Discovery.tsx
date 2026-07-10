import { ArrowRight, MessageCircle, Sparkles } from 'lucide-react';
import type { Meditation } from '../../api';

type MeditationView = {
  title: string;
  subtitle: string;
  description: string;
};

type V2DiscoveryProps = {
  title: string;
  viewAllLabel: string;
  meditations: Meditation[];
  onViewAll: () => void;
  onOpen: (meditation: Meditation) => void;
  meditationView: (meditation: Meditation) => MeditationView;
  categoryLabel: (category: string) => string;
  durationLabel: (seconds: number) => string;
};

export function V2Discovery({ title, viewAllLabel, meditations, onViewAll, onOpen, meditationView, categoryLabel, durationLabel }: V2DiscoveryProps) {
  if (!meditations.length) return null;
  const [featured, ...rest] = meditations;
  const featuredView = meditationView(featured);

  return (
    <section className="home-v2-discovery-grid">
      <div className="home-v2-section-heading home-v2-section-heading-row">
        <h2>{title}</h2>
        <button type="button" onClick={onViewAll} className="home-v2-view-all">{viewAllLabel} →</button>
      </div>
      <div className="home-v2-editorial-rail">
        <button type="button" onClick={() => onOpen(featured)} className="home-v2-feature-tile">
          <img src={featured.cover_image} alt="" loading="lazy" />
          <span>
            <strong>{featuredView.title}</strong>
            <small>{categoryLabel(featured.category)} · {durationLabel(featured.duration)}</small>
          </span>
        </button>
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
  askTitle,
  askBody,
  askAction,
  askMessage,
  onBreath,
  onAsk
}: {
  breathTitle: string;
  breathBody: string;
  askTitle: string;
  askBody: string;
  askAction: string;
  askMessage?: string;
  onBreath: () => void;
  onAsk: () => void;
}) {
  return (
    <section className="home-v2-practice-tiles">
      <button type="button" onClick={onBreath} className="home-v2-practice-tile home-v2-practice-breath">
        <Sparkles size={18} />
        <strong>{breathTitle}</strong>
        <span>{breathBody}</span>
      </button>
      <button type="button" onClick={onAsk} className="home-v2-practice-tile home-v2-ask-tile">
        <MessageCircle size={18} />
        <strong>{askTitle}</strong>
        <span>{askBody}</span>
        <small>{askAction} <ArrowRight size={11} /></small>
        {askMessage ? <em>{askMessage}</em> : null}
      </button>
    </section>
  );
}
