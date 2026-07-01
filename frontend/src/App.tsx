import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle,
  Crown,
  Download,
  Edit3,
  Heart,
  Home,
  Image,
  Lock,
  Pause,
  Play,
  Search,
  SkipBack,
  SkipForward,
  Sparkles,
  Upload,
  User
} from 'lucide-react';
import {
  createInvoiceLink,
  createMeditation,
  deleteMeditation,
  getAccess,
  checkAdmin,
  getCategories,
  getAdminMeditations,
  getFavorites,
  getHistory,
  getMeditations,
  getProfile,
  saveHistory,
  setFavorite,
  syncUser,
  updateMeditation,
  uploadAdminAsset,
  type AccessState,
  type Category,
  type Meditation,
  type MeditationPayload,
  type PlaybackHistory,
  type ProfileStats
} from './api';

type Page = 'home' | 'library' | 'favorites' | 'profile' | 'pricing' | 'player' | 'admin';
type Mood = 'Calm' | 'Stressed' | 'Tired' | 'Anxious' | 'Focused';

const moods: Mood[] = ['Calm', 'Stressed', 'Tired', 'Anxious', 'Focused'];
const rewardMilestones = [7, 14, 30, 100] as const;

const fallbackUser: TelegramWebAppUser = {
  id: 10001,
  first_name: 'Luna'
};

