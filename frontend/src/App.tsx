import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle,
  Crown,
  Edit3,
  Heart,
  Home,
  Image as ImageIcon,
  Lock,
  Pause,
  Play,
  Search,
  Share2,
  SkipBack,
  SkipForward,
  Sparkles,
  Timer,
  Upload,
  User
} from 'lucide-react';
import {
  createInvoiceLink,
  createMeditation,
  deleteMeditation,
  getAccess,
  checkAdmin,
  getAdminDashboard,
  getCategories,
  getAdminMeditations,
  getFavorites,
  getHistory,
  getMeditations,
  getProfile,
  getWellnessSummary,
  saveDailyCheckin,
  saveHistory,
  setFavorite,
  syncUser,
  updateMeditation,
  updateAdminUserAccess,
  uploadAdminAsset,
  type AccessState,
  type AdminDashboardData,
  type AdminUser,
  type Category,
  type DailyCheckin,
  type DailyCheckinPayload,
  type Meditation,
  type MeditationPayload,
  type PlaybackHistory,
  type ProfileStats,
  type WellnessSummary
} from './api';

type Page = 'home' | 'library' | 'favorites' | 'profile' | 'pricing' | 'player' | 'admin';
type Mood = 'Calm' | 'Stressed' | 'Tired' | 'Anxious' | 'Focused';
type MoodChip = 'Sleep' | 'Calm' | 'Focus' | 'Anxiety' | 'Breath' | 'Energy';

const moods: MoodChip[] = ['Sleep', 'Calm', 'Focus', 'Anxiety', 'Breath', 'Energy'];
const meditationMoods: Mood[] = ['Calm', 'Stressed', 'Tired', 'Anxious', 'Focused'];
const moodToMeditationMood: Record<MoodChip, Mood> = {
  Sleep: 'Tired',
  Calm: 'Calm',
  Focus: 'Focused',
  Anxiety: 'Anxious',
  Breath: 'Stressed',
  Energy: 'Focused'
};
const rewardMilestones = [7, 14, 30, 100] as const;
const premiumPrices = {
  monthly: 499,
  lifetime: 2499
};
const libraryCacheKey = 'luna.library.v1';
type LibraryCache = {
  categories: Category[];
  meditations: Meditation[];
  savedAt: number;
};

let memoryLibraryCache: LibraryCache | null = null;

const fallbackUser: TelegramWebAppUser = {
  id: 10001,
  first_name: 'Luna'
};

function getTelegram() {
  return window.Telegram?.WebApp;
}

function readLibraryCache() {
  if (memoryLibraryCache) return memoryLibraryCache;

  try {
    const raw = window.localStorage.getItem(libraryCacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LibraryCache;
    if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.meditations)) return null;
    memoryLibraryCache = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function writeLibraryCache(categories: Category[], meditations: Meditation[]) {
  const nextCache = { categories, meditations, savedAt: Date.now() };
  memoryLibraryCache = nextCache;

  try {
    window.localStorage.setItem(libraryCacheKey, JSON.stringify(nextCache));
  } catch {
    // Cache writes are best-effort; the app should stay usable in restricted storage contexts.
  }
}

function preloadCoverImages(meditations: Meditation[]) {
  meditations.slice(0, 8).forEach((meditation) => {
    if (!meditation.cover_image) return;
    const image = new Image();
    image.src = meditation.cover_image;
  });
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remaining}`;
}

function dayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function todayLocalDate() {
  return new Date().toISOString().slice(0, 10);
}

function moodChipToCheckinMood(mood: MoodChip): DailyCheckin['mood'] {
  if (mood === 'Sleep') return 'tired';
  if (mood === 'Anxiety') return 'anxious';
  if (mood === 'Breath') return 'stressed';
  if (mood === 'Focus') return 'focused';
  if (mood === 'Energy') return 'low_energy';
  return 'calm';
}

function checkinMoodToMoodChip(mood?: DailyCheckin['mood'] | null): MoodChip {
  if (mood === 'tired') return 'Sleep';
  if (mood === 'anxious') return 'Anxiety';
  if (mood === 'stressed') return 'Breath';
  if (mood === 'focused') return 'Focus';
  if (mood === 'low_energy') return 'Energy';
  return 'Calm';
}

function moodMessage(mood: MoodChip, wellness: WellnessSummary | null) {
  if (wellness?.todayCheckin) return `Saved for today. Luna recommends: ${wellness.recommendedFocus}.`;
  if (mood === 'Sleep') return 'Let’s keep it gentle and help your nervous system power down.';
  if (mood === 'Anxiety') return 'A breath-led reset can create space before the next thought.';
  if (mood === 'Focus') return 'A short focus practice can make the next hour feel cleaner.';
  if (mood === 'Energy') return 'We’ll start bright, then settle into steady calm.';
  if (mood === 'Breath') return 'Your breath is the quickest door back into the body.';
  return 'Beautiful. Luna will keep today soft and steady.';
}

function displayMeditationTitle(meditation: Meditation, fallbackIndex = 0) {
  const clean = meditation.title?.trim();
  if (clean) return clean;
  return ['Morning Calm', 'Deep Sleep', 'Anxiety Relief', 'Evening Reset'][fallbackIndex % 4];
}

function meditationShareSubtitle(meditation: Meditation) {
  return meditation.subtitle?.trim() || meditation.category.replace('-', ' ');
}

function meditationShareUrl() {
  const botUsername = import.meta.env.VITE_BOT_USERNAME;
  if (botUsername) return `https://t.me/${botUsername}?start=luna`;
  return window.location.origin;
}

function durationLabel(value?: DailyCheckin['available_minutes'] | null) {
  if (!value) return 'Not set';
  return value === '15_plus' ? '15+ min' : `${value} min`;
}

function MoonMark({ className = '' }: { className?: string }) {
  return <span className={`luna-moon-mark ${className}`} aria-hidden="true" />;
}

