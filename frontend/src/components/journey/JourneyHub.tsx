import { useEffect, type MutableRefObject, type ReactNode } from 'react';
import type { AppLanguage } from '../../api';
import { progressCopy } from '../progress/progressCopy';
import './journeyHub.css';

export type JourneyHubTab = 'journey' | 'garden';

type JourneyHubProps = {
  activeTab: JourneyHubTab;
  language: AppLanguage;
  journey: ReactNode;
  garden: ReactNode;
  scrollPositions: MutableRefObject<Record<JourneyHubTab, number>>;
  onTabChange: (tab: JourneyHubTab) => void;
};

export function JourneyHub({ activeTab, language, journey, garden, scrollPositions, onTabChange }: JourneyHubProps) {
  const t = progressCopy[language];

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollPositions.current[activeTab] ?? 0, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, scrollPositions]);

  useEffect(() => () => {
    scrollPositions.current[activeTab] = window.scrollY;
  }, [activeTab, scrollPositions]);

  const selectTab = (nextTab: JourneyHubTab) => {
    if (nextTab === activeTab) return;
    scrollPositions.current[activeTab] = window.scrollY;
    onTabChange(nextTab);
  };

  return (
    <div className={`journey-hub journey-hub-${activeTab}`}>
      <header className="journey-hub-header">
        <h2>{activeTab === 'journey' ? t.progress : t.moonGarden}</h2>
        <p>{activeTab === 'journey' ? t.subtitle : t.gardenHubSubtitle}</p>
      </header>
      <div className="journey-hub-tabs" role="tablist" aria-label={t.journeyHub}>
        <button type="button" role="tab" aria-selected={activeTab === 'journey'} className={activeTab === 'journey' ? 'is-active' : ''} onClick={() => selectTab('journey')}>
          {t.journeyTab}
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'garden'} className={activeTab === 'garden' ? 'is-active' : ''} onClick={() => selectTab('garden')}>
          {t.gardenTab}
        </button>
      </div>
      <div className={`journey-hub-content ${activeTab === 'garden' ? 'journey-garden-enter' : 'journey-story-enter'}`} role="tabpanel">
        {activeTab === 'journey' ? journey : garden}
      </div>
    </div>
  );
}