function getTelegram() {
  return window.Telegram?.WebApp;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remaining}`;
}

function App() {
  const telegram = getTelegram();
  const user = telegram?.initDataUnsafe.user ?? fallbackUser;
  const initData = telegram?.initData;
  const [page, setPage] = useState<Page>(window.location.pathname === '/admin' || window.location.hash === '#admin' ? 'admin' : 'home');
  const [mood, setMood] = useState<Mood>('Calm');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [meditations, setMeditations] = useState<Meditation[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [history, setHistory] = useState<PlaybackHistory[]>([]);
  const [favorites, setFavorites] = useState<Meditation[]>([]);
  const [access, setAccess] = useState<AccessState>({ hasPremium: false, plan: 'Free' });
  const [profile, setProfile] = useState<ProfileStats | null>(null);
  const [selectedMeditation, setSelectedMeditation] = useState<Meditation | null>(null);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [adminStatus, setAdminStatus] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [adminMeditations, setAdminMeditations] = useState<Meditation[]>([]);

  const refreshAccount = async () => {
    const [accessState, profileStats, historyList, favoriteList] = await Promise.all([
      getAccess(initData),
      getProfile(initData).catch(() => null),
      getHistory(initData).catch(() => []),
      getFavorites(initData).catch(() => [])
    ]);
    setAccess(accessState);
    setProfile(profileStats);
    setHistory(historyList);
    setFavorites(favoriteList);
  };

  const refreshLibrary = async () => {
    const [categoryList, meditationList] = await Promise.all([getCategories(), getMeditations(initData)]);
    setCategories(categoryList);
    setMeditations(meditationList);
  };

  const refreshAdmin = async () => {
    const meditationList = await getAdminMeditations(initData);
    setAdminMeditations(meditationList);
  };

  useEffect(() => {
    telegram?.ready();
    telegram?.expand();

    async function boot() {
      try {
        await syncUser(user, initData);
        await Promise.all([refreshLibrary(), refreshAccount()]);
      } catch {
        setMeditations([]);
      }
    }

    void boot();
  }, [initData, telegram, user]);

  useEffect(() => {
    if (page !== 'admin') return;

    async function bootAdmin() {
      try {
        await checkAdmin(initData);
        setAdminStatus('allowed');
        await Promise.all([refreshLibrary(), refreshAdmin()]);
      } catch {
        setAdminStatus('denied');
      }
    }

    void bootAdmin();
  }, [initData, page]);

  const historyByMeditation = useMemo(() => {
    return new Map(history.map((item) => [item.meditation_id, item]));
  }, [history]);

  const favoriteIds = useMemo(() => new Set(favorites.map((item) => item.id)), [favorites]);

  const decoratedMeditations = useMemo(() => {
    return meditations.map((meditation) => ({
      ...meditation,
      favorite: favoriteIds.has(meditation.id) || meditation.favorite,
      history: historyByMeditation.get(meditation.id) ?? meditation.history ?? null
    }));
  }, [favoriteIds, historyByMeditation, meditations]);

  const filteredMeditations = useMemo(() => {
    return decoratedMeditations.filter((meditation) => {
      const matchesQuery = meditation.title.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = category === 'all' || meditation.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [category, decoratedMeditations, query]);

  const recommended = useMemo(() => {
    return decoratedMeditations.filter((meditation) => meditation.mood === mood).slice(0, 6);
  }, [decoratedMeditations, mood]);

  const continueListening = useMemo(() => {
    return decoratedMeditations
      .filter((meditation) => meditation.history && meditation.history.last_position > 10 && !meditation.history.completed)
      .sort((a, b) => {
        return new Date(b.history?.last_played ?? 0).getTime() - new Date(a.history?.last_played ?? 0).getTime();
      });
  }, [decoratedMeditations]);

  const popular = useMemo(() => [...decoratedMeditations].sort((a, b) => b.play_count - a.play_count).slice(0, 6), [decoratedMeditations]);
  const newest = useMemo(() => [...decoratedMeditations].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6), [decoratedMeditations]);
  const dailyMeditation = recommended[0] ?? newest[0] ?? decoratedMeditations[0];

  const openMeditation = (meditation: Meditation) => {
    const locked = meditation.premium && !access.hasPremium;
    telegram?.HapticFeedback?.impactOccurred('light');
    if (locked) {
      setSelectedMeditation(meditation);
      setPage('pricing');
      return;
    }
    setSelectedMeditation(meditation);
    setPage('player');
  };

  const toggleFavorite = async (meditation: Meditation) => {
    const next = !favoriteIds.has(meditation.id);
    await setFavorite(meditation.id, next, initData);
    await refreshAccount();
  };

  const buyPlan = async (plan: 'monthly' | 'lifetime') => {
    setPaymentMessage('Creating Telegram Stars invoice...');
    try {
      const { invoiceLink } = await createInvoiceLink(plan, initData);

      if (telegram?.openInvoice) {
        telegram.openInvoice(invoiceLink, (status) => {
          if (status === 'paid') {
            setPaymentMessage('Payment successful. Your Luna access is unlocked.');
            void refreshAccount();
            return;
          }
          setPaymentMessage(status === 'cancelled' ? 'Payment cancelled. You can restart checkout anytime.' : 'Payment is pending. Telegram will confirm it shortly.');
        });
      } else {
        telegram?.openTelegramLink(invoiceLink);
        setPaymentMessage('Invoice opened in Telegram. Complete payment there to unlock access.');
      }
    } catch {
      const botUsername = import.meta.env.VITE_BOT_USERNAME;
      setPaymentMessage('Open the bot and use /plans to complete your Telegram Stars purchase.');
      if (botUsername) telegram?.openTelegramLink(`https://t.me/${botUsername}?start=luna`);
    }
  };

  const nextMeditation = selectedMeditation
    ? decoratedMeditations[(decoratedMeditations.findIndex((item) => item.id === selectedMeditation.id) + 1) % decoratedMeditations.length]
    : undefined;

  return (
    <main className="min-h-screen overflow-hidden bg-night text-cream">
      <div className="fixed inset-0 luna-bg" />
      <section className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-24 pt-5">
        <Header plan={access.plan} streak={profile?.currentStreak ?? 0} />

        {page === 'home' && (
          <HomePage
            firstName={user.first_name ?? 'friend'}
            mood={mood}
            setMood={setMood}
            daily={dailyMeditation}
            recommended={recommended}
            continueListening={continueListening}
            popular={popular}
            newest={newest}
            onOpen={openMeditation}
            onLibrary={() => setPage('library')}
          />
        )}

        {page === 'library' && (
          <LibraryPage
            categories={categories}
            query={query}
            setQuery={setQuery}
            category={category}
            setCategory={setCategory}
            meditations={filteredMeditations}
            hasPremium={access.hasPremium}
            onOpen={openMeditation}
            onFavorite={toggleFavorite}
            onUnlock={() => setPage('pricing')}
          />
        )}

        {page === 'favorites' && (
          <FavoritesPage meditations={decoratedMeditations.filter((item) => favoriteIds.has(item.id))} onOpen={openMeditation} onFavorite={toggleFavorite} />
        )}

        {page === 'pricing' && (
          <PricingPage onBuy={buyPlan} message={paymentMessage} onLibrary={() => setPage('library')} locked={selectedMeditation} />
        )}

        {page === 'profile' && (
          <ProfilePage profile={profile} access={access} firstName={user.first_name ?? 'Luna'} username={user.username} onRestore={refreshAccount} />
        )}

        {page === 'player' && selectedMeditation && (
          <PlayerPage
            meditation={selectedMeditation}
            nextMeditation={nextMeditation}
            favorite={favoriteIds.has(selectedMeditation.id)}
            onFavorite={() => toggleFavorite(selectedMeditation)}
            onSave={(position, duration, completed) =>
              saveHistory({ meditation_id: selectedMeditation.id, last_position: position, duration, completed }, initData).then(refreshAccount)
            }
          />
        )}

        {page === 'admin' && (
          <AdminPage
            status={adminStatus}
            categories={categories}
            meditations={adminMeditations}
            initData={initData}
            onRefresh={async () => {
              await Promise.all([refreshLibrary(), refreshAdmin()]);
            }}
          />
        )}

        {page !== 'admin' && <Nav active={page} onChange={setPage} />}
      </section>
    </main>
  );
}

