import type { ReactNode } from 'react';
import type { AppLanguage } from '../../api';
import { PageHeader } from '../../design-system/components/PageHeader';
import { progressCopy } from '../progress/progressCopy';
import './journeyHub.css';

type JourneyHubProps = {
  language: AppLanguage;
  journey: ReactNode;
  garden: ReactNode;
};

export function JourneyHub({ language, journey, garden }: JourneyHubProps) {
  const t = progressCopy[language];

  return (
    <div className="journey-hub journey-hub-unified">
      <PageHeader title={t.progress} subtitle={t.subtitle} />
      <div className="journey-hub-content journey-story-enter">
        {journey}
        <div className="journey-hub-garden" aria-label={t.moonGarden}>
          {garden}
        </div>
      </div>
    </div>
  );
}