function App() {
  const telegram = getTelegram();
  const user = telegram?.initDataUnsafe.user ?? fallbackUser;
  const initData = telegram?.initData;
  const [initialLibraryCache] = useState(() => readLibraryCache());
  const [page, setPage] = useState<Page>(window.location.pathname === '/admin' || window.location.hash === '#admin' ? 'admin' : 'home');
  const [mood, setMood] = useState<MoodChip>('Calm');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [meditations, setMeditations] = useState<Meditation[]>(initialLibraryCache?.meditations ?? []);
  const [categories, setCategories] = useState<Category[]>(initialLibraryCache?.categories ?? []);
  const [libraryLoading, setLibraryLoading] = useState(!initialLibraryCache?.meditations.length);
  const [history, setHistory] = useState<PlaybackHistory[]>([]);
  const [favorites, setFavorites] = useState<Meditation[]>([]);
  const [access, setAccess] = useState<AccessState>({ hasPremium: false, plan: 'Free' });
  const [profile, setProfile] = useState<ProfileStats | null>(null);
  const [selectedMeditation, setSelectedMeditation] = useState<Meditation | null>(null);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [openingPlan, setOpeningPlan] = useState<'monthly' | 'lifetime' | null>(null);
  const [adminStatus, setAdminStatus] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [adminMeditations, setAdminMeditations] = useState<Meditation[]>([]);
  const [adminDashboard, setAdminDashboard] = useState<AdminDashboardData | null>(null);
  const [wellness, setWellness] = useState<WellnessSummary | null>(null);
  const [showCheckin, setShowCheckin] = useState(false);

  const refreshAccount = async () => {
    const [accessState, profileStats, historyList, favoriteList, wellnessSummary] = await Promise.all([
      getAccess(initData),
      getProfile(initData).catch(() => null),
      getHistory(initData).catch(() => []),
      getFavorites(initData).catch(() => []),
      getWellnessSummary(initData).catch(() => null)
    ]);
    setAccess(accessState);
    setProfile(profileStats);
    setHistory(historyList);
    setFavorites(favoriteList);
    setWellness(wellnessSummary);
  };

  const refreshLibrary = async () => {
    if (!meditations.length) setLibraryLoading(true);
    try {
      const [categoryList, meditationList] = await Promise.all([getCategories(), getMeditations(initData)]);
      setCategories(categoryList);
      setMeditations(meditationList);
      writeLibraryCache(categoryList, meditationList);
      preloadCoverImages(meditationList);
    } finally {
      setLibraryLoading(false);
    }
  };

  const refreshAdmin = async () => {
    const [meditationList, dashboard] = await Promise.all([
      getAdminMeditations(initData),
      getAdminDashboard(initData)
    ]);
    setAdminMeditations(meditationList);
    setAdminDashboard(dashboard);
  };

  useEffect(() => {
    telegram?.ready();
    telegram?.expand();
    if (initialLibraryCache?.meditations.length) {
      preloadCoverImages(initialLibraryCache.meditations);
    }

    async function boot() {
      const libraryPromise = refreshLibrary().catch((error) => {
        console.info('[Luna library refresh failed]', error instanceof Error ? error.message : 'Library refresh failed.');
        setLibraryLoading(false);
      });

      try {
        await syncUser(user, initData);
        await refreshAccount();
      } catch {
        setLibraryLoading(false);
      }

      try {
        await checkAdmin(initData);
        setAdminStatus('allowed');
      } catch (error) {
        console.info('[Luna admin check failed]', error instanceof Error ? error.message : 'Admin check failed.');
        setAdminStatus('denied');
      }

      await libraryPromise;
    }

    void boot();
  }, [initData, initialLibraryCache, telegram, user]);

  useEffect(() => {
    if (page !== 'admin') return;

    async function bootAdmin() {
      try {
        await checkAdmin(initData);
        setAdminStatus('allowed');
        await Promise.all([refreshLibrary(), refreshAdmin()]);
      } catch (error) {
        console.info('[Luna admin check failed]', error instanceof Error ? error.message : 'Admin check failed.');
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
      const matchesCategory = category === 'all' || (category === 'short' ? meditation.duration <= 600 : meditation.category === category);
      return matchesQuery && matchesCategory;
    });
  }, [category, decoratedMeditations, query]);

  const recommended = useMemo(() => {
    const activeMood = wellness?.todayCheckin ? checkinMoodToMoodChip(wellness.todayCheckin.mood) : mood;
    const minutes = wellness?.todayCheckin?.available_minutes;
    return decoratedMeditations
      .filter((meditation) => meditation.mood === moodToMeditationMood[activeMood])
      .filter((meditation) => (minutes === '3' || minutes === '5' ? meditation.duration <= 600 : true))
      .slice(0, 6);
  }, [decoratedMeditations, mood, wellness]);

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

  useEffect(() => {
    if (!wellness || wellness.todayCheckin) return;
    const dismissed = window.localStorage.getItem(`luna.checkin.dismissed.${todayLocalDate()}`);
    if (!dismissed) setShowCheckin(true);
  }, [wellness]);

  useEffect(() => {
    preloadCoverImages([dailyMeditation, ...recommended, ...continueListening, ...popular, ...newest].filter(Boolean) as Meditation[]);
  }, [continueListening, dailyMeditation, newest, popular, recommended]);

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

  const selectMood = async (nextMood: MoodChip) => {
    setMood(nextMood);
    telegram?.HapticFeedback?.impactOccurred('light');

    if (!wellness?.todayCheckin) {
      setShowCheckin(true);
      return;
    }

    try {
      const checkin = await saveDailyCheckin({
        sleep_range: wellness.todayCheckin.sleep_range,
        available_minutes: wellness.todayCheckin.available_minutes,
        mood: moodChipToCheckinMood(nextMood),
        local_date: wellness.todayCheckin.local_date
      }, initData);
      const nextSummary = await getWellnessSummary(initData);
      setWellness({ ...nextSummary, todayCheckin: checkin });
    } catch (error) {
      console.info('[Luna check-in mood update failed]', error instanceof Error ? error.message : 'Check-in update failed.');
    }
  };

  const saveCheckin = async (input: DailyCheckinPayload) => {
    const checkin = await saveDailyCheckin(input, initData);
    setMood(checkinMoodToMoodChip(checkin.mood));
    setShowCheckin(false);
    const nextSummary = await getWellnessSummary(initData);
    setWellness({ ...nextSummary, todayCheckin: checkin });
  };

  const dismissCheckin = () => {
    window.localStorage.setItem(`luna.checkin.dismissed.${todayLocalDate()}`, 'true');
    setShowCheckin(false);
  };

  const buyPlan = async (plan: 'monthly' | 'lifetime') => {
    if (openingPlan) return;

    setOpeningPlan(plan);
    setPaymentMessage('Opening payment...');
    telegram?.HapticFeedback?.impactOccurred('light');
    try {
      const { invoiceLink } = await createInvoiceLink(plan, initData);
      setPaymentMessage('Opening Telegram Stars payment...');

      if (telegram?.openInvoice) {
        telegram.openInvoice(invoiceLink, (status) => {
          setOpeningPlan(null);
          if (status === 'paid') {
            setPaymentMessage('Payment successful. Your Luna access is unlocked.');
            void refreshAccount();
            return;
          }
          setPaymentMessage(status === 'cancelled' ? 'Payment cancelled. You can restart checkout anytime.' : 'Payment is pending. Telegram will confirm it shortly.');
        });
      } else {
        telegram?.openTelegramLink(invoiceLink);
        setOpeningPlan(null);
        setPaymentMessage('Invoice opened in Telegram. Complete payment there to unlock access.');
      }
    } catch {
      setOpeningPlan(null);
      const botUsername = import.meta.env.VITE_BOT_USERNAME;
      setPaymentMessage('Payment could not open. Please try again, or open the bot and use /plans.');
      if (botUsername) telegram?.openTelegramLink(`https://t.me/${botUsername}?start=luna`);
    }
  };

  const nextMeditation = selectedMeditation
    ? decoratedMeditations[(decoratedMeditations.findIndex((item) => item.id === selectedMeditation.id) + 1) % decoratedMeditations.length]
    : undefined;

  return (
    <main className="min-h-screen overflow-hidden bg-night text-cream">
      <div className="fixed inset-0 luna-bg" />
      <section className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-28 pt-4">
        <Header plan={access.plan} streak={profile?.currentStreak ?? 0} />

        {page === 'home' && (
          <HomePage
            firstName={user.first_name ?? 'friend'}
            mood={mood}
            setMood={selectMood}
            wellness={wellness}
            daily={dailyMeditation}
            recommended={recommended}
            continueListening={continueListening}
            popular={popular}
            newest={newest}
            loading={libraryLoading}
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
            loading={libraryLoading}
            onOpen={openMeditation}
            onFavorite={toggleFavorite}
            onUnlock={() => setPage('pricing')}
          />
        )}

        {page === 'favorites' && (
          <FavoritesPage meditations={decoratedMeditations.filter((item) => favoriteIds.has(item.id))} onOpen={openMeditation} onFavorite={toggleFavorite} />
        )}

        {page === 'pricing' && (
          <PricingPage onBuy={buyPlan} message={paymentMessage} openingPlan={openingPlan} onLibrary={() => setPage('library')} locked={selectedMeditation} />
        )}

        {page === 'profile' && (
          <ProfilePage
            profile={profile}
            access={access}
            firstName={user.first_name ?? 'Luna'}
            username={user.username}
            wellness={wellness}
            showAdminButton={adminStatus === 'allowed'}
            onAdmin={() => {
              window.history.pushState({}, '', '/admin');
              setPage('admin');
            }}
            onRestore={refreshAccount}
          />
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
            dashboard={adminDashboard}
            initData={initData}
            onBack={() => {
              window.history.pushState({}, '', '/');
              setPage('home');
            }}
            onRefresh={async () => {
              await Promise.all([refreshLibrary(), refreshAdmin()]);
            }}
          />
        )}

        {page !== 'admin' && <Nav active={page} onChange={setPage} />}
        {showCheckin && page !== 'admin' && (
          <DailyCheckinSheet onClose={dismissCheckin} onSave={saveCheckin} initialMood={moodChipToCheckinMood(mood)} />
        )}
      </section>
    </main>
  );
}

function Header({ plan, streak }: { plan: string; streak: number }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <MoonMark className="h-10 w-10 shrink-0" />
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-gold">LUNA</p>
          <h1 className="font-serif text-2xl tracking-[0.16em] text-cream">MEDITATION</h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-beige">AI Guided Calm Inside Telegram</p>
        </div>
      </div>
      <div className="rounded-full border border-white/10 bg-ink px-3 py-1.5 text-[11px] text-cream shadow-glow">
        {streak > 0 ? `${streak} day streak` : plan}
      </div>
    </div>
  );
}

