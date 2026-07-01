import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Crown,
  Home,
  Lock,
  Moon,
  Pause,
  Play,
  Sparkles,
  User,
  Wind
} from 'lucide-react';
import {
  completePractice,
  createInvoice,
  getAccess,
  getPractices,
  getProfile,
  syncUser,
  type AccessState,
  type ProfileStats
} from './api';
import { samplePractices, type Practice } from './data/practices';

type Page = 'home' | 'practices' | 'breathwork' | 'sleep' | 'progress' | 'profile' | 'pricing' | 'player';
type Mood = 'Calm' | 'Stressed' | 'Tired' | 'Anxious' | 'Focused';

const moods: Mood[] = ['Calm', 'Stressed', 'Tired', 'Anxious', 'Focused'];

const fallbackUser: TelegramWebAppUser = {
  id: 10001,
  first_name: 'Luna'
};

function getTelegram() {
  return window.Telegram?.WebApp;
}

function App() {
  const telegram = getTelegram();
  const user = telegram?.initDataUnsafe.user ?? fallbackUser;
  const chatId = telegram?.initDataUnsafe.chat?.id ?? user.id;
  const [page, setPage] = useState<Page>('home');
  const [mood, setMood] = useState<Mood>('Calm');
  const [practices, setPractices] = useState<Practice[]>(samplePractices);
  const [access, setAccess] = useState<AccessState>({ hasPremium: false, plan: 'Free' });
  const [profile, setProfile] = useState<ProfileStats | null>(null);
  const [selectedPractice, setSelectedPractice] = useState<Practice>(samplePractices[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(28);
  const [paymentMessage, setPaymentMessage] = useState('');

  useEffect(() => {
    telegram?.ready();
    telegram?.expand();

    async function boot() {
      try {
        await syncUser(user);
        const [practiceList, accessState, profileStats] = await Promise.all([
          getPractices(),
          getAccess(user.id),
          getProfile(user.id).catch(() => null)
        ]);
        setPractices(practiceList);
        setAccess(accessState);
        setProfile(profileStats);
      } catch {
        setPractices(samplePractices);
      }
    }

    void boot();
  }, [telegram, user]);

  const recommended = useMemo(() => {
    if (mood === 'Tired') return practices.find((practice) => practice.title.includes('Sleep')) ?? practices[0];
    if (mood === 'Anxious') return practices.find((practice) => practice.title.includes('Anxiety')) ?? practices[0];
    if (mood === 'Focused') return practices.find((practice) => practice.title.includes('Focus')) ?? practices[0];
    return practices[0];
  }, [mood, practices]);

  const visiblePractices = useMemo(() => {
    if (page === 'breathwork') return practices.filter((practice) => /breath/i.test(practice.type + practice.title));
    if (page === 'sleep') return practices.filter((practice) => /sleep/i.test(practice.type + practice.title));
    return practices;
  }, [page, practices]);

  const openPractice = (practice: Practice) => {
    const locked = practice.access_level === 'premium' && !access.hasPremium;
    telegram?.HapticFeedback?.impactOccurred('light');
    if (locked) {
      setPage('pricing');
      return;
    }
    setSelectedPractice(practice);
    setIsPlaying(false);
    setProgress(18);
    setPage('player');
  };

  const buyPlan = async (plan: 'monthly' | 'lifetime') => {
    setPaymentMessage('Creating Telegram Stars invoice...');
    try {
      await createInvoice({ chatId, telegramId: user.id, plan });
      setPaymentMessage('Invoice sent in Telegram. Complete payment there to unlock access.');
    } catch {
      const botUsername = import.meta.env.VITE_BOT_USERNAME;
      setPaymentMessage('Open the bot and use /plans to complete your Telegram Stars purchase.');
      if (botUsername) telegram?.openTelegramLink(`https://t.me/${botUsername}?start=luna`);
    }
  };

  const finishPractice = async () => {
    setProgress(100);
    try {
      await completePractice({
        telegram_id: user.id,
        practice_id: selectedPractice.id,
        mood_before: mood,
        mood_after: 'Calm'
      });
    } catch {
      // Progress can still be shown locally if the backend is not configured yet.
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-night text-cream">
      <div className="fixed inset-0 luna-bg" />
      <section className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-24 pt-5">
        <Header plan={access.plan} />

        {page === 'home' && (
          <HomePage
            firstName={user.first_name ?? 'friend'}
            mood={mood}
            setMood={setMood}
            recommended={recommended}
            onStart={() => openPractice(practices[0])}
            onOpenPractice={openPractice}
          />
        )}

        {(page === 'practices' || page === 'breathwork' || page === 'sleep') && (
          <LibraryPage
            title={page === 'breathwork' ? 'Breathwork' : page === 'sleep' ? 'Sleep' : 'Practices'}
            practices={visiblePractices}
            hasPremium={access.hasPremium}
            onOpenPractice={openPractice}
            onUnlock={() => setPage('pricing')}
          />
        )}

        {page === 'pricing' && (
          <PricingPage onBuy={buyPlan} message={paymentMessage} onLibrary={() => setPage('practices')} />
        )}

        {page === 'profile' && <ProfilePage profile={profile} access={access} firstName={user.first_name ?? 'Luna'} />}

        {page === 'progress' && <ProgressPage profile={profile} />}

        {page === 'player' && (
          <PlayerPage
            practice={selectedPractice}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            progress={progress}
            setProgress={setProgress}
            onDone={finishPractice}
          />
        )}

        <Nav active={page} onChange={setPage} />
      </section>
    </main>
  );
}

function Header({ plan }: { plan: string }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-lavender/70">Luna</p>
        <h1 className="font-serif text-3xl text-cream">Soft reset</h1>
      </div>
      <div className="rounded-full border border-cream/15 bg-white/10 px-3 py-2 text-xs text-cream shadow-glow backdrop-blur">
        {plan}
      </div>
    </div>
  );
}

function HomePage(props: {
  firstName: string;
  mood: Mood;
  setMood: (mood: Mood) => void;
  recommended: Practice;
  onStart: () => void;
  onOpenPractice: (practice: Practice) => void;
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

      <PracticeHero practice={props.recommended} onOpen={() => props.onOpenPractice(props.recommended)} />

      <button onClick={props.onStart} className="w-full rounded-2xl bg-cream px-5 py-4 font-semibold text-night shadow-glow">
        Start Free Practice
      </button>
    </div>
  );
}

function PracticeHero({ practice, onOpen }: { practice: Practice; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="group relative h-72 w-full overflow-hidden rounded-[30px] border border-cream/15 text-left shadow-glow"
    >
      <img src={practice.cover_image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-t from-night via-night/40 to-transparent" />
      <div className="absolute bottom-0 p-5">
        <p className="mb-2 inline-flex rounded-full bg-lavender/25 px-3 py-1 text-xs text-cream backdrop-blur">
          Recommended
        </p>
        <h3 className="text-2xl font-semibold">{practice.title}</h3>
        <p className="mt-1 text-sm text-cream/75">
          {practice.type} · {practice.duration}
        </p>
      </div>
    </button>
  );
}

function LibraryPage(props: {
  title: string;
  practices: Practice[];
  hasPremium: boolean;
  onOpenPractice: (practice: Practice) => void;
  onUnlock: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">{props.title}</h2>
      {props.practices.map((practice) => {
        const locked = practice.access_level === 'premium' && !props.hasPremium;
        return (
          <article key={practice.id} className="rounded-3xl border border-cream/15 bg-white/10 p-3 backdrop-blur-xl">
            <div className="flex gap-3">
              <img src={practice.cover_image_url} alt="" className="h-24 w-24 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold">{practice.title}</h3>
                  {locked && <Lock size={16} className="text-gold" />}
                </div>
                <p className="mt-1 text-xs text-lavender">{practice.type}</p>
                <p className="mt-2 line-clamp-2 text-sm text-cream/70">{practice.description}</p>
              </div>
            </div>
            <button
              onClick={() => (locked ? props.onUnlock() : props.onOpenPractice(practice))}
              className={`mt-3 w-full rounded-2xl px-4 py-3 text-sm font-semibold ${
                locked ? 'bg-gold text-night' : 'bg-cream/15 text-cream'
              }`}
            >
              {locked ? 'Unlock Premium' : 'Play'}
            </button>
          </article>
        );
      })}
    </div>
  );
}

function PricingPage({
  onBuy,
  message,
  onLibrary
}: {
  onBuy: (plan: 'monthly' | 'lifetime') => void;
  message: string;
  onLibrary: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Unlock Premium</h2>
      <PlanCard title="Free" price="0" features={['1 free practice', 'Basic access']} />
      <PlanCard
        title="Monthly Access"
        price="299 Stars"
        features={['Premium library', '30 days of access', 'Sleep, focus, anxiety, confidence']}
        action="Choose Monthly"
        onClick={() => onBuy('monthly')}
      />
      <PlanCard
        title="Lifetime Access"
        price="1999 Stars"
        features={['Premium library forever', 'Best value', 'Instant Telegram unlock']}
        action="Choose Lifetime"
        onClick={() => onBuy('lifetime')}
      />
      {message && <p className="rounded-2xl bg-lavender/15 p-4 text-sm text-cream/80">{message}</p>}
      {message.includes('unlocked') && (
        <button onClick={onLibrary} className="w-full rounded-2xl bg-cream px-5 py-4 font-semibold text-night">
          Open Premium Library
        </button>
      )}
    </div>
  );
}

function PlanCard(props: {
  title: string;
  price: string;
  features: string[];
  action?: string;
  onClick?: () => void;
}) {
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
        {props.features.map((feature) => (
          <li key={feature}>• {feature}</li>
        ))}
      </ul>
      {props.action && (
        <button onClick={props.onClick} className="mt-5 w-full rounded-2xl bg-gold px-4 py-3 font-semibold text-night">
          {props.action}
        </button>
      )}
    </article>
  );
}

function PlayerPage(props: {
  practice: Practice;
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
  progress: number;
  setProgress: (progress: number) => void;
  onDone: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="relative h-[420px] overflow-hidden rounded-[34px] border border-cream/15 shadow-glow">
        <img src={props.practice.cover_image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-night via-night/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6">
          <p className="text-sm text-lavender">{props.practice.type}</p>
          <h2 className="mt-1 text-3xl font-semibold">{props.practice.title}</h2>
          <p className="mt-2 text-sm text-cream/75">{props.practice.duration}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-cream/15 bg-white/10 p-5 backdrop-blur-xl">
        <div className="h-2 overflow-hidden rounded-full bg-cream/15">
          <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${props.progress}%` }} />
        </div>
        <div className="mt-5 flex items-center justify-center gap-4">
          <button
            onClick={() => {
              props.setIsPlaying(!props.isPlaying);
              props.setProgress(Math.min(96, props.progress + 12));
            }}
            className="grid h-16 w-16 place-items-center rounded-full bg-cream text-night shadow-glow"
            aria-label={props.isPlaying ? 'Pause practice' : 'Play practice'}
          >
            {props.isPlaying ? <Pause /> : <Play />}
          </button>
          <button onClick={props.onDone} className="rounded-full bg-gold px-5 py-3 text-sm font-semibold text-night">
            Mark Complete
          </button>
        </div>
        <audio src={props.practice.audio_url} className="mt-4 w-full" controls />
      </div>
    </div>
  );
}

function ProfilePage({ profile, access, firstName }: { profile: ProfileStats | null; access: AccessState; firstName: string }) {
  const activeUntil = access.user?.active_until ? new Date(access.user.active_until).toLocaleDateString() : 'Not active';
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Profile</h2>
      <div className="rounded-3xl border border-cream/15 bg-white/10 p-5 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-lavender/25 text-2xl">{firstName[0]}</div>
          <div>
            <h3 className="text-xl font-semibold">{firstName}</h3>
            <p className="text-sm text-lavender">{access.plan} plan</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Stat label="Active until" value={activeUntil} />
          <Stat label="Completed" value={String(profile?.completed ?? 0)} />
          <Stat label="Day streak" value={String(profile?.dayStreak ?? 0)} />
          <Stat label="Calm score" value={String(profile?.calmScore ?? 42)} />
        </div>
      </div>
    </div>
  );
}

function ProgressPage({ profile }: { profile: ProfileStats | null }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Progress</h2>
      <div className="rounded-3xl border border-cream/15 bg-white/10 p-5 backdrop-blur-xl">
        <Sparkles className="text-gold" />
        <p className="mt-4 text-5xl font-semibold">{profile?.calmScore ?? 42}</p>
        <p className="mt-2 text-sm text-cream/70">Calm score</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Stat label="Practices" value={String(profile?.completed ?? 0)} />
          <Stat label="Streak" value={`${profile?.dayStreak ?? 0} days`} />
        </div>
      </div>
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

function Nav({ active, onChange }: { active: Page; onChange: (page: Page) => void }) {
  const items: Array<{ page: Page; label: string; icon: typeof Home }> = [
    { page: 'home', label: 'Home', icon: Home },
    { page: 'practices', label: 'Library', icon: BookOpen },
    { page: 'breathwork', label: 'Breathe', icon: Wind },
    { page: 'sleep', label: 'Sleep', icon: Moon },
    { page: 'profile', label: 'Profile', icon: User }
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-cream/10 bg-night/80 px-3 py-3 backdrop-blur-xl">
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const selected = active === item.page;
          return (
            <button
              key={item.page}
              onClick={() => onChange(item.page)}
              className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] ${
                selected ? 'bg-cream/15 text-cream' : 'text-cream/55'
              }`}
            >
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
