import { Crown, Heart, Lock } from 'lucide-react';
import type { Meditation } from '../../api';

type MeditationCardProps = {
  meditation: Meditation;
  title: string;
  description?: string;
  metadata: string;
  locked?: boolean;
  favorite?: boolean;
  showPopular?: boolean;
  hasProgress?: boolean;
  premiumLabel: string;
  popularLabel?: string;
  resumeLabel?: string;
  onOpen: () => void;
  onFavorite?: () => void;
  variant?: 'row' | 'tile';
};

export function MeditationCard({
  meditation,
  title,
  description,
  metadata,
  locked = false,
  favorite = false,
  showPopular = false,
  hasProgress = false,
  premiumLabel,
  popularLabel,
  resumeLabel,
  onOpen,
  onFavorite,
  variant = 'row'
}: MeditationCardProps) {
  if (variant === 'tile') {
    return (
      <button type="button" onClick={onOpen} className="meditation-card meditation-card-tile">
        <img src={meditation.cover_image} alt="" loading="lazy" />
        <span className="meditation-card-tile-copy">
          <strong className="type-card-title">{title}</strong>
          <small>{metadata}</small>
          {meditation.premium ? <Crown size={14} aria-label={premiumLabel} /> : null}
        </span>
      </button>
    );
  }

  return (
    <article className="meditation-card meditation-card-row">
      <button type="button" onClick={onOpen} className="meditation-card-cover">
        <img src={meditation.cover_image} alt="" className={locked ? 'is-locked' : ''} loading="lazy" />
        {locked ? <Lock size={20} aria-label={premiumLabel} /> : null}
      </button>
      <button type="button" onClick={onOpen} className="meditation-card-copy">
        <span className="meditation-card-title-line">
          <strong className="type-card-title">{title}</strong>
          {meditation.premium ? <Crown size={13} aria-label={premiumLabel} /> : null}
        </span>
        <small>{metadata}</small>
        {description ? <p>{description}</p> : null}
        {showPopular || hasProgress ? (
          <span className="meditation-card-badges">
            {showPopular ? <em>{popularLabel}</em> : null}
            {hasProgress ? <em>{resumeLabel}</em> : null}
          </span>
        ) : null}
      </button>
      {onFavorite ? (
        <button type="button" onClick={onFavorite} className="meditation-card-favorite" aria-label={favorite ? `Remove ${title} from favorites` : `Add ${title} to favorites`} aria-pressed={favorite}>
          <Heart size={17} className={favorite ? 'is-favorite' : ''} aria-hidden="true" />
        </button>
      ) : null}
    </article>
  );
}
