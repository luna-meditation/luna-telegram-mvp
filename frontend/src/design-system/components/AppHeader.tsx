import type { AppLanguage } from '../../api';
import { Sprout } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

export function AppHeader({
  statusLabel,
  language,
  languageLabel,
  onLanguageChange,
  showSeeds = false,
  moonSeeds,
  onWallet
}: {
  statusLabel: string;
  language: AppLanguage;
  languageLabel: string;
  onLanguageChange: (language: AppLanguage) => void;
  showSeeds?: boolean;
  moonSeeds?: number;
  onWallet?: () => void;
}) {
  return (
    <header className={`app-header ${showSeeds ? 'luna2-header' : ''}`} data-testid="app-header">
      <div className="app-header-brand">
        <BrandLogo size={28} eager />
        <span className="app-header-wordmark">{showSeeds ? 'Luna' : 'Luna Meditation'}</span>
      </div>
      <div className="app-header-actions">
        {showSeeds ? <button type="button" className="luna2-header-seeds" onClick={onWallet} aria-label={`Moon Seeds: ${moonSeeds ?? '—'}`}><Sprout size={17} /><span>{moonSeeds ?? '—'}</span></button> : <span className="app-status-pill">{statusLabel}</span>}
        <div className="language-selector" role="group" aria-label={languageLabel}>
          {(['en', 'ru'] as const).map((item) => (
            <button key={item} type="button" onClick={() => onLanguageChange(item)} aria-pressed={language === item}>
              {item.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
