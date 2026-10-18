import { ArrowUpRight, ChevronRight, Flame, Flower2, NotebookPen, Sprout, Orbit, Crown, Users, Settings, type LucideIcon } from 'lucide-react';
import type { AppLanguage, ProfileStats } from '../api';
import { luna2Copy } from './copy';
import { SectionBack } from './ExplorePage';

export function ProfileOverview({ language, profile, onWallet, onJourney, onActivity, onAchievements, onCosmos, onMembership, onInvite, onSettings }: {
  language: AppLanguage; profile: ProfileStats | null; onWallet: () => void; onJourney: () => void; onGarden: () => void; onActivity: () => void; onAchievements: () => void;
  onCosmos?:()=>void;onMembership?:()=>void;onInvite?:()=>void;onSettings?:()=>void;
}) {
  const t = luna2Copy[language];
  const seeds = profile ? (profile.moonSeedsAvailable ?? profile.moonSeeds ?? 0) : '—';
  const en=language==='en';
  const rows:Array<{id:string;icon:LucideIcon;title:string;description?:string;action:()=>void}>=[];
  if(onCosmos)rows.push({id:'cosmos',icon:Orbit,title:en?'My Universe':'Мой космос',description:en?'Your story, discoveries and memory':'Твоя история, открытия и память',action:onCosmos});
  if(onMembership)rows.push({id:'membership',icon:Crown,title:en?'Membership & Moon Seeds':'Подписка и Moon Seeds',action:onMembership});
  rows.push({id:'journal',icon:NotebookPen,title:en?'My journal':'Мой дневник',action:onActivity},{id:'journey',icon:Flame,title:en?'Achievements & journey':'Достижения и путь',action:onJourney});
  if(onInvite)rows.push({id:'invite',icon:Users,title:en?'Invite friends':'Пригласить друзей',action:onInvite});
  if(onSettings)rows.push({id:'settings',icon:Settings,title:en?'Settings':'Настройки',action:onSettings});
  return <section className="luna2-profile-overview luna-design3-profile" aria-label={en?'Your Luna':'Твоя Luna'}>
    <div className="premium-profile-stats">
      <button onClick={onWallet}><strong>{seeds}</strong><small>Moon Seeds</small></button>
      <button onClick={onJourney}><strong>{profile?.currentStreak??'—'}</strong><small>{en?'Day streak':'Дней подряд'}</small></button>
      <button onClick={onAchievements}><strong>{profile?.achievements?.unlocked??'—'}</strong><small>{t.achievements}</small></button>
    </div>
    <nav className="luna-design3-profile-links" aria-label={en?'Profile destinations':'Разделы профиля'}>{rows.map(({id,icon:Icon,title,description,action})=><button type="button" key={id} data-profile-destination={id} className={`luna-design3-profile-row ${id==='cosmos'?'is-primary':''}`} onClick={action}><span className="luna-design3-row-icon"><Icon size={22}/></span><span><strong>{title}</strong>{description&&<small>{description}</small>}</span><ChevronRight size={18}/></button>)}</nav>
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
