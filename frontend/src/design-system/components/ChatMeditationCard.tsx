import { Crown, Play } from 'lucide-react';
import type { AppLanguage, Meditation } from '../../api';
import { formatMeditationDuration } from '../../utils/duration';

export function ChatMeditationCard({ meditation, language, hasPremium, onOpen }: {
  meditation: Meditation;
  language: AppLanguage;
  hasPremium: boolean;
  onOpen: () => void;
}) {
  const translation = meditation.translations?.[language];
  const title = translation?.title?.trim() || meditation.title;
  const subtitle = translation?.subtitle?.trim() || meditation.subtitle;
  const description = translation?.description?.trim() || meditation.description;
  const locked = meditation.premium && !hasPremium;
  return (
    <article className="chat-meditation-card" data-testid="chat-meditation-card">
      <img src={meditation.cover_image} alt="" loading="lazy" />
      <div className="chat-meditation-card-copy">
        <strong className="type-card-title">{title}</strong>
        <small className="type-body-small">{subtitle} · {formatMeditationDuration(meditation.duration, language)} · {meditation.premium ? 'Premium' : (language === 'ru' ? 'Бесплатно' : 'Free')}</small>
        <span>{description}</span>
      </div>
      <button type="button" className="chat-meditation-card-action" onClick={onOpen} aria-label={locked ? `${language === 'ru' ? 'Открыть Premium' : 'Open Premium'}: ${title}` : `${language === 'ru' ? 'Начать практику' : 'Start practice'}: ${title}`}>
        {locked ? <Crown size={15} aria-hidden="true" /> : <Play size={15} fill="currentColor" aria-hidden="true" />}
        {locked ? (language === 'ru' ? 'Открыть Premium' : 'Open Premium') : (language === 'ru' ? 'Начать практику' : 'Start practice')}
      </button>
    </article>
  );
}
