import { ArrowUpRight, Flame, Flower2, NotebookPen, Sprout } from 'lucide-react';
import type { AppLanguage, ProfileStats } from '../api';
import { luna2Copy } from './copy';
import { SectionBack } from './ExplorePage';

export function ProfileOverview({ language, profile, onWallet, onJourney, onActivity, onAchievements }: {
  language: AppLanguage; profile: ProfileStats | null; onWallet: () => void; onJourney: () => void; onGarden: () => void; onActivity: () => void; onAchievements: () => void;
}) {
  const t = luna2Copy[language];
  const seeds = profile ? (profile.moonSeedsAvailable ?? profile.moonSeeds ?? 0) : '—';
  return <section className="luna2-profile-overview" aria-label={t.journey}>
    <div className="premium-profile-stats">
      <button onClick={onWallet}><strong>{seeds}</strong><small>Moon Seeds</small></button>
      <button onClick={onJourney}><strong>{profile?.currentWeek?.activeDays??'—'}</strong><small>{language==='en'?'Active days · week':'Активных дней · неделя'}</small></button>
      <button onClick={onAchievements}><strong>{profile?.achievements?.unlocked??'—'}</strong><small>{t.achievements}</small></button>
    </div>
    <div className="premium-profile-links">
      <button type="button" className="premium-profile-link luna2-activity-entry" onClick={onActivity}><NotebookPen size={23}/><span><strong>{language==='en'?'My journal':'Мой дневник'}</strong><small>{t.activityBody}</small></span><ArrowUpRight size={18}/></button>
      <button type="button" className="premium-profile-link luna2-journey-entry" onClick={onJourney}><Flame size={23}/><span><strong>{language==='en'?'Achievements & journey':'Достижения и путь'}</strong><small>{t.streak}: {profile?.currentStreak??'—'} {t.days}</small></span><ArrowUpRight size={18}/></button>
    </div>
  </section>;
}

export function WalletPage({ language, profile, onBack, onGarden }: {
  language: AppLanguage; profile: ProfileStats | null; onBack: () => void; onGarden: () => void;
}) {
  const t = luna2Copy[language];
  return <div className="luna2-page luna2-wallet" data-testid="moon-seeds-wallet">
    <SectionBack language={language} onBack={onBack} /><header className="luna2-page-heading"><p>{t.wallet}</p><h1>{t.walletBody}</h1></header>
    <section className="luna2-balance-card"><Sprout size={32} /><span>{t.available}</span><strong>{profile ? (profile.moonSeedsAvailable ?? profile.moonSeeds ?? 0) : '—'}</strong><p>{t.earned}: {profile?.moonSeedsEarnedTotal ?? '—'}</p></section>
    <p className="luna2-preview-notice">{t.walletNote}</p><button type="button" className="luna2-text-action" onClick={onGarden}><Flower2 size={20} />{t.garden}<ArrowUpRight size={18} /></button>
  </div>;
}