function HomePage(props: {
  firstName: string;
  mood: MoodChip;
  setMood: (mood: MoodChip) => void;
  wellness: WellnessSummary | null;
  daily?: Meditation;
  recommended: Meditation[];
  continueListening: Meditation[];
  popular: Meditation[];
  newest: Meditation[];
  loading: boolean;
  onOpen: (meditation: Meditation) => void;
  onLibrary: () => void;
}) {
  return (
    <div className="space-y-4">
      <section className="luna-fade overflow-hidden rounded-[24px] border border-white/10 bg-ink p-4 shadow-glow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-beige">{dayGreeting()},</p>
            <h2 className="mt-0.5 font-serif text-3xl font-semibold leading-tight text-cream">{props.firstName}</h2>
          </div>
          <MoonMark className="h-14 w-14 shrink-0" />
        </div>
        <p className="mt-3 text-sm text-beige">How are you feeling today?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {moods.map((item) => (
            <button
              key={item}
              onClick={() => props.setMood(item)}
              className={`rounded-full px-3.5 py-1.5 text-sm transition ${
                props.mood === item ? 'bg-gold text-night' : 'bg-surface text-cream'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-2xl border border-gold/20 bg-gold/10 px-3 py-2">
          <p className="line-clamp-1 text-xs font-medium text-cream/85">{props.wellness?.todayCheckin ? '✓ Today’s check-in saved' : moodMessage(props.mood, props.wellness)}</p>
          {props.wellness?.weeklyCheckinCount ? (
            <p className="mt-1 text-[11px] capitalize text-gold">
              {props.wellness.mostCommonMoodLabel} · {props.wellness.weeklyCheckinCount}/7 check-ins
            </p>
          ) : null}
        </div>
      </section>

      {props.daily ? (
        <PracticeHero label="Today's Meditation" meditation={props.daily} onOpen={() => props.onOpen(props.daily!)} />
      ) : props.loading ? (
        <PracticeHeroSkeleton />
      ) : (
        <EmptyState title="Your first calm practice is coming soon." body="Luna’s library will appear here as soon as new meditations are published." />
      )}

      <Rail title="Continue listening" meditations={props.continueListening} onOpen={props.onOpen} />
      <Rail title="Recently played" meditations={props.continueListening} onOpen={props.onOpen} />
      <Rail title="Popular meditations" meditations={props.popular} onOpen={props.onOpen} />
      <Rail title="Breathing exercises" meditations={props.newest.filter((item) => item.category.includes('breath'))} onOpen={props.onOpen} />
      <Rail title="Premium recommendations" meditations={props.recommended.filter((item) => item.premium)} onOpen={props.onOpen} />
      {props.wellness && <InsightCard title="This week with Luna" body={props.wellness.weeklyInsight} meta={`Recommended focus: ${props.wellness.recommendedFocus}`} />}
      {props.loading && !props.daily && <RailSkeleton title="Preparing your calm" />}

      <button onClick={props.onLibrary} className="w-full rounded-[20px] bg-gold px-5 py-4 font-semibold text-night shadow-glow hover:brightness-110">
        Open Library
      </button>
    </div>
  );
}

function PracticeHero({ meditation, label, onOpen }: { meditation: Meditation; label: string; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="group relative h-[260px] w-full overflow-hidden rounded-[26px] border border-white/10 text-left shadow-glow transition duration-300 ease-in-out hover:brightness-110">
      <img src={meditation.cover_image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70 transition group-hover:scale-105" loading="eager" />
      <div className="absolute inset-0 bg-gradient-to-t from-night via-night/40 to-transparent" />
      <span className="absolute right-4 top-4 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-night">
        {meditation.premium ? 'Premium' : 'Free'}
      </span>
      <div className="absolute bottom-0 p-4">
        <p className="mb-2 inline-flex rounded-full bg-lavender/25 px-3 py-1 text-xs text-cream backdrop-blur">{label}</p>
        <h3 className="font-serif text-2xl font-semibold">{displayMeditationTitle(meditation)}</h3>
        <p className="mt-1 text-sm capitalize text-cream/75">
          {meditation.category.replace('-', ' ')} · {formatTime(meditation.duration)}
        </p>
        <span className="mt-3 inline-flex rounded-[18px] bg-gold px-5 py-2.5 text-sm font-semibold text-night shadow-gold">
          Begin
        </span>
      </div>
    </button>
  );
}

function PracticeHeroSkeleton() {
  return (
    <div className="relative h-72 w-full overflow-hidden rounded-[30px] border border-cream/15 bg-white/10 shadow-glow">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-lavender/20 via-cream/10 to-gold/10" />
      <div className="absolute bottom-0 w-full p-5">
        <div className="h-7 w-28 rounded-full bg-cream/15" />
        <div className="mt-4 h-8 w-2/3 rounded-full bg-cream/15" />
        <div className="mt-3 h-4 w-40 rounded-full bg-cream/10" />
      </div>
    </div>
  );
}

function RailSkeleton({ title }: { title: string }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="-mx-4 flex gap-3 overflow-hidden px-4 pb-1">
        {[0, 1, 2].map((item) => (
          <div key={item} className="w-40 shrink-0 animate-pulse">
            <div className="h-40 w-40 rounded-3xl bg-cream/10 shadow-glow" />
            <div className="mt-3 h-4 w-32 rounded-full bg-cream/10" />
            <div className="mt-2 h-3 w-20 rounded-full bg-cream/10" />
          </div>
        ))}
      </div>
    </section>
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
            <p className="mt-2 line-clamp-1 font-semibold">{displayMeditationTitle(meditation)}</p>
            <p className="text-xs capitalize text-lavender">{meditation.category.replace('-', ' ')} · {formatTime(meditation.duration)}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function InsightCard({ title, body, meta }: { title: string; body: string; meta: string }) {
  return (
    <section className="rounded-[24px] border border-gold/20 bg-gradient-to-br from-gold/15 via-lavender/10 to-white/5 p-4 shadow-glow">
      <p className="text-xs uppercase tracking-[0.18em] text-gold">{title}</p>
      <p className="mt-3 text-sm leading-6 text-cream/85">{body}</p>
      <p className="mt-3 text-xs text-lavender">{meta}</p>
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
  loading: boolean;
  onOpen: (meditation: Meditation) => void;
  onFavorite: (meditation: Meditation) => void;
  onUnlock: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Luna Library</h2>
      <div className="flex items-center gap-2 rounded-2xl border border-cream/15 bg-white/10 px-4 py-3 backdrop-blur-xl">
        <Search size={18} className="text-lavender" />
        <input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="Search by title" className="w-full bg-transparent text-sm outline-none placeholder:text-cream/45" />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        <FilterPill active={props.category === 'all'} onClick={() => props.setCategory('all')} label="All" />
        <FilterPill active={props.category === 'short'} onClick={() => props.setCategory('short')} label="Short" />
        {props.categories.map((item) => (
          <FilterPill key={item.slug} active={props.category === item.slug} onClick={() => props.setCategory(item.slug)} label={item.name} />
        ))}
      </div>
      {props.loading && !props.meditations.length ? (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => <MeditationCardSkeleton key={item} />)}
        </div>
      ) : props.meditations.length ? (
        props.meditations.map((meditation) => (
          <MeditationCard key={meditation.id} meditation={meditation} locked={meditation.premium && !props.hasPremium} onOpen={props.onOpen} onFavorite={props.onFavorite} onUnlock={props.onUnlock} />
        ))
      ) : (
        <EmptyState title="No meditations found." body="Try another mood, category, or search phrase." />
      )}
    </div>
  );
}

function MeditationCardSkeleton() {
  return (
    <article className="animate-pulse rounded-3xl border border-cream/15 bg-white/10 p-3 backdrop-blur-xl">
      <div className="flex gap-3">
        <div className="h-24 w-24 rounded-2xl bg-cream/10" />
        <div className="min-w-0 flex-1">
          <div className="h-5 w-36 rounded-full bg-cream/15" />
          <div className="mt-3 h-3 w-20 rounded-full bg-cream/10" />
          <div className="mt-4 h-3 w-full rounded-full bg-cream/10" />
          <div className="mt-2 h-3 w-2/3 rounded-full bg-cream/10" />
        </div>
      </div>
      <div className="mt-3 h-11 w-full rounded-2xl bg-cream/10" />
    </article>
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
            <h3 className="truncate font-semibold">{displayMeditationTitle(meditation)}</h3>
            {meditation.premium && <Crown size={15} className="text-gold" />}
          </div>
          <p className="mt-1 text-xs capitalize text-lavender">{meditation.category.replace('-', ' ')}</p>
          <p className="mt-2 line-clamp-2 text-sm text-cream/70">{meditation.description}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full bg-gold/15 px-2 py-1 text-gold">{meditation.premium ? 'Premium' : 'Free'}</span>
            <span className="rounded-full bg-cream/10 px-2 py-1 text-cream/70">{formatTime(meditation.duration)}</span>
            {meditation.play_count > 0 && <span className="rounded-full bg-lavender/15 px-2 py-1 text-lavender">Popular today</span>}
            {meditation.history?.last_position ? <span className="rounded-full bg-cream/10 px-2 py-1 text-cream/70">Resume</span> : null}
          </div>
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
      <div>
        <h2 className="font-serif text-3xl font-semibold">Your Sanctuary</h2>
        <p className="mt-1 text-sm text-lavender">Practices you saved to return to.</p>
      </div>
      {meditations.length ? meditations.map((meditation) => (
        <MeditationCard key={meditation.id} meditation={meditation} locked={false} onOpen={onOpen} onFavorite={onFavorite} onUnlock={() => undefined} />
      )) : <EmptyState title="Your saved calm will live here." body="Tap the heart on any meditation to build a small refuge you can return to anytime." />}
    </div>
  );
}

function DailyCheckinSheet({
  initialMood,
  onClose,
  onSave
}: {
  initialMood: DailyCheckin['mood'];
  onClose: () => void;
  onSave: (input: DailyCheckinPayload) => Promise<void>;
}) {
  const [sleepRange, setSleepRange] = useState<DailyCheckin['sleep_range']>('6_8');
  const [mood, setMood] = useState<DailyCheckin['mood']>(initialMood);
  const [availableMinutes, setAvailableMinutes] = useState<DailyCheckin['available_minutes']>('5');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave({ sleep_range: sleepRange, mood, available_minutes: availableMinutes, local_date: todayLocalDate() });
    } catch {
      setError('Could not save your check-in. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-night/70 px-4 pb-4 backdrop-blur-sm">
      <section className="w-full rounded-[30px] border border-white/10 bg-ink p-5 shadow-glow luna-fade">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold">Daily check-in</p>
            <h3 className="mt-1 font-serif text-3xl">How is your inner weather?</h3>
          </div>
          <button onClick={onClose} className="rounded-full bg-surface px-3 py-2 text-sm text-lavender">Skip</button>
        </div>
        <CheckinGroup
          title="Sleep last night"
          options={[
            ['less_than_4', '<4h'],
            ['4_6', '4-6h'],
            ['6_8', '6-8h'],
            ['8_plus', '8h+']
          ]}
          value={sleepRange}
          onChange={(value) => setSleepRange(value as DailyCheckin['sleep_range'])}
        />
        <CheckinGroup
          title="Mood right now"
          options={[
            ['calm', 'Calm'],
            ['stressed', 'Stressed'],
            ['tired', 'Tired'],
            ['anxious', 'Anxious'],
            ['focused', 'Focused'],
            ['low_energy', 'Low energy']
          ]}
          value={mood}
          onChange={(value) => setMood(value as DailyCheckin['mood'])}
        />
        <CheckinGroup
          title="Time available"
          options={[
            ['3', '3 min'],
            ['5', '5 min'],
            ['10', '10 min'],
            ['15_plus', '15+ min']
          ]}
          value={availableMinutes}
          onChange={(value) => setAvailableMinutes(value as DailyCheckin['available_minutes'])}
        />
        {error && <p className="mt-3 rounded-2xl bg-red-500/15 p-3 text-sm text-red-100">{error}</p>}
        <button onClick={save} disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-[20px] bg-gold px-5 py-4 font-semibold text-night disabled:opacity-70">
          {saving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-night/30 border-t-night" />}
          {saving ? 'Saving...' : 'Save today'}
        </button>
      </section>
    </div>
  );
}

function CheckinGroup({
  title,
  options,
  value,
  onChange
}: {
  title: string;
  options: Array<[string, string]>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mt-5">
      <p className="mb-3 text-sm text-lavender">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(([id, label]) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`rounded-full px-4 py-2 text-sm transition ${value === id ? 'bg-gold text-night' : 'bg-surface text-cream'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PricingPage({
  onBuy,
  message,
  openingPlan,
  onLibrary,
  locked
}: {
  onBuy: (plan: 'monthly' | 'lifetime') => void;
  message: string;
  openingPlan: 'monthly' | 'lifetime' | null;
  onLibrary: () => void;
  locked: Meditation | null;
}) {
  const [comingSoon, setComingSoon] = useState('');

  return (
    <div className="space-y-2.5 luna-fade">
      <section className="overflow-hidden rounded-[24px] border border-white/10 bg-ink p-4 shadow-glow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold">LUNA Premium</p>
            <h2 className="mt-1 font-serif text-3xl font-semibold leading-tight">Unlock your calm.</h2>
          </div>
          <MoonMark className="h-14 w-14 shrink-0" />
        </div>
        <p className="mt-2 text-sm leading-5 text-beige">
          Full library, premium breathwork, daily streaks and new practices every week.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <PremiumBadge label="Premium Library" />
          <PremiumBadge label="Weekly Content" />
          <PremiumBadge label="Daily Streak" />
        </div>
      </section>
      {locked && <p className="rounded-[20px] bg-surface p-4 text-sm text-cream/80">{locked.title} is part of Luna Premium.</p>}
      <PlanCard title="Monthly Premium" price={`${premiumPrices.monthly} ⭐`} features={['Unlimited meditations', 'Premium breathing', 'Sleep, anxiety and focus', 'Daily streaks']} action="Unlock Monthly" loading={openingPlan === 'monthly'} disabled={Boolean(openingPlan)} onClick={() => onBuy('monthly')} featured />
      <PlanCard title="Lifetime Premium" price={`${premiumPrices.lifetime} ⭐`} features={['Premium library forever', 'All future practices', 'Best value', 'Instant Telegram unlock']} action="Get Lifetime" loading={openingPlan === 'lifetime'} disabled={Boolean(openingPlan)} onClick={() => onBuy('lifetime')} />
      <div className="grid grid-cols-2 gap-2">
        <PremiumValue title="Sleep deeper" body="Evening practices made for softer endings." />
        <PremiumValue title="Calm faster" body="Breath-led resets for anxious moments." />
        <PremiumValue title="Build rhythm" body="Streaks, favorites, and weekly guidance." />
        <PremiumValue title="Grow gently" body="New meditations as your needs change." />
      </div>
      <PlanCard title="Free" price="0" features={['Basic meditations only']} />
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setComingSoon('Card')} className="rounded-[20px] border border-white/10 bg-surface px-4 py-3 text-sm font-semibold">Card</button>
        <button onClick={() => setComingSoon('Crypto')} className="rounded-[20px] border border-white/10 bg-surface px-4 py-3 text-sm font-semibold">Crypto</button>
      </div>
      {message && <p className="rounded-2xl bg-lavender/15 p-4 text-sm text-cream/80">{message}</p>}
      {openingPlan && <div className="h-1 overflow-hidden rounded-full bg-cream/10"><div className="h-full w-1/2 animate-pulse rounded-full bg-gold" /></div>}
      {message.includes('unlocked') && <button onClick={onLibrary} className="w-full rounded-2xl bg-cream px-5 py-4 font-semibold text-night">Open Premium Library</button>}
      {comingSoon && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-night/80 px-5 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[28px] border border-white/10 bg-ink p-5 text-center shadow-glow">
            <p className="text-xs uppercase tracking-[0.18em] text-gold">{comingSoon}</p>
            <h3 className="mt-2 font-serif text-2xl">Coming Soon</h3>
            <p className="mt-2 text-sm text-lavender">Telegram Stars are available now for Luna Premium.</p>
            <button onClick={() => setComingSoon('')} className="mt-5 w-full rounded-[20px] bg-gold px-4 py-3 font-semibold text-night">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PremiumBadge({ label }: { label: string }) {
  return <span className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1.5 text-[11px] font-medium text-gold">{label}</span>;
}

function PremiumValue({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-[18px] border border-gold/20 bg-gold/10 p-2.5">
      <div className="flex items-center gap-2">
        <Sparkles size={15} className="shrink-0 text-gold" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="mt-1 line-clamp-1 text-[11px] leading-4 text-cream/70">{body}</p>
    </article>
  );
}

function PlanCard(props: { title: string; price: string; features: string[]; action?: string; loading?: boolean; disabled?: boolean; featured?: boolean; onClick?: () => void }) {
  return (
    <article className={`rounded-[22px] border p-3.5 shadow-glow ${props.featured ? 'border-gold/40 bg-gold/10' : 'border-white/10 bg-ink'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold">{props.title}</h3>
          <p className="mt-1 text-gold">{props.price}</p>
        </div>
        <Crown className="text-gold" />
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-1.5 text-xs text-cream/75">
        {props.features.map((feature) => <li key={feature}>• {feature}</li>)}
      </ul>
      {props.action && (
        <button
          onClick={props.onClick}
          disabled={props.disabled}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gold px-4 py-2.5 font-semibold text-night transition disabled:cursor-not-allowed disabled:opacity-70"
        >
          {props.loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-night/30 border-t-night" />}
          {props.loading ? 'Opening payment...' : props.action}
        </button>
      )}
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
  const [completed, setCompleted] = useState(false);
  const [shareMessage, setShareMessage] = useState('');

  useEffect(() => {
    setPosition(meditation.history?.last_position ?? 0);
    setDuration(meditation.duration);
    setLoading(true);
    setCompleted(false);
    setShareMessage('');
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

  const shareMeditation = async () => {
    if (meditation.premium) {
      setShareMessage('Sharing is available for free meditations.');
      return;
    }

    const title = displayMeditationTitle(meditation);
    const subtitle = meditationShareSubtitle(meditation);
    const text = `Try this meditation in Luna: ${title} — ${subtitle}`;
    const url = meditationShareUrl();
    const telegram = getTelegram();

    setShareMessage('');
    telegram?.HapticFeedback?.impactOccurred('light');

    if (telegram?.openTelegramLink) {
      telegram.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
      setShareMessage('Share opened in Telegram.');
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        setShareMessage('Share sheet opened.');
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShareMessage('Meditation link copied.');
    } catch {
      setShareMessage('Copy failed. Please try again.');
    }
  };

  return (
    <div className="relative space-y-4 luna-fade">
      <img src={meditation.cover_image} alt="" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[440px] w-full scale-110 rounded-[34px] object-cover opacity-25 blur-3xl" />
      <div className="rounded-[24px] border border-white/10 bg-ink p-4 shadow-glow">
        <div className="relative mx-auto aspect-square w-full max-w-[300px] overflow-hidden rounded-[24px] border border-white/10 bg-night/80">
          <img src={meditation.cover_image} alt="" className="h-full w-full object-contain p-2" />
          {loading && <div className="absolute left-4 top-4 rounded-full bg-night/70 px-4 py-2 text-xs text-cream backdrop-blur">Loading audio...</div>}
          {meditation.premium && <div className="absolute right-4 top-4 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-night">Premium</div>}
          {completed && (
            <div className="absolute inset-0 grid place-items-center bg-night/70 p-6 text-center backdrop-blur-sm">
              <div>
                <CheckCircle className="mx-auto text-gold" size={42} />
                <h3 className="mt-3 font-serif text-3xl">Session complete</h3>
                <p className="mt-2 text-sm text-cream/75">You added {formatTime(duration)} of calm to your day.</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-gold">{meditation.category.replace('-', ' ')}</p>
          <h2 className="mt-1 font-serif text-2xl font-semibold">{displayMeditationTitle(meditation)}</h2>
          <p className="mt-2 text-sm text-lavender">{formatTime(position)} elapsed · {formatTime(Math.max(0, duration - position))} remaining</p>
        </div>

        <input className="mt-5 h-8 w-full accent-gold" type="range" min={0} max={duration || 1} value={position} onChange={(event) => {
          const next = Number(event.target.value);
          setPosition(next);
          if (audioRef.current) audioRef.current.currentTime = next;
        }} />
        <div className="mt-1 flex justify-between text-xs text-lavender">
          <span>{formatTime(position)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        <div className="mt-4 flex items-center justify-center gap-5">
          <IconButton label="Rewind 15 seconds" onClick={() => {
            if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 15);
          }}><SkipBack /></IconButton>
          <button onClick={() => {
            if (!audioRef.current) return;
            if (audioRef.current.paused) void audioRef.current.play();
            else audioRef.current.pause();
          }} className="grid h-16 w-16 place-items-center rounded-full bg-gold text-night shadow-glow hover:brightness-110">
            {playing ? <Pause /> : <Play />}
          </button>
          <IconButton label="Forward 15 seconds" onClick={() => {
            if (audioRef.current) audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 15);
          }}><SkipForward /></IconButton>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button onClick={onFavorite} className="min-h-[72px] rounded-[18px] bg-surface px-2 py-3 text-xs"><Heart className={favorite ? 'mx-auto fill-gold text-gold' : 'mx-auto'} size={18} /><span className="mt-1.5 block">Favorite</span></button>
          <button onClick={() => void shareMeditation()} disabled={meditation.premium} className="min-h-[72px] rounded-[18px] bg-surface px-2 py-3 text-xs text-lavender disabled:cursor-not-allowed disabled:opacity-50"><Share2 className="mx-auto" size={18} /><span className="mt-1.5 block">Share</span></button>
          <button className="min-h-[72px] rounded-[18px] bg-surface px-2 py-3 text-xs text-lavender"><Timer className="mx-auto" size={18} /><span className="mt-1.5 block">Timer</span></button>
        </div>
        {shareMessage && <p className="mt-2 rounded-2xl bg-gold/10 px-3 py-2 text-center text-xs text-cream/80">{shareMessage}</p>}

        <div className="mt-3 flex items-center justify-between rounded-[18px] bg-surface px-4 py-2.5">
          <span className="text-sm text-lavender">Playback speed</span>
          <select value={speed} onChange={(event) => {
            const next = Number(event.target.value);
            setSpeed(next);
            if (audioRef.current) audioRef.current.playbackRate = next;
          }} className="rounded-full bg-night px-3 py-2 text-sm text-cream outline-none">
            {[0.75, 1, 1.25, 1.5, 2].map((item) => <option key={item} value={item}>{item}x</option>)}
          </select>
        </div>
        <audio
          ref={audioRef}
          src={meditation.audio_file}
          preload="auto"
          controlsList="nodownload"
          onContextMenu={(event) => event.preventDefault()}
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
            setCompleted(true);
            persist(true);
          }}
        />
      </div>
    </div>
  );
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return <button aria-label={label} onClick={onClick} className="grid h-11 w-11 place-items-center rounded-full bg-surface text-cream">{children}</button>;
}

function ProfilePage({
  profile,
  access,
  firstName,
  username,
  wellness,
  showAdminButton,
  onAdmin,
  onRestore
}: {
  profile: ProfileStats | null;
  access: AccessState;
  firstName: string;
  username?: string;
  wellness: WellnessSummary | null;
  showAdminButton: boolean;
  onAdmin: () => void;
  onRestore: () => void;
}) {
  const activeUntil = access.user?.active_until ? new Date(access.user.active_until).toLocaleDateString() : 'Not active';
  const level = wellness?.level;
  return (
    <div className="space-y-3 luna-fade">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-gold">LUNA</p>
        <h2 className="font-serif text-3xl font-semibold">Profile</h2>
      </div>
      <div className="rounded-[24px] border border-white/10 bg-ink p-4 shadow-glow">
        <div className="flex items-center gap-4">
          <MoonMark className="h-16 w-16 shrink-0" />
          <div>
            <h3 className="font-serif text-2xl font-semibold">{firstName}</h3>
            <p className="text-sm text-lavender">{username ? `@${username}` : 'Luna member'}</p>
          </div>
        </div>
        {level && (
          <div className="mt-4 rounded-[20px] border border-gold/20 bg-gold/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gold">Level {level.current}</p>
                <h3 className="mt-1 font-serif text-2xl">{level.title}</h3>
              </div>
              <Sparkles className="text-gold" />
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-night">
              <div className="h-full rounded-full bg-gold" style={{ width: `${level.progress}%` }} />
            </div>
            <p className="mt-2 text-xs text-lavender">Next: {level.next}</p>
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2.5 text-sm">
          <Stat label="Member since" value="Today" />
          <Stat label="Premium status" value={access.hasPremium ? 'Active' : 'Free'} />
          <Stat label="Active until" value={activeUntil} />
          <Stat label="Minutes meditated" value={String(profile?.minutesListened ?? 0)} />
          <Stat label="Completed sessions" value={String(profile?.completed ?? 0)} />
          <Stat label="Current streak" value={`${profile?.currentStreak ?? 0} days`} />
          <Stat label="Longest streak" value={`${profile?.longestStreak ?? 0} days`} />
          <Stat label="Calm score" value={`${profile?.calmScore ?? 0}%`} />
          <Stat label="Weekly check-ins" value={`${wellness?.weeklyCheckinCount ?? 0}/7`} />
          <Stat label="Average sleep" value={wellness?.averageSleepLabel ?? 'No check-ins yet'} />
          <Stat label="Current mood" value={wellness?.mostCommonMoodLabel ?? 'Not enough data'} />
          <Stat label="Preferred length" value={durationLabel(wellness?.todayCheckin?.available_minutes)} />
        </div>
        {wellness && <InsightCard title="Your weekly insight" body={wellness.weeklyInsight} meta={`Recommended focus: ${wellness.recommendedFocus}`} />}
        <div className="mt-4 rounded-[20px] bg-surface p-4">
          <p className="mb-3 text-sm text-lavender">Achievements</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {(wellness?.achievements ?? rewardMilestones.map((days) => ({
              id: `${days}`,
              title: `${days}d`,
              description: 'Streak reward',
              unlocked: Boolean(profile?.rewards?.[days])
            }))).map((achievement) => (
              <span key={achievement.id} className={`flex min-h-[78px] flex-col justify-between rounded-2xl p-3 ${achievement.unlocked ? 'bg-gold text-night' : 'bg-night text-lavender'}`}>
                <strong className="block">{achievement.title}</strong>
                <span className="mt-1 block opacity-75">{achievement.description}</span>
              </span>
            ))}
          </div>
        </div>
        {showAdminButton && (
          <button onClick={onAdmin} className="mt-4 w-full rounded-[20px] bg-gold px-5 py-3.5 font-semibold text-night">
            Admin
          </button>
        )}
        <button onClick={onRestore} className="mt-4 w-full rounded-[20px] bg-gold px-5 py-3.5 font-semibold text-night">Restore purchases</button>
        <button className="mt-2.5 w-full rounded-[20px] bg-surface px-5 py-3.5 text-sm text-lavender">Logout</button>
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

type AdminTab = 'dashboard' | 'meditations' | 'users' | 'subscriptions' | 'revenue' | 'analytics' | 'settings';
const adminTabs: Array<{ id: AdminTab; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'meditations', label: 'Meditations' },
  { id: 'users', label: 'Users' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'settings', label: 'Settings' }
];

function AdminPage({
  status,
  categories,
  meditations,
  dashboard,
  initData,
  onBack,
  onRefresh
}: {
  status: 'checking' | 'allowed' | 'denied';
  categories: Category[];
  meditations: Meditation[];
  dashboard: AdminDashboardData | null;
  initData?: string;
  onBack: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [form, setForm] = useState<MeditationPayload>(emptyMeditationForm(categories[0]?.slug));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [coverProgress, setCoverProgress] = useState(0);
  const [audioFileName, setAudioFileName] = useState('');
  const [coverFileName, setCoverFileName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [meditationSearch, setMeditationSearch] = useState('');
  const [publishedFilter, setPublishedFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

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
    setAudioFileName('');
    setCoverFileName('');
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
        setAudioFileName(file.name);
        setAudioProgress(1);
      } else {
        setCoverFileName(file.name);
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
    setAudioFileName(meditation.audio_file.split('/').pop() ?? 'Audio uploaded');
    setCoverFileName(meditation.cover_image.split('/').pop() ?? 'Cover uploaded');
    setError('');
  };

  const togglePublished = async (meditation: Meditation) => {
    await updateMeditation(meditation.id, { published: !meditation.published }, initData);
    await onRefresh();
  };

  const filteredMeditations = meditations.filter((meditation) => {
    const matchesSearch = [meditation.title, meditation.subtitle, meditation.category].some((value) =>
      value?.toLowerCase().includes(meditationSearch.toLowerCase())
    );
    const matchesStatus =
      publishedFilter === 'all' ||
      (publishedFilter === 'published' && meditation.published) ||
      (publishedFilter === 'draft' && !meditation.published);
    const matchesCategory = categoryFilter === 'all' || meditation.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const filteredUsers = (dashboard?.usersList ?? []).filter((user) => {
    const search = userSearch.toLowerCase();
    return [
      String(user.telegram_id),
      user.username ?? '',
      user.first_name ?? '',
      user.last_name ?? ''
    ].some((value) => value.toLowerCase().includes(search));
  });

  const updateUserAccess = async (telegramId: number, action: 'grant_monthly' | 'grant_lifetime' | 'extend_monthly' | 'remove_premium') => {
    await updateAdminUserAccess(telegramId, action, initData);
    await onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold">AI Guided Meditation</p>
          <h2 className="font-serif text-3xl font-semibold">LUNA Admin</h2>
        </div>
        <button onClick={onBack} className="shrink-0 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-night">Back to Luna</button>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {adminTabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`shrink-0 rounded-full px-4 py-2 text-sm ${activeTab === tab.id ? 'bg-gold text-night' : 'bg-cream/10 text-cream'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {!dashboard && activeTab !== 'meditations' && <EmptyState title="Loading dashboard" body="Reading Luna analytics from Supabase." />}

      {dashboard && activeTab === 'dashboard' && (
        <div className="space-y-4">
          <AdminMetricGrid>
            <Stat label="Total users" value={String(dashboard.users.totalRegistered)} />
            <Stat label="New today" value={String(dashboard.users.newToday)} />
            <Stat label="Active today" value={String(dashboard.users.activeToday)} />
            <Stat label="Premium users" value={String(dashboard.subscriptions.activePremiumUsers)} />
            <Stat label="Total Stars" value={String(dashboard.revenue.totalStars)} />
            <Stat label="Listening minutes" value={String(dashboard.meditations.totalListeningMinutes)} />
            <Stat label="Check-ins today" value={String(dashboard.wellness?.checkinsToday ?? 0)} />
            <Stat label="Weekly check-ins" value={String(dashboard.wellness?.checkinsThisWeek ?? 0)} />
          </AdminMetricGrid>
          <AdminSection title="Wellness signals">
            <AdminMetricGrid>
              <Stat label="Common mood" value={dashboard.wellness?.mostCommonMoodLabel ?? 'No data'} />
              <Stat label="Sleep pattern" value={dashboard.wellness?.averageSleepLabel ?? 'No data'} />
              <Stat label="Wanted length" value={durationLabel(dashboard.wellness?.mostRequestedDuration ?? null)} />
              <Stat label="Total check-ins" value={String(dashboard.wellness?.totalCheckins ?? 0)} />
            </AdminMetricGrid>
            <p className="mt-3 rounded-2xl bg-cream/10 p-3 text-sm text-cream/75">
              Content cue: create more {dashboard.wellness?.mostCommonMoodLabel ?? 'calm'} practices around {dashboard.wellness?.averageSleepLabel ?? 'short'} needs.
            </p>
          </AdminSection>
          <AdminSection title="Subscriptions">
            <AdminMetricGrid>
              <Stat label="Free" value={String(dashboard.subscriptions.freeUsers)} />
              <Stat label="Monthly" value={String(dashboard.subscriptions.monthlySubscribers)} />
              <Stat label="Lifetime" value={String(dashboard.subscriptions.lifetimeSubscribers)} />
              <Stat label="Expired" value={String(dashboard.subscriptions.expiredPremiumUsers)} />
            </AdminMetricGrid>
          </AdminSection>
          <AdminSection title="Meditations">
            <AdminMetricGrid>
              <Stat label="Total" value={String(dashboard.meditations.total)} />
              <Stat label="Published" value={String(dashboard.meditations.published)} />
              <Stat label="Drafts" value={String(dashboard.meditations.drafts)} />
              <Stat label="Avg completion" value={`${dashboard.meditations.averageCompletionRate}%`} />
            </AdminMetricGrid>
            <p className="mt-3 rounded-2xl bg-cream/10 p-3 text-sm text-cream/75">
              Most played: {dashboard.meditations.mostPlayed?.title ?? 'No plays yet'}
            </p>
          </AdminSection>
          <AdminSection title="Charts">
            <MiniChart title="Registrations" points={dashboard.charts.registrationsByDay} />
            <MiniChart title="Revenue" points={dashboard.charts.revenueByDay} suffix=" Stars" />
            <MiniChart title="Listening minutes" points={dashboard.charts.listeningMinutesByDay} />
          </AdminSection>
          <AdminPeopleList title="Top listeners" users={dashboard.topUsers.topListeners} metric={(user) => `${user.totalMinutesListened} min`} />
          <AdminPeopleList title="Longest streaks" users={dashboard.topUsers.longestStreaks} metric={(user) => `${user.longestStreak} days`} />
          <RecentActivity dashboard={dashboard} />
        </div>
      )}

      {activeTab === 'meditations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">Meditation CMS</h3>
            <button onClick={reset} className="rounded-full bg-cream/10 px-4 py-2 text-sm">New</button>
          </div>

          <div className="space-y-4 rounded-[28px] border border-white/10 bg-ink p-5 shadow-glow">
            <AdminSection title="Meditation Details">
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
                    {meditationMoods.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
              </div>
              <label className="text-sm text-lavender">
                Duration seconds
                <input type="number" min={1} value={form.duration} onChange={(event) => setForm({ ...form, duration: Number(event.target.value) })} className="mt-2 w-full rounded-2xl bg-night/70 px-4 py-3 text-sm text-cream outline-none" />
              </label>
            </AdminSection>

            <AdminSection title="Media">
              <div className="grid gap-3">
                <DropUpload title="+ Upload audio" body="MP3 only · up to 100 MB" readyText={audioFileName ? `${audioFileName} · ${formatTime(form.duration)} · Ready` : ''} icon={<Upload />} accept="audio/mpeg,audio/mp3,.mp3" progress={audioProgress} onFile={(file) => upload('audio', file)} />
                <DropUpload title="+ Upload cover" body="JPG, PNG or WebP · Ready for library cards" readyText={coverFileName ? `${coverFileName} · Ready` : ''} icon={<ImageIcon />} accept="image/jpeg,image/png,image/webp" progress={coverProgress} onFile={(file) => upload('cover', file)} />
              </div>
            </AdminSection>

            <AdminSection title="Access">
              <div className="grid grid-cols-2 gap-3">
                <Toggle label={form.premium ? 'Premium' : 'Free'} checked={form.premium} onChange={(checked) => setForm({ ...form, premium: checked })} />
                <Toggle label={form.published ? 'Published' : 'Draft'} checked={form.published} onChange={(checked) => setForm({ ...form, published: checked })} />
              </div>
            </AdminSection>

            <AdminSection title="Preview">
              <AdminPreview form={form} />
            </AdminSection>
            {error && <p className="mt-4 rounded-2xl bg-red-500/15 p-3 text-sm text-red-100">{error}</p>}
            {message && <p className="mt-4 rounded-2xl bg-lavender/15 p-3 text-sm text-cream">{message}</p>}
            <button onClick={save} className="mt-4 w-full rounded-2xl bg-gold px-4 py-3 font-semibold text-night">
              <CheckCircle className="mr-2 inline" size={16} />{editingId ? 'Save changes' : 'Create meditation'}
            </button>
          </div>

          <div className="grid gap-3 rounded-3xl border border-cream/15 bg-white/10 p-4 backdrop-blur-xl">
            <input value={meditationSearch} onChange={(event) => setMeditationSearch(event.target.value)} placeholder="Search meditations" className="rounded-2xl bg-night/70 px-4 py-3 text-sm text-cream outline-none placeholder:text-cream/40" />
            <div className="grid grid-cols-2 gap-2">
              <select value={publishedFilter} onChange={(event) => setPublishedFilter(event.target.value as typeof publishedFilter)} className="rounded-2xl bg-night px-4 py-3 text-sm text-cream">
                <option value="all">All statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-2xl bg-night px-4 py-3 text-sm text-cream">
                <option value="all">All categories</option>
                {categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {filteredMeditations.length ? filteredMeditations.map((meditation) => {
              const stats = dashboard?.meditations.items.find((item) => item.id === meditation.id);
              return (
                <article key={meditation.id} className="rounded-3xl border border-cream/15 bg-white/10 p-3 backdrop-blur-xl">
                  <div className="flex gap-3">
                    <img src={meditation.cover_image} alt="" className="h-20 w-20 rounded-2xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="truncate font-semibold">{meditation.title}</h4>
                        <span className={`rounded-full px-2 py-1 text-[10px] ${meditation.published ? 'bg-gold text-night' : 'bg-cream/10 text-cream/60'}`}>{meditation.published ? 'Published' : 'Draft'}</span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-lavender">{meditation.subtitle || meditation.category} · {new Date(meditation.created_at).toLocaleDateString()}</p>
                      <p className="mt-1 text-xs text-cream/60">{meditation.play_count} plays · {stats?.completionRate ?? 0}% completion</p>
                      <audio src={meditation.audio_file} controls controlsList="nodownload" onContextMenu={(event) => event.preventDefault()} className="mt-2 w-full" />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button onClick={() => edit(meditation)} className="rounded-2xl bg-cream/10 px-3 py-2 text-sm"><Edit3 className="mr-1 inline" size={14} />Edit</button>
                    <button onClick={() => void togglePublished(meditation)} className="rounded-2xl bg-cream/10 px-3 py-2 text-sm">{meditation.published ? 'Unpublish' : 'Publish'}</button>
                    <button onClick={async () => { await deleteMeditation(meditation.id, initData); await onRefresh(); }} className="rounded-2xl bg-gold px-3 py-2 text-sm font-semibold text-night">Delete</button>
                  </div>
                </article>
              );
            }) : <EmptyState title="Upload your first meditation." body="Begin building Luna’s library with an MP3, cover, and calm description." />}
          </div>
        </div>
      )}

      {dashboard && activeTab === 'users' && <UsersPanel users={filteredUsers} search={userSearch} selectedUser={selectedUser} onSearch={setUserSearch} onSelect={setSelectedUser} onAction={updateUserAccess} />}
      {dashboard && activeTab === 'subscriptions' && <SubscriptionsPanel dashboard={dashboard} onAction={updateUserAccess} />}
      {dashboard && activeTab === 'revenue' && <RevenuePanel dashboard={dashboard} />}
      {dashboard && activeTab === 'analytics' && <AnalyticsPanel dashboard={dashboard} />}
      {dashboard && activeTab === 'settings' && <SettingsPanel />}

      <button onClick={onBack} className="w-full rounded-2xl bg-gold px-5 py-4 font-semibold text-night">Back to Luna</button>
      <button onClick={onBack} className="sticky bottom-4 z-20 ml-auto block rounded-full border border-white/10 bg-gold px-4 py-2 text-xs font-semibold text-night shadow-gold">
        Back to Luna
      </button>
    </div>
  );
}

function AdminMetricGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function AdminSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-cream/15 bg-white/10 p-4 backdrop-blur-xl">
      <h3 className="mb-3 text-lg font-semibold">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function userDisplayName(user: Pick<AdminUser, 'telegram_id' | 'username' | 'first_name' | 'last_name'>) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
  return fullName || (user.username ? `@${user.username}` : String(user.telegram_id));
}

function premiumLabel(status: AdminUser['premiumStatus']) {
  if (status === 'monthly') return 'Monthly';
  if (status === 'lifetime') return 'Lifetime';
  if (status === 'expired') return 'Expired';
  return 'Free';
}

function exportUsersCsv(users: AdminUser[]) {
  const header = ['telegram_id', 'username', 'first_name', 'premium_status', 'joined_at', 'minutes_listened', 'completed_meditations', 'current_streak'];
  const rows = users.map((user) => [
    user.telegram_id,
    user.username ?? '',
    user.first_name ?? '',
    user.premiumStatus,
    user.created_at,
    user.totalMinutesListened,
    user.completedMeditations,
    user.currentStreak
  ]);
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `luna-users-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function MiniChart({ title, points, suffix = '' }: { title: string; points: Array<{ date: string; value: number }>; suffix?: string }) {
  const max = Math.max(1, ...points.map((point) => point.value));

  return (
    <div className="rounded-2xl bg-night/50 p-3">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-semibold">{title}</span>
        <span className="text-lavender">{points.reduce((sum, point) => sum + point.value, 0)}{suffix}</span>
      </div>
      <div className="flex h-24 items-end gap-1">
        {points.map((point) => (
          <div key={point.date} className="flex flex-1 flex-col items-center gap-1">
            <div className="w-full rounded-t bg-gold/80" style={{ height: `${Math.max(4, (point.value / max) * 88)}px` }} title={`${point.date}: ${point.value}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminPeopleList({ title, users, metric }: { title: string; users: AdminUser[]; metric: (user: AdminUser) => string }) {
  return (
    <AdminSection title={title}>
      {users.length ? users.map((user) => (
        <div key={user.telegram_id} className="flex items-center justify-between rounded-2xl bg-cream/10 p-3 text-sm">
          <span>{userDisplayName(user)}</span>
          <span className="text-gold">{metric(user)}</span>
        </div>
      )) : <p className="text-sm text-cream/60">No user activity yet.</p>}
    </AdminSection>
  );
}

function RecentActivity({ dashboard }: { dashboard: AdminDashboardData }) {
  return (
    <AdminSection title="Recent activity">
      {dashboard.recentActivity.latestRegistrations.slice(0, 4).map((user) => (
        <p key={`registration-${user.telegram_id}`} className="rounded-2xl bg-cream/10 p-3 text-sm">
          New user: {userDisplayName(user)} · {new Date(user.created_at).toLocaleDateString()}
        </p>
      ))}
      {dashboard.recentActivity.latestPurchases.slice(0, 4).map((purchase) => (
        <p key={`purchase-${purchase.telegram_id}-${purchase.created_at}`} className="rounded-2xl bg-cream/10 p-3 text-sm">
          Purchase: {purchase.plan} · {purchase.amount_stars} Stars · {new Date(purchase.created_at).toLocaleDateString()}
        </p>
      ))}
      {dashboard.recentActivity.latestMeditationPlays.slice(0, 4).map((play) => (
        <p key={`play-${play.telegram_id}-${play.last_played}`} className="rounded-2xl bg-cream/10 p-3 text-sm">
          Play: {play.meditation?.title ?? 'Meditation'} · {Math.round(Number(play.completion_percent ?? 0))}% completion
        </p>
      ))}
      {dashboard.recentActivity.latestCheckins.slice(0, 4).map((checkin) => (
        <p key={`checkin-${checkin.telegram_id}-${checkin.local_date}`} className="rounded-2xl bg-cream/10 p-3 text-sm">
          Check-in: {checkin.user?.first_name ?? checkin.telegram_id} · {checkin.mood.replace('_', ' ')} · {durationLabel(checkin.available_minutes)}
        </p>
      ))}
      {dashboard.recentActivity.latestAdminUploads.slice(0, 4).map((meditation) => (
        <p key={`upload-${meditation.id}`} className="rounded-2xl bg-cream/10 p-3 text-sm">
          Upload: {meditation.title} · {new Date(meditation.created_at).toLocaleDateString()}
        </p>
      ))}
    </AdminSection>
  );
}

function UsersPanel({
  users,
  search,
  selectedUser,
  onSearch,
  onSelect,
  onAction
}: {
  users: AdminUser[];
  search: string;
  selectedUser: AdminUser | null;
  onSearch: (value: string) => void;
  onSelect: (user: AdminUser) => void;
  onAction: (telegramId: number, action: 'grant_monthly' | 'grant_lifetime' | 'extend_monthly' | 'remove_premium') => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-cream/15 bg-white/10 p-4 backdrop-blur-xl">
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search Telegram ID, username, or first name" className="w-full rounded-2xl bg-night/70 px-4 py-3 text-sm text-cream outline-none placeholder:text-cream/40" />
        <button onClick={() => exportUsersCsv(users)} className="mt-3 w-full rounded-2xl bg-gold px-4 py-3 text-sm font-semibold text-night">Export users to CSV</button>
      </div>
      {selectedUser && (
        <AdminSection title="User profile">
          <AdminMetricGrid>
            <Stat label="Telegram ID" value={String(selectedUser.telegram_id)} />
            <Stat label="Premium" value={premiumLabel(selectedUser.premiumStatus)} />
            <Stat label="Minutes" value={String(selectedUser.totalMinutesListened)} />
            <Stat label="Completed" value={String(selectedUser.completedMeditations)} />
            <Stat label="Current streak" value={`${selectedUser.currentStreak} days`} />
            <Stat label="Total Stars" value={String(selectedUser.totalStars)} />
          </AdminMetricGrid>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => void onAction(selectedUser.telegram_id, 'grant_monthly')} className="rounded-2xl bg-cream/10 px-3 py-2 text-sm">Grant Monthly</button>
            <button onClick={() => void onAction(selectedUser.telegram_id, 'grant_lifetime')} className="rounded-2xl bg-cream/10 px-3 py-2 text-sm">Grant Lifetime</button>
            <button onClick={() => void onAction(selectedUser.telegram_id, 'extend_monthly')} className="rounded-2xl bg-cream/10 px-3 py-2 text-sm">Extend 30 days</button>
            <button onClick={() => void onAction(selectedUser.telegram_id, 'remove_premium')} className="rounded-2xl bg-gold px-3 py-2 text-sm font-semibold text-night">Remove Premium</button>
          </div>
        </AdminSection>
      )}
      <AdminSection title="Users">
        {users.length ? users.map((user) => (
          <button key={user.telegram_id} onClick={() => onSelect(user)} className="w-full rounded-2xl bg-cream/10 p-3 text-left text-sm">
            <span className="block font-semibold">{userDisplayName(user)}</span>
            <span className="text-lavender">{user.telegram_id} · {premiumLabel(user.premiumStatus)} · joined {new Date(user.created_at).toLocaleDateString()}</span>
            <span className="mt-1 block text-cream/60">{user.totalMinutesListened} min · {user.completedMeditations} completed · {user.currentStreak} day streak</span>
          </button>
        )) : <p className="text-sm text-cream/60">No users found.</p>}
      </AdminSection>
    </div>
  );
}

function SubscriptionsPanel({ dashboard, onAction }: {
  dashboard: AdminDashboardData;
  onAction: (telegramId: number, action: 'grant_monthly' | 'grant_lifetime' | 'extend_monthly' | 'remove_premium') => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <AdminMetricGrid>
        <Stat label="Active monthly" value={String(dashboard.subscriptions.monthlySubscribers)} />
        <Stat label="Lifetime" value={String(dashboard.subscriptions.lifetimeSubscribers)} />
        <Stat label="Expired" value={String(dashboard.subscriptions.expiredPremiumUsers)} />
        <Stat label="Active premium" value={String(dashboard.subscriptions.activePremiumUsers)} />
      </AdminMetricGrid>
      <AdminSection title="Subscribers">
        {dashboard.subscriptionsList.map((user) => (
          <div key={user.telegram_id} className="rounded-2xl bg-cream/10 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{userDisplayName(user)}</span>
              <span className="text-gold">{premiumLabel(user.premiumStatus)}</span>
            </div>
            <p className="mt-1 text-lavender">Expiry: {user.lifetime_access ? 'Lifetime' : user.active_until ? new Date(user.active_until).toLocaleDateString() : 'Not active'}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={() => void onAction(user.telegram_id, 'extend_monthly')} className="rounded-2xl bg-cream/10 px-2 py-2">Extend</button>
              <button onClick={() => void onAction(user.telegram_id, 'grant_lifetime')} className="rounded-2xl bg-cream/10 px-2 py-2">Lifetime</button>
              <button onClick={() => void onAction(user.telegram_id, 'remove_premium')} className="rounded-2xl bg-gold px-2 py-2 font-semibold text-night">Cancel</button>
            </div>
          </div>
        ))}
      </AdminSection>
      <AdminSection title="Purchase history">
        {dashboard.purchaseHistory.map((purchase) => (
          <p key={`${purchase.telegram_id}-${purchase.created_at}`} className="rounded-2xl bg-cream/10 p-3 text-sm">
            {purchase.plan} · {purchase.amount_stars} Stars · {new Date(purchase.created_at).toLocaleDateString()} · expiry {purchase.expiryDate ? new Date(purchase.expiryDate).toLocaleDateString() : 'Lifetime'}
          </p>
        ))}
      </AdminSection>
    </div>
  );
}

function RevenuePanel({ dashboard }: { dashboard: AdminDashboardData }) {
  return (
    <div className="space-y-4">
      <AdminMetricGrid>
        <Stat label="Total Stars" value={String(dashboard.revenue.totalStars)} />
        <Stat label="This month" value={String(dashboard.revenue.monthStars)} />
        <Stat label="Today" value={String(dashboard.revenue.todayStars)} />
        <Stat label="ARPPU" value={String(dashboard.revenue.averageRevenuePerPayingUser)} />
        <Stat label="Conversion" value={`${dashboard.revenue.conversionRate}%`} />
        <Stat label="Monthly plan" value={String(dashboard.revenue.revenueByPlan.monthly)} />
      </AdminMetricGrid>
      <AdminSection title="Revenue by day">
        <MiniChart title="Daily Stars" points={dashboard.charts.revenueByDay} suffix=" Stars" />
      </AdminSection>
      <AdminSection title="Latest purchases">
        {dashboard.revenue.latestPurchases.map((purchase) => (
          <p key={`${purchase.telegram_id}-${purchase.created_at}`} className="rounded-2xl bg-cream/10 p-3 text-sm">
            {purchase.user?.first_name ?? purchase.telegram_id} · {purchase.plan} · {purchase.amount_stars} Stars
          </p>
        ))}
      </AdminSection>
    </div>
  );
}

function AnalyticsPanel({ dashboard }: { dashboard: AdminDashboardData }) {
  return (
    <div className="space-y-4">
      <AdminSection title="Growth">
        <MiniChart title="Registrations by day" points={dashboard.charts.registrationsByDay} />
        <MiniChart title="Purchases by day" points={dashboard.charts.purchasesByDay} />
      </AdminSection>
      <AdminSection title="Engagement">
        <MiniChart title="Listening minutes by day" points={dashboard.charts.listeningMinutesByDay} />
        <MiniChart title="Meditation plays by day" points={dashboard.charts.meditationPlaysByDay} />
      </AdminSection>
      <AdminSection title="Wellness check-ins">
        <AdminMetricGrid>
          <Stat label="This week" value={String(dashboard.wellness?.checkinsThisWeek ?? 0)} />
          <Stat label="Most common mood" value={dashboard.wellness?.mostCommonMoodLabel ?? 'No data'} />
          <Stat label="Sleep signal" value={dashboard.wellness?.averageSleepLabel ?? 'No data'} />
          <Stat label="Practice length" value={durationLabel(dashboard.wellness?.mostRequestedDuration ?? null)} />
        </AdminMetricGrid>
      </AdminSection>
      <AdminPeopleList title="Most completed meditations" users={dashboard.topUsers.mostCompleted} metric={(user) => `${user.completedMeditations} completed`} />
    </div>
  );
}

function SettingsPanel() {
  return (
    <div className="space-y-4">
      <AdminSection title="Settings">
        <p className="rounded-2xl bg-cream/10 p-3 text-sm text-cream/75">Monthly Access: {premiumPrices.monthly} Telegram Stars</p>
        <p className="rounded-2xl bg-cream/10 p-3 text-sm text-cream/75">Lifetime Access: {premiumPrices.lifetime} Telegram Stars</p>
        <p className="rounded-2xl bg-cream/10 p-3 text-sm text-cream/75">Uploads happen only when an admin explicitly selects MP3 or cover files.</p>
        <p className="rounded-2xl bg-cream/10 p-3 text-sm text-cream/75">Backend debug endpoint is protected by Telegram admin authentication.</p>
      </AdminSection>
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

function DropUpload({
  title,
  body,
  readyText,
  icon,
  accept,
  progress,
  onFile
}: {
  title: string;
  body: string;
  readyText?: string;
  icon: React.ReactNode;
  accept: string;
  progress: number;
  onFile: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const ready = Boolean(readyText);

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
      className={`block cursor-pointer rounded-[24px] border p-4 transition duration-300 ease-in-out ${
        ready ? 'border-success/50 bg-success/10' : dragging ? 'border-gold bg-gold/10' : 'border-dashed border-white/10 bg-night/40'
      }`}
    >
      <input type="file" accept={accept} onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) onFile(file);
      }} className="hidden" />
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-2xl ${ready ? 'bg-success/15 text-success' : 'bg-cream/10 text-gold'}`}>
          {ready ? <CheckCircle size={20} /> : icon}
        </span>
        <span>
          <span className="block font-semibold">{ready ? 'Ready' : title}</span>
          <span className="text-sm text-cream/60">{readyText || body}</span>
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
    <div className="rounded-[24px] border border-white/10 bg-night/50 p-3">
      <div className="flex gap-3">
        <div className="relative">
          {form.cover_image ? <img src={form.cover_image} alt="" className="h-28 w-28 rounded-[20px] object-cover" /> : <div className="grid h-28 w-28 place-items-center rounded-[20px] bg-cream/10 text-cream/40">Cover</div>}
          <span className="absolute bottom-2 left-2 rounded-full bg-gold px-2 py-1 text-[10px] font-semibold text-night">{form.premium ? 'Premium' : 'Free'}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-serif text-xl font-semibold">{form.title || 'Meditation title'}</h3>
          <p className="mt-1 line-clamp-1 text-xs text-lavender">{form.subtitle || 'Subtitle'}</p>
          <p className="mt-2 text-sm capitalize text-cream/70">{formatTime(form.duration)} · {form.category.replace('-', ' ')} · {form.published ? 'Published' : 'Draft'}</p>
          <button type="button" className="mt-4 inline-flex items-center gap-2 rounded-[18px] bg-gold px-4 py-2 text-sm font-semibold text-night">
            <Play size={14} /> Play
          </button>
        </div>
      </div>
      {form.audio_file && <audio src={form.audio_file} controls controlsList="nodownload" onContextMenu={(event) => event.preventDefault()} className="mt-4 w-full" />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[76px] flex-col justify-between rounded-[18px] bg-surface p-3">
      <p className="text-xs leading-4 text-lavender">{label}</p>
      <p className="mt-1 break-words font-semibold leading-5">{value}</p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="rounded-[24px] border border-white/10 bg-ink p-4 text-center shadow-glow"><Sparkles className="mx-auto text-gold" /><h3 className="mt-3 font-serif text-xl font-semibold">{title}</h3><p className="mt-1 text-sm text-lavender">{body}</p></div>;
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
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-cream/10 bg-night/85 px-3 py-2.5 backdrop-blur-xl">
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const selected = active === item.page;
          return (
            <button key={item.page} onClick={() => onChange(item.page)} className={`relative flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] ${selected ? 'bg-gold/10 text-cream shadow-[0_0_18px_rgba(212,175,55,0.12)]' : 'text-cream/55'}`}>
              {selected && <span className="absolute top-1 h-0.5 w-6 rounded-full bg-gold" />}
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