function Header({ plan, streak }: { plan: string; streak: number }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-lavender/70">Luna</p>
        <h1 className="font-serif text-3xl text-cream">Soft reset</h1>
      </div>
      <div className="rounded-full border border-cream/15 bg-white/10 px-3 py-2 text-xs text-cream shadow-glow backdrop-blur">
        {streak > 0 ? `🔥 ${streak} day streak` : plan}
      </div>
    </div>
  );
}

function HomePage(props: {
  firstName: string;
  mood: Mood;
  setMood: (mood: Mood) => void;
  daily?: Meditation;
  recommended: Meditation[];
  continueListening: Meditation[];
  popular: Meditation[];
  newest: Meditation[];
  onOpen: (meditation: Meditation) => void;
  onLibrary: () => void;
}) {
  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-cream/15 bg-white/10 p-5 shadow-glow backdrop-blur-xl">
        <p className="text-sm text-lavender">Hello, {props.firstName}</p>
        <h2 className="mt-2 text-3xl font-semibold leading-tight">How do you feel today?</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {moods.map((item) => (
            <button
              key={item}
              onClick={() => props.setMood(item)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                props.mood === item ? 'bg-gold text-night' : 'bg-cream/10 text-cream'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      {props.daily ? (
        <PracticeHero label="Daily Meditation" meditation={props.daily} onOpen={() => props.onOpen(props.daily!)} />
      ) : (
        <EmptyState title="No meditations yet" body="Upload your first meditation in the hidden admin page." />
      )}

      <Rail title="Continue Listening" meditations={props.continueListening} onOpen={props.onOpen} />
      <Rail title="Mood Recommendations" meditations={props.recommended} onOpen={props.onOpen} />
      <Rail title="Popular" meditations={props.popular} onOpen={props.onOpen} />
      <Rail title="Newest" meditations={props.newest} onOpen={props.onOpen} />

      <button onClick={props.onLibrary} className="w-full rounded-2xl bg-cream px-5 py-4 font-semibold text-night shadow-glow">
        Open Library
      </button>
    </div>
  );
}

function PracticeHero({ meditation, label, onOpen }: { meditation: Meditation; label: string; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="group relative h-72 w-full overflow-hidden rounded-[30px] border border-cream/15 text-left shadow-glow">
      <img src={meditation.cover_image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70 transition group-hover:scale-105" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-night via-night/40 to-transparent" />
      <div className="absolute bottom-0 p-5">
        <p className="mb-2 inline-flex rounded-full bg-lavender/25 px-3 py-1 text-xs text-cream backdrop-blur">{label}</p>
        <h3 className="text-2xl font-semibold">{meditation.title}</h3>
        <p className="mt-1 text-sm capitalize text-cream/75">
          {meditation.category.replace('-', ' ')} · {formatTime(meditation.duration)}
        </p>
      </div>
    </button>
  );
}

function Rail({ title, meditations, onOpen }: { title: string; meditations: Meditation[]; onOpen: (meditation: Meditation) => void }) {
  if (!meditations.length) return null;

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {meditations.map((meditation) => (
          <button key={meditation.id} onClick={() => onOpen(meditation)} className="w-40 shrink-0 text-left">
            <img src={meditation.cover_image} alt="" className="h-40 w-40 rounded-3xl object-cover shadow-glow" loading="lazy" />
            <p className="mt-2 line-clamp-1 font-semibold">{meditation.title}</p>
            <p className="text-xs capitalize text-lavender">{meditation.category.replace('-', ' ')}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function LibraryPage(props: {
  categories: Category[];
  query: string;
  setQuery: (query: string) => void;
  category: string;
  setCategory: (category: string) => void;
  meditations: Meditation[];
  hasPremium: boolean;
  onOpen: (meditation: Meditation) => void;
  onFavorite: (meditation: Meditation) => void;
  onUnlock: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Library</h2>
      <div className="flex items-center gap-2 rounded-2xl border border-cream/15 bg-white/10 px-4 py-3 backdrop-blur-xl">
        <Search size={18} className="text-lavender" />
        <input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="Search by title" className="w-full bg-transparent text-sm outline-none placeholder:text-cream/45" />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        <FilterPill active={props.category === 'all'} onClick={() => props.setCategory('all')} label="All" />
        {props.categories.map((item) => (
          <FilterPill key={item.slug} active={props.category === item.slug} onClick={() => props.setCategory(item.slug)} label={item.name} />
        ))}
      </div>
      {props.meditations.length ? (
        props.meditations.map((meditation) => (
          <MeditationCard key={meditation.id} meditation={meditation} locked={meditation.premium && !props.hasPremium} onOpen={props.onOpen} onFavorite={props.onFavorite} onUnlock={props.onUnlock} />
        ))
      ) : (
        <EmptyState title="Nothing found" body="Try another search or category." />
      )}
    </div>
  );
}

function FilterPill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`shrink-0 rounded-full px-4 py-2 text-sm ${active ? 'bg-gold text-night' : 'bg-cream/10 text-cream'}`}>
      {label}
    </button>
  );
}

function MeditationCard({ meditation, locked, onOpen, onFavorite, onUnlock }: {
  meditation: Meditation;
  locked: boolean;
  onOpen: (meditation: Meditation) => void;
  onFavorite: (meditation: Meditation) => void;
  onUnlock: () => void;
}) {
  return (
    <article className="rounded-3xl border border-cream/15 bg-white/10 p-3 backdrop-blur-xl">
      <div className="flex gap-3">
        <div className="relative">
          <img src={meditation.cover_image} alt="" className={`h-24 w-24 rounded-2xl object-cover ${locked ? 'blur-sm' : ''}`} loading="lazy" />
          {locked && <Lock className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-gold" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{meditation.title}</h3>
            {meditation.premium && <Crown size={15} className="text-gold" />}
          </div>
          <p className="mt-1 text-xs capitalize text-lavender">{meditation.category.replace('-', ' ')}</p>
          <p className="mt-2 line-clamp-2 text-sm text-cream/70">{meditation.description}</p>
        </div>
        <button onClick={() => onFavorite(meditation)} className="self-start rounded-full bg-cream/10 p-2" aria-label="Favorite meditation">
          <Heart size={17} className={meditation.favorite ? 'fill-gold text-gold' : 'text-cream'} />
        </button>
      </div>
      <button onClick={() => (locked ? onUnlock() : onOpen(meditation))} className={`mt-3 w-full rounded-2xl px-4 py-3 text-sm font-semibold ${locked ? 'bg-gold text-night' : 'bg-cream/15 text-cream'}`}>
        {locked ? 'Unlock Premium' : meditation.history?.last_position ? `Resume at ${formatTime(meditation.history.last_position)}` : 'Play'}
      </button>
    </article>
  );
}

function FavoritesPage({ meditations, onOpen, onFavorite }: { meditations: Meditation[]; onOpen: (meditation: Meditation) => void; onFavorite: (meditation: Meditation) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Favorites</h2>
      {meditations.length ? meditations.map((meditation) => (
        <MeditationCard key={meditation.id} meditation={meditation} locked={false} onOpen={onOpen} onFavorite={onFavorite} onUnlock={() => undefined} />
      )) : <EmptyState title="No favorites yet" body="Save meditations you want to return to." />}
    </div>
  );
}

function PricingPage({ onBuy, message, onLibrary, locked }: { onBuy: (plan: 'monthly' | 'lifetime') => void; message: string; onLibrary: () => void; locked: Meditation | null }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Unlock Premium</h2>
      {locked && <p className="rounded-2xl bg-lavender/15 p-4 text-sm text-cream/80">{locked.title} is part of Luna Premium.</p>}
      <PlanCard title="Free" price="0" features={['Free meditations', 'Basic access']} />
      <PlanCard title="Monthly Access" price="299 Stars" features={['Premium library', '30 days of access', 'Sleep, focus, anxiety, confidence']} action="Choose Monthly" onClick={() => onBuy('monthly')} />
      <PlanCard title="Lifetime Access" price="1999 Stars" features={['Premium library forever', 'Best value', 'Instant Telegram unlock']} action="Choose Lifetime" onClick={() => onBuy('lifetime')} />
      {message && <p className="rounded-2xl bg-lavender/15 p-4 text-sm text-cream/80">{message}</p>}
      {message.includes('unlocked') && <button onClick={onLibrary} className="w-full rounded-2xl bg-cream px-5 py-4 font-semibold text-night">Open Premium Library</button>}
    </div>
  );
}

function PlanCard(props: { title: string; price: string; features: string[]; action?: string; onClick?: () => void }) {
  return (
    <article className="rounded-3xl border border-cream/15 bg-white/10 p-5 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold">{props.title}</h3>
          <p className="mt-1 text-gold">{props.price}</p>
        </div>
        <Crown className="text-gold" />
      </div>
      <ul className="mt-4 space-y-2 text-sm text-cream/75">
        {props.features.map((feature) => <li key={feature}>• {feature}</li>)}
      </ul>
      {props.action && <button onClick={props.onClick} className="mt-5 w-full rounded-2xl bg-gold px-4 py-3 font-semibold text-night">{props.action}</button>}
    </article>
  );
}

function PlayerPage({ meditation, nextMeditation, favorite, onFavorite, onSave }: {
  meditation: Meditation;
  nextMeditation?: Meditation;
  favorite: boolean;
  onFavorite: () => void;
  onSave: (position: number, duration: number, completed?: boolean) => Promise<unknown>;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const saveTimer = useRef<number | undefined>();
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState(meditation.history?.last_position ?? 0);
  const [duration, setDuration] = useState(meditation.duration);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    setPosition(meditation.history?.last_position ?? 0);
    setDuration(meditation.duration);
    setLoading(true);
  }, [meditation]);

  useEffect(() => {
    if (nextMeditation?.audio_file) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'audio';
      link.href = nextMeditation.audio_file;
      document.head.appendChild(link);
      return () => link.remove();
    }
  }, [nextMeditation]);

  const persist = (completed = false) => {
    if (audioRef.current) void onSave(audioRef.current.currentTime, audioRef.current.duration || duration, completed);
  };

  return (
    <div className="space-y-5">
      <div className="relative h-[520px] overflow-hidden rounded-[34px] border border-cream/15 shadow-glow">
        <img src={meditation.cover_image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-night via-night/55 to-night/10" />
        {loading && <div className="absolute left-5 top-5 rounded-full bg-cream/15 px-4 py-2 text-xs text-cream backdrop-blur">Loading audio...</div>}
        {meditation.premium && <div className="absolute right-5 top-5 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-night">Premium</div>}
        <div className="absolute inset-x-0 bottom-0 p-6">
          <p className="text-sm capitalize text-lavender">{meditation.category.replace('-', ' ')}</p>
          <h2 className="mt-1 text-3xl font-semibold">{meditation.title}</h2>
          <p className="mt-2 text-sm text-cream/75">{formatTime(duration)} · {formatTime(Math.max(0, duration - position))} left</p>
          <input className="mt-5 w-full accent-gold" type="range" min={0} max={duration || 1} value={position} onChange={(event) => {
            const next = Number(event.target.value);
            setPosition(next);
            if (audioRef.current) audioRef.current.currentTime = next;
          }} />
          <div className="mt-1 flex justify-between text-xs text-cream/60">
            <span>{formatTime(position)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-cream/15 bg-white/10 p-5 backdrop-blur-xl">
        <div className="flex items-center justify-center gap-4">
          <IconButton label="Rewind 15 seconds" onClick={() => {
            if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 15);
          }}><SkipBack /></IconButton>
          <button onClick={() => {
            if (!audioRef.current) return;
            if (audioRef.current.paused) void audioRef.current.play();
            else audioRef.current.pause();
          }} className="grid h-16 w-16 place-items-center rounded-full bg-cream text-night shadow-glow">
            {playing ? <Pause /> : <Play />}
          </button>
          <IconButton label="Forward 15 seconds" onClick={() => {
            if (audioRef.current) audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 15);
          }}><SkipForward /></IconButton>
        </div>
        <div className="mt-5 flex items-center justify-between">
          <button onClick={onFavorite} className="rounded-full bg-cream/10 px-4 py-2 text-sm"><Heart className={favorite ? 'mr-2 inline fill-gold text-gold' : 'mr-2 inline'} size={16} />Favorite</button>
          <button className="rounded-full bg-cream/10 px-4 py-2 text-sm text-cream/60"><Download className="mr-2 inline" size={16} />Future</button>
          <select value={speed} onChange={(event) => {
            const next = Number(event.target.value);
            setSpeed(next);
            if (audioRef.current) audioRef.current.playbackRate = next;
          }} className="rounded-full bg-night px-3 py-2 text-sm text-cream">
            {[0.75, 1, 1.25, 1.5, 2].map((item) => <option key={item} value={item}>{item}x</option>)}
          </select>
        </div>
        <audio
          ref={audioRef}
          src={meditation.audio_file}
          preload="auto"
          onLoadedMetadata={(event) => {
            const audio = event.currentTarget;
            setDuration(audio.duration || meditation.duration);
            audio.playbackRate = speed;
            if (meditation.history?.last_position) audio.currentTime = meditation.history.last_position;
            setLoading(false);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => {
            setPlaying(false);
            persist(false);
          }}
          onTimeUpdate={(event) => {
            setPosition(event.currentTarget.currentTime);
            window.clearTimeout(saveTimer.current);
            saveTimer.current = window.setTimeout(() => persist(false), 1200);
          }}
          onEnded={() => {
            setPlaying(false);
            persist(true);
          }}
        />
      </div>
    </div>
  );
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return <button aria-label={label} onClick={onClick} className="grid h-12 w-12 place-items-center rounded-full bg-cream/10 text-cream">{children}</button>;
}

function ProfilePage({ profile, access, firstName, username, onRestore }: { profile: ProfileStats | null; access: AccessState; firstName: string; username?: string; onRestore: () => void }) {
  const activeUntil = access.user?.active_until ? new Date(access.user.active_until).toLocaleDateString() : 'Not active';
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Profile</h2>
      <div className="rounded-3xl border border-cream/15 bg-white/10 p-5 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-lavender/25 text-2xl">{firstName[0]}</div>
          <div>
            <h3 className="text-xl font-semibold">{firstName}</h3>
            <p className="text-sm text-lavender">{username ? `@${username}` : access.plan}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Stat label="Premium status" value={access.hasPremium ? 'Active' : 'Free'} />
          <Stat label="Active until" value={activeUntil} />
          <Stat label="Completed" value={String(profile?.completed ?? 0)} />
          <Stat label="Minutes listened" value={String(profile?.minutesListened ?? 0)} />
          <Stat label="Current streak" value={`${profile?.currentStreak ?? 0} days`} />
          <Stat label="Purchased plan" value={profile?.purchasedPlan ?? 'free'} />
        </div>
        <div className="mt-5 rounded-2xl bg-cream/10 p-4">
          <p className="mb-3 text-sm text-lavender">Rewards</p>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            {rewardMilestones.map((days) => <span key={days} className={`rounded-full px-2 py-2 ${profile?.rewards?.[days] ? 'bg-gold text-night' : 'bg-cream/10 text-cream/60'}`}>{days}d</span>)}
          </div>
        </div>
        <button onClick={onRestore} className="mt-5 w-full rounded-2xl bg-cream px-5 py-4 font-semibold text-night">Restore purchases</button>
        <button className="mt-3 w-full rounded-2xl bg-cream/10 px-5 py-4 text-sm text-cream/60">Logout</button>
      </div>
    </div>
  );
}

const emptyMeditationForm = (category = 'sleep'): MeditationPayload => ({
  title: '',
  subtitle: '',
  description: '',
  category,
  duration: 600,
  cover_image: '',
  audio_file: '',
  premium: false,
  published: true,
  mood: 'Calm'
});

function AdminPage({
  status,
  categories,
  meditations,
  initData,
  onRefresh
}: {
  status: 'checking' | 'allowed' | 'denied';
  categories: Category[];
  meditations: Meditation[];
  initData?: string;
  onRefresh: () => Promise<void>;
}) {
  const [form, setForm] = useState<MeditationPayload>(emptyMeditationForm(categories[0]?.slug));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [coverProgress, setCoverProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!form.category && categories[0]?.slug) {
      setForm((current) => ({ ...current, category: categories[0].slug }));
    }
  }, [categories, form.category]);

  if (status === 'checking') return <EmptyState title="Checking access" body="Confirming your Telegram admin session." />;
  if (status === 'denied') return <EmptyState title="Access denied" body="This admin dashboard is available only to the Luna admin." />;

  const reset = () => {
    setEditingId(null);
    setForm(emptyMeditationForm(categories[0]?.slug));
    setAudioProgress(0);
    setCoverProgress(0);
    setMessage('');
    setError('');
  };

  const friendlyUploadError = (kind: 'audio' | 'cover', file: File) => {
    if (kind === 'audio' && (!(file.type === 'audio/mpeg' || file.type === 'audio/mp3') || !/\.mp3$/i.test(file.name))) {
      return 'Please choose an MP3 audio file.';
    }

    if (kind === 'cover' && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return 'Please choose a JPG, PNG, or WebP cover image.';
    }

    return '';
  };

  const detectDuration = (file: File) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    audio.preload = 'metadata';
    audio.src = url;
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) {
        setForm((current) => ({ ...current, duration: Math.round(audio.duration) }));
      }
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => URL.revokeObjectURL(url);
  };

  const upload = async (kind: 'audio' | 'cover', file?: File) => {
    if (!file) return;
    setError('');
    setMessage('');

    const validationError = friendlyUploadError(kind, file);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      if (kind === 'audio') {
        detectDuration(file);
        setAudioProgress(1);
      } else {
        setCoverProgress(1);
      }

      const result = await uploadAdminAsset(kind, file, initData, (progress) => {
        if (kind === 'audio') setAudioProgress(progress);
        else setCoverProgress(progress);
      });

      setForm((current) => ({ ...current, [kind === 'audio' ? 'audio_file' : 'cover_image']: result.publicUrl }));
      setMessage(`${kind === 'audio' ? 'Audio' : 'Cover'} uploaded successfully.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed. Please try again.');
    }
  };

  const save = async () => {
    setError('');
    setMessage('');

    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }

    if (!form.audio_file || !form.cover_image) {
      setError('Upload both an MP3 audio file and a cover image before saving.');
      return;
    }

    try {
      if (editingId) {
        await updateMeditation(editingId, form, initData);
        setMessage('Meditation updated.');
      } else {
        await createMeditation(form, initData);
        setMessage('Meditation created. Published items appear in Library immediately.');
      }

      await onRefresh();
      reset();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save meditation.');
    }
  };

  const edit = (meditation: Meditation) => {
    setEditingId(meditation.id);
    setForm({
      title: meditation.title,
      subtitle: meditation.subtitle ?? '',
      description: meditation.description,
      category: meditation.category,
      duration: meditation.duration,
      cover_image: meditation.cover_image,
      audio_file: meditation.audio_file,
      premium: meditation.premium,
      published: meditation.published,
      mood: meditation.mood
    });
    setMessage('Editing meditation.');
    setError('');
  };

  const togglePublished = async (meditation: Meditation) => {
    await updateMeditation(meditation.id, { published: !meditation.published }, initData);
    await onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-lavender/70">Hidden CMS</p>
          <h2 className="text-2xl font-semibold">Luna Admin</h2>
        </div>
        <button onClick={reset} className="rounded-full bg-cream/10 px-4 py-2 text-sm">New</button>
      </div>

      <div className="rounded-3xl border border-cream/15 bg-white/10 p-5 shadow-glow backdrop-blur-xl">
        <div className="grid gap-3">
          <DropUpload
            title="MP3 audio"
            body="Drag an MP3 here or tap to upload"
            icon={<Upload />}
            accept="audio/mpeg,audio/mp3,.mp3"
            progress={audioProgress}
            onFile={(file) => upload('audio', file)}
          />
          <DropUpload
            title="Cover image"
            body="Drag JPG, PNG, or WebP cover here"
            icon={<Image />}
            accept="image/jpeg,image/png,image/webp"
            progress={coverProgress}
            onFile={(file) => upload('cover', file)}
          />
        </div>

        <div className="mt-4 grid gap-3">
          <AdminInput label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
          <AdminInput label="Subtitle" value={form.subtitle} onChange={(value) => setForm({ ...form, subtitle: value })} />
          <label className="text-sm text-lavender">
            Description
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-2 min-h-28 w-full rounded-2xl bg-night/70 px-4 py-3 text-sm text-cream outline-none" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-lavender">
              Category
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-2 w-full rounded-2xl bg-night px-4 py-3 text-sm text-cream">
                {categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
              </select>
            </label>
            <label className="text-sm text-lavender">
              Mood
              <select value={form.mood} onChange={(event) => setForm({ ...form, mood: event.target.value as MeditationPayload['mood'] })} className="mt-2 w-full rounded-2xl bg-night px-4 py-3 text-sm text-cream">
                {moods.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-lavender">
              Duration seconds
              <input type="number" min={1} value={form.duration} onChange={(event) => setForm({ ...form, duration: Number(event.target.value) })} className="mt-2 w-full rounded-2xl bg-night/70 px-4 py-3 text-sm text-cream outline-none" />
            </label>
            <div className="grid gap-2 pt-7">
              <Toggle label={form.premium ? 'Premium' : 'Free'} checked={form.premium} onChange={(checked) => setForm({ ...form, premium: checked })} />
              <Toggle label={form.published ? 'Published' : 'Draft'} checked={form.published} onChange={(checked) => setForm({ ...form, published: checked })} />
            </div>
          </div>
        </div>

        <AdminPreview form={form} />

        {error && <p className="mt-4 rounded-2xl bg-red-500/15 p-3 text-sm text-red-100">{error}</p>}
        {message && <p className="mt-4 rounded-2xl bg-lavender/15 p-3 text-sm text-cream">{message}</p>}

        <button onClick={save} className="mt-4 w-full rounded-2xl bg-gold px-4 py-3 font-semibold text-night">
          <CheckCircle className="mr-2 inline" size={16} />{editingId ? 'Save changes' : 'Create meditation'}
        </button>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Meditations</h3>
        {meditations.length ? meditations.map((meditation) => (
          <article key={meditation.id} className="rounded-3xl border border-cream/15 bg-white/10 p-3 backdrop-blur-xl">
            <div className="flex gap-3">
              <img src={meditation.cover_image} alt="" className="h-20 w-20 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="truncate font-semibold">{meditation.title}</h4>
                  <span className={`rounded-full px-2 py-1 text-[10px] ${meditation.published ? 'bg-gold text-night' : 'bg-cream/10 text-cream/60'}`}>
                    {meditation.published ? 'Published' : 'Draft'}
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-lavender">{meditation.subtitle || meditation.category}</p>
                <audio src={meditation.audio_file} controls className="mt-2 w-full" />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={() => edit(meditation)} className="rounded-2xl bg-cream/10 px-3 py-2 text-sm"><Edit3 className="mr-1 inline" size={14} />Edit</button>
              <button onClick={() => void togglePublished(meditation)} className="rounded-2xl bg-cream/10 px-3 py-2 text-sm">{meditation.published ? 'Unpublish' : 'Publish'}</button>
              <button onClick={async () => { await deleteMeditation(meditation.id, initData); await onRefresh(); }} className="rounded-2xl bg-gold px-3 py-2 text-sm font-semibold text-night">Delete</button>
            </div>
          </article>
        )) : <EmptyState title="No meditations" body="Upload audio and cover files, then create your first meditation." />}
      </div>
    </div>
  );
}

function AdminInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-sm text-lavender">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-2xl bg-night/70 px-4 py-3 text-sm text-cream outline-none" />
    </label>
  );
}

function DropUpload({ title, body, icon, accept, progress, onFile }: { title: string; body: string; icon: React.ReactNode; accept: string; progress: number; onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      className={`block cursor-pointer rounded-3xl border border-dashed p-4 transition ${dragging ? 'border-gold bg-gold/10' : 'border-cream/20 bg-night/40'}`}
    >
      <input type="file" accept={accept} onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) onFile(file);
      }} className="hidden" />
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cream/10 text-gold">{icon}</span>
        <span>
          <span className="block font-semibold">{title}</span>
          <span className="text-sm text-cream/60">{body}</span>
        </span>
      </div>
      {progress > 0 && (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-cream/10">
          <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${checked ? 'bg-gold text-night' : 'bg-cream/10 text-cream'}`}>
      {label}
    </button>
  );
}

