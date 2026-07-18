import type { AppLanguage } from '../../api';
import { BrandLogo } from './BrandLogo';

export function AppHeader({
  statusLabel,
  language,
  languageLabel,
  onLanguageChange
}: {
  statusLabel: string;
  language: AppLanguage;
  languageLabel: string;
  onLanguageChange: (language: AppLanguage) => void;
}) {
  return (
    <header className="app-header" data-testid="app-header">
      <div className="app-header-brand">
        <BrandLogo size={28} eager />
        <span className="app-header-wordmark">Luna Meditation</span>
      </div>
      <div className="app-header-actions">
        <span className="app-status-pill">{statusLabel}</span>
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
