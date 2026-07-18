import { ArrowRight, MessageCircle, Sparkles } from 'lucide-react';
import type { Meditation } from '../../api';
import { MeditationCard } from '../../design-system/components/MeditationCard';

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
  premiumLabel: string;
};

export function V2Discovery({ title, viewAllLabel, meditations, onViewAll, onOpen, meditationView, categoryLabel, durationLabel, premiumLabel }: V2DiscoveryProps) {
  if (!meditations.length) return null;

  return (
    <section className="home-v2-discovery-grid">
      <div className="home-v2-section-heading home-v2-section-heading-row">
        <h2>{title}</h2>
        <button type="button" onClick={onViewAll} className="home-v2-view-all">{viewAllLabel} →</button>
      </div>
      <div className="home-v2-editorial-rail">
        {meditations.slice(0, 4).map((meditation) => {
          const view = meditationView(meditation);
          return (
            <MeditationCard
              key={meditation.id}
              variant="tile"
              meditation={meditation}
              title={view.title}
              metadata={`${categoryLabel(meditation.category)} · ${durationLabel(meditation.duration)}`}
              premiumLabel={premiumLabel}
              onOpen={() => onOpen(meditation)}
            />
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
