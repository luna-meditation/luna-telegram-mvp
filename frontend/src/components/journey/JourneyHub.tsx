import { useEffect, type MutableRefObject, type ReactNode } from 'react';
import type { AppLanguage } from '../../api';
import { PageHeader } from '../../design-system/components/PageHeader';
import { SegmentedTabs } from '../../design-system/components/SegmentedTabs';
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
      <PageHeader title={activeTab === 'journey' ? t.progress : t.moonGarden} subtitle={activeTab === 'journey' ? t.subtitle : t.gardenHubSubtitle} />
      <SegmentedTabs
        value={activeTab}
        onChange={selectTab}
        ariaLabel={t.journeyHub}
        className="journey-hub-tabs"
        tabs={[{ id: 'journey', label: t.journeyTab }, { id: 'garden', label: t.gardenTab }]}
      />
      <div className={`journey-hub-content ${activeTab === 'garden' ? 'journey-garden-enter' : 'journey-story-enter'}`} role="tabpanel">
        {activeTab === 'journey' ? journey : garden}
      </div>
    </div>
  );
}
