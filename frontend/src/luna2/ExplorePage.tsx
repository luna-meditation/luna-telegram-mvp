import { ArrowLeft, ArrowUpRight, BookOpen, Sparkles, Stars, Wind } from 'lucide-react';
import type { AppLanguage } from '../api';
import { luna2Copy } from './copy';
import { tarotCopy } from '../features/tarot/copy';
import {OptimizedImage} from '../design-system/components/OptimizedImage';
import {featureFlags} from '../config/featureFlags';
import {UniverseInvitation} from './PersonalMemoryEditor';

export type ExploreCategory = 'tarot' | 'astrology' | 'meditations' | 'breathwork';
export const exploreCategories: readonly ExploreCategory[] = ['tarot', 'astrology', 'meditations', 'breathwork'];

export function SectionBack({ language, onBack }: { language: AppLanguage; onBack: () => void }) {
  return <button type="button" className="luna2-back" onClick={onBack}><ArrowLeft size={18} />{luna2Copy[language].back}</button>;
}

export function CelestialArt({ kind,sizes='(max-width: 600px) calc((100vw - 70px) / 2), 240px' }: { kind: 'tarot' | 'astrology';sizes?:string }) {
  const source = kind === 'tarot' ? '/images/explore/tarot-celestial-v1.png' : '/images/explore/astrology-zodiac-v1.png';
  return <OptimizedImage className={`luna2-celestial-art luna2-${kind}-art`} src={source} sizes={sizes} width={1280} height={1280} alt="" aria-hidden="true" />;
}

export function ExplorePage({ language, tarotEnabled = false, onOpen }: { language: AppLanguage; tarotEnabled?: boolean; onOpen: (category: ExploreCategory) => void }) {
  const t = luna2Copy[language];
  const icons = { tarot: Sparkles, astrology: Stars, meditations: BookOpen, breathwork: Wind };
  const descriptions = { tarot: t.tarotBody, astrology: t.astrologyBody, meditations: t.meditationBody, breathwork: t.breathBody };
  return (
    <div className="luna2-explore luna2-page" data-testid="luna2-explore">
      <header className="luna2-page-heading"><p>{t.explore}</p><h1>{t.exploreTitle}</h1><span>{t.exploreBody}</span></header>
      <section className="luna2-category-grid" aria-label={t.explore}>
        {exploreCategories.map(kind => {
          const Icon = icons[kind];
          const upcoming = kind === 'tarot' || kind === 'astrology';
          return <button type="button" key={kind} data-category={kind} className={`luna2-category luna2-category-${kind} ${upcoming ? 'is-featured' : ''}`} onClick={() => onOpen(kind)}>
            <span className="luna2-category-top"><Icon size={18} />{upcoming ? <small>{kind === 'tarot' && tarotEnabled ? tarotCopy[language].free : t.soon}</small> : <ArrowUpRight size={18} />}</span>
            <div className="luna2-category-art" aria-hidden="true">
              {upcoming ? <CelestialArt kind={kind} /> : kind === 'meditations' ? <OptimizedImage className="luna2-category-landscape" src="/images/home/hero-day.png" sizes="45vw" alt="" /> : <span className="luna2-mini-ring" />}
            </div>
            <span className="luna2-category-copy"><strong>{t[kind]}</strong><span>{descriptions[kind]}</span></span>
          </button>;
        })}
      </section>
    </div>
  );
}

export function FeaturePreview({ kind, language, featureEnabled, onBack, onMeditate }: {
  kind: 'tarot' | 'astrology'; language: AppLanguage; featureEnabled: boolean; onBack: () => void; onMeditate: () => void;
}) {
  const t = luna2Copy[language];
  const tarot = kind === 'tarot';
  return <div className="luna2-page luna2-preview" data-testid={`${kind}-preview`} data-feature-enabled={featureEnabled}>
    <SectionBack language={language} onBack={onBack} />
    <section className={`luna2-preview-hero luna2-preview-${kind}`}>
      <p className="luna2-eyebrow">{t.preview} · {t.soon}</p><CelestialArt kind={kind} />
      <h1>{tarot ? t.tarotPreviewTitle : t.astrologyPreviewTitle}</h1>
      <p>{tarot ? t.tarotPreviewBody : t.astrologyPreviewBody}</p>
    </section>
    {featureFlags.personal_memory&&<UniverseInvitation language={language}/>}
    <div className="luna2-preview-details">{(tarot ? t.tarotDetails : t.astrologyDetails).map(label => <span key={label}><Sparkles size={16} />{label}</span>)}</div>
    <p className="luna2-preview-notice" role="status">{t.previewNotice}</p>
    <section className="luna2-available-now"><p>{t.availableNow}</p><button type="button" onClick={onMeditate}>{t.openMeditations}<ArrowUpRight size={18} /></button></section>
  </div>;
}
