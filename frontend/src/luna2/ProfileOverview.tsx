import { ArrowUpRight, Flame, Flower2, NotebookPen, Sprout, Trophy } from 'lucide-react';
import type { AppLanguage, Meditation, PlaybackHistory, ProfileStats, WellnessSummary } from '../api';
import { luna2Copy } from './copy';
import { SectionBack } from './ExplorePage';

const gardenArtwork = ['level-0-empty-garden', 'level-1-first-bloom', 'level-2-lantern-glow', 'level-3-stone-path', 'level-4-twin-bloom', 'level-5-moon-bridge', 'level-6-reflection-garden', 'level-7-full-moon-garden'];

export function ProfileOverview({ language, profile, onWallet, onJourney, onGarden, onActivity, onAchievements }: {
  language: AppLanguage; profile: ProfileStats | null; onWallet: () => void; onJourney: () => void; onGarden: () => void; onActivity: () => void; onAchievements: () => void;
}) {
  const t = luna2Copy[language];
  const seeds = profile ? (profile.moonSeedsAvailable ?? profile.moonSeeds ?? 0) : '—';
  const gardenImage = gardenArtwork[Math.max(0, Math.min(7, Math.floor(profile?.gardenLevel ?? 0)))];
  return <section className="luna2-profile-overview" aria-label={t.journey}>
    <button type="button" className="luna2-wallet-entry" onClick={onWallet}><span className="luna2-wallet-copy"><span className="luna2-wallet-label"><Sprout size={20} /><strong>{t.wallet}</strong></span><small>{t.available}</small><b>{seeds}</b><small>{t.walletBody}</small></span><span className="luna2-wallet-emblem" aria-hidden="true"><Sprout size={43} /></span><ArrowUpRight size={18} /></button>
    <button type="button" className="luna2-journey-entry" onClick={onJourney}><Flame size={24} /><span><strong>{t.journey}</strong><small>{t.streak}</small></span><b>{profile?.currentStreak ?? '—'} <small>{t.days}</small></b><ArrowUpRight size={18} /></button>
    <div className="luna2-profile-pair">
      <button type="button" className="luna2-achievements-entry" onClick={onAchievements}><span className="luna2-achievement-emblem"><Trophy size={30} /></span><strong>{t.achievements}</strong><span>{profile?.achievements?.unlocked ?? '—'} {t.unlocked}</span></button>
      <button type="button" className="luna2-garden-entry" onClick={onGarden}><img src={`/assets/moon-garden/${gardenImage}.png`} alt="" aria-hidden="true" loading="lazy" /><Flower2 size={22} /><strong>{t.garden}</strong><span>{t.gardenLevel} {profile?.gardenLevel ?? '—'}</span></button>
    </div>
    <button type="button" className="luna2-activity-entry" onClick={onActivity}><NotebookPen size={22} /><span><strong>{t.activity}</strong><small>{t.activityBody}</small></span><ArrowUpRight size={18} /></button>
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

export function ActivityPage({ language, history, meditations, wellness, onBack, onOpen }: {
  language: AppLanguage; history: PlaybackHistory[]; meditations: Meditation[]; wellness: WellnessSummary | null; onBack: () => void; onOpen: (meditation: Meditation) => void;
}) {
  const t = luna2Copy[language];
  const moods = language === 'en' ? { calm: 'Calm', stressed: 'Stressed', tired: 'Tired', anxious: 'Anxious', focused: 'Focused', low_energy: 'Low energy' } : { calm: 'Спокойствие', stressed: 'Напряжение', tired: 'Усталость', anxious: 'Тревога', focused: 'Собранность', low_energy: 'Мало энергии' };
  const date = (value: string) => new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'short' }).format(new Date(value));
  return <div className="luna2-page luna2-activity" data-testid="journal-activity">
    <SectionBack language={language} onBack={onBack} /><header className="luna2-page-heading"><p>{t.profile}</p><h1>{t.activity}</h1><span>{t.activityBody}</span></header>
    <section><h2>{t.history}</h2>{history.length ? history.map(item => {
      const meditation = meditations.find(m => m.id === item.meditation_id) ?? item.meditation;
      const title = meditation?.translations?.[language]?.title || meditation?.title || t.noMeditation;
      return <button key={item.id} type="button" disabled={!meditation} onClick={() => meditation && onOpen(meditation)} className="luna2-activity-row"><BookHistoryIcon /><span><strong>{title}</strong><small>{item.completed ? t.complete : t.inProgress} · {date(item.last_played)}</small></span><ArrowUpRight size={18} /></button>;
    }) : <p className="luna2-empty">{t.historyEmpty}</p>}</section>
    <section><h2>{t.journal}</h2><p className="luna2-journal-note">{t.journalNote}</p>{wellness?.weeklyCheckins?.length ? wellness.weeklyCheckins.map(item => <article key={item.id ?? item.local_date} className="luna2-activity-row"><NotebookPen size={20} /><span><strong>{moods[item.mood]}</strong><small>{date(`${item.local_date}T12:00:00`)}</small></span></article>) : <p className="luna2-empty">{t.journalEmpty}</p>}</section>
  </div>;
}

function BookHistoryIcon() { return <NotebookPen size={20} />; }