function AdminPreview({ form }: { form: MeditationPayload }) {
  return (
    <div className="mt-5 rounded-3xl border border-cream/15 bg-night/50 p-4">
      <p className="mb-3 text-sm text-lavender">Preview before publishing</p>
      <div className="flex gap-3">
        {form.cover_image ? <img src={form.cover_image} alt="" className="h-24 w-24 rounded-2xl object-cover" /> : <div className="grid h-24 w-24 place-items-center rounded-2xl bg-cream/10 text-cream/40">Cover</div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{form.title || 'Meditation title'}</h3>
            {form.premium && <Crown size={15} className="text-gold" />}
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-lavender">{form.subtitle || form.category}</p>
          <p className="mt-2 text-sm text-cream/70">{formatTime(form.duration)} · {form.published ? 'Published' : 'Draft'}</p>
        </div>
      </div>
      {form.audio_file && <audio src={form.audio_file} controls className="mt-4 w-full" />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-cream/10 p-4">
      <p className="text-xs text-lavender">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="rounded-3xl border border-cream/15 bg-white/10 p-5 text-center backdrop-blur-xl"><Sparkles className="mx-auto text-gold" /><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-1 text-sm text-cream/65">{body}</p></div>;
}

function Nav({ active, onChange }: { active: Page; onChange: (page: Page) => void }) {
  const items: Array<{ page: Page; label: string; icon: typeof Home }> = [
    { page: 'home', label: 'Home', icon: Home },
    { page: 'library', label: 'Library', icon: BookOpen },
    { page: 'favorites', label: 'Saved', icon: Heart },
    { page: 'pricing', label: 'Premium', icon: Crown },
    { page: 'profile', label: 'Profile', icon: User }
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-cream/10 bg-night/80 px-3 py-3 backdrop-blur-xl">
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const selected = active === item.page;
          return (
            <button key={item.page} onClick={() => onChange(item.page)} className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] ${selected ? 'bg-cream/15 text-cream' : 'text-cream/55'}`}>
              <Icon size={19} />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default App;
