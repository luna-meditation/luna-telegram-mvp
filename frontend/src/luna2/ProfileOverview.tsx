import { ArrowUpRight, ChevronRight, Flower2, Sprout, Crown, Users, Settings, type LucideIcon } from 'lucide-react';
import type { AppLanguage, ProfileStats } from '../api';
import { luna2Copy } from './copy';
import { SectionBack } from './ExplorePage';
import './profile-simple.css';

export function ProfileOverview({ language, profile, onWallet, onCosmos, onMembership, onInvite, onSettings }: {
 language:AppLanguage;profile:ProfileStats|null;onWallet:()=>void;onJourney:()=>void;onGarden:()=>void;onActivity:()=>void;onAchievements:()=>void;
 onCosmos?:()=>void;onMembership?:()=>void;onInvite?:()=>void;onSettings?:()=>void;onPersonal?:()=>void;onStatus?:()=>void;
}){
 const en=language==='en',seeds=profile?(profile.moonSeedsAvailable ?? profile.moonSeeds ?? 0):'—';
 const row=(id:string,Icon:LucideIcon,title:string,action:()=>void,value?:string)=> <button type="button" data-profile-destination={id} key={id} className="profile-quiet-row" onClick={action}><Icon size={19} strokeWidth={1.4}/><span>{title}</span>{value&&<small>{value}</small>}<ChevronRight size={16}/></button>;
 return <section className="luna2-profile-overview luna-design3-profile profile-simple" aria-label={en?'Your Luna':'Твоя Luna'}>
  {onCosmos&&<button type="button" data-profile-destination="cosmos" className="profile-cosmos-entry" onClick={onCosmos}><img className="profile-cosmos-jewel" src="/assets/luna-ux/lunar-jewel-v1-192.webp" srcSet="/assets/luna-ux/lunar-jewel-v1-96.webp 96w, /assets/luna-ux/lunar-jewel-v1-192.webp 192w" sizes="66px" width={66} height={66} alt="" aria-hidden="true" decoding="async"/><span><strong>{en?'My Cosmos':'Мой космос'}</strong><small>{en?'Your own universe':'Твоя личная вселенная'}</small></span><ArrowUpRight size={20}/></button>}
  <nav className="profile-quiet-groups" aria-label={en?'Account & subscription':'Аккаунт и подписка'}>
   {onMembership&&row('membership',Crown,en?'My subscription':'Моя подписка',onMembership)}
   {row('wallet',Sprout,'Moon Seeds',onWallet,String(seeds))}
   {onInvite&&row('invite',Users,en?'Invite friends':'Пригласить друзей',onInvite)}
   {onSettings&&row('settings',Settings,en?'Settings & privacy':'Настройки и приватность',onSettings)}
  </nav>
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
