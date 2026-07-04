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
  Volume2,
  Waves,
  X,
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
  plantMoonGardenElement,
  recordSceneMoonSeed,
  saveDailyCheckin,
  saveBreathSession,
  saveHistory,
  setFavorite,
  syncUser,
  updateMoonGardenDevState,
  updateUserLanguage,
  updateMeditation,
  updateAdminUserAccess,
  uploadAdminAsset,
  type AccessState,
  type AdminDashboardData,
  type AdminUser,
  type AppLanguage,
  type Category,
  type DailyCheckin,
  type DailyCheckinPayload,
  type Meditation,
  type MeditationPayload,
  type MoonGardenDevAction,
  type PlaybackHistory,
  type ProfileStats,
  type WellnessSummary
} from './api';
import { MoonGardenScene as AnimatedMoonGardenScene } from './components/moon-garden/MoonGardenScene';

type Page = 'home' | 'library' | 'favorites' | 'profile' | 'pricing' | 'player' | 'scenePlayer' | 'breathCircle' | 'moonGarden' | 'admin';
type Mood = 'Calm' | 'Stressed' | 'Tired' | 'Anxious' | 'Focused';
type MoodChip = 'Sleep' | 'Calm' | 'Focus' | 'Anxiety' | 'Breath' | 'Energy';
type LibraryMode = 'meditations' | 'scenes';
type SceneAccess = 'free' | 'premium';
type BreathMode = 'calm' | 'box' | 'reset';
type GardenElementType = 'bloom' | 'light' | 'path' | 'bridge' | 'water' | 'sanctuary';
type GardenVisual = 'bloom' | 'lantern' | 'path' | 'twinBloom' | 'bridge' | 'reflection' | 'garden';
type GardenElement = {
  id: string;
  name: Record<AppLanguage, string>;
  description: Record<AppLanguage, string>;
  type: GardenElementType;
  cost: number;
  unlockLevel: number;
  visual: GardenVisual;
};
type SceneDefinition = {
  id: string;
  title: Record<AppLanguage, string>;
  subtitle: Record<AppLanguage, string>;
  description: Record<AppLanguage, string>;
  mood: string;
  category: string;
  access: SceneAccess;
  sortOrder: number;
  cover: string;
  sound: 'water' | 'ocean' | 'mist' | 'forest' | 'rain';
};

const moods: MoodChip[] = ['Sleep', 'Calm', 'Focus', 'Anxiety', 'Breath', 'Energy'];
const meditationMoods: Mood[] = ['Calm', 'Stressed', 'Tired', 'Anxious', 'Focused'];
const premiumPrices = {
  monthly: 499,
  lifetime: 2499
};
const libraryCacheKey = 'luna.library.v1';
const languageStorageKey = 'luna.language.v1';
const moonGardenVolumeStorageKey = 'luna.moonGarden.volume.v1';
const moonGardenAmbienceUrl = '/assets/audio/moon-garden/moon-garden-ambience.wav';
const playerFixVersion = 'pause-seek-isolation-v5';
const sceneAudioCache = new Map<string, string>();
type LibraryCache = {
  categories: Category[];
  meditations: Meditation[];
  savedAt: number;
};

function sceneCover(seed: string, accent: string, glow: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <defs>
        <radialGradient id="moon" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stop-color="${glow}"/>
          <stop offset="46%" stop-color="${accent}"/>
          <stop offset="100%" stop-color="#140f26"/>
        </radialGradient>
        <linearGradient id="gold" x1="0" x2="1">
          <stop stop-color="#f5f1e9"/>
          <stop offset="1" stop-color="#d4af37"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="56" fill="url(#moon)"/>
      <circle cx="382" cy="116" r="54" fill="#f5f1e9" opacity=".92"/>
      <circle cx="404" cy="96" r="54" fill="${accent}" opacity=".55"/>
      <path d="M0 345 C78 306 142 385 229 340 C314 296 366 310 512 258 L512 512 L0 512 Z" fill="#0d0b18" opacity=".72"/>
      <path d="M0 390 C120 350 193 425 305 375 C380 342 430 354 512 318" fill="none" stroke="url(#gold)" stroke-width="5" opacity=".6"/>
      <path d="M74 174 C126 148 177 150 224 176" fill="none" stroke="#f5f1e9" stroke-width="3" opacity=".34"/>
      <path d="M292 188 C339 160 394 163 442 193" fill="none" stroke="#d4af37" stroke-width="3" opacity=".42"/>
      <text x="44" y="444" fill="#f5f1e9" font-family="Georgia, serif" font-size="38" letter-spacing="4">${seed}</text>
    </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const scenes = ([
  {
    id: 'moon-lake',
    title: { en: 'Moon Lake', ru: 'Лунное озеро' },
    subtitle: { en: 'Soft water · Night', ru: 'Тихая вода · Ночь' },
    description: { en: 'A slow night lake for sleep and soft calm.', ru: 'Медленное ночное озеро для сна и спокойствия.' },
    mood: 'Sleep / Calm',
    category: 'sleep',
    access: 'free',
    sortOrder: 1,
    cover: sceneCover('MOON LAKE', '#4b2d68', '#8e5fd6'),
    sound: 'water'
  },
  {
    id: 'ocean-breath',
    title: { en: 'Ocean Breath', ru: 'Дыхание океана' },
    subtitle: { en: 'Gentle waves · Breath', ru: 'Мягкие волны · Дыхание' },
    description: { en: 'A breathing ocean pulse for exhale-led rest.', ru: 'Океанский ритм для мягкого выдоха и отдыха.' },
    mood: 'Breath / Calm',
    category: 'breath',
    access: 'premium',
    sortOrder: 2,
    cover: sceneCover('OCEAN', '#214562', '#77b8d8'),
    sound: 'ocean'
  },
  {
    id: 'morning-mist',
    title: { en: 'Morning Mist', ru: 'Утренний туман' },
    subtitle: { en: 'Soft air · Focus', ru: 'Мягкий воздух · Фокус' },
    description: { en: 'A clear, airy layer for gentle focus.', ru: 'Прозрачный воздушный фон для мягкого фокуса.' },
    mood: 'Morning / Focus',
    category: 'focus',
    access: 'premium',
    sortOrder: 3,
    cover: sceneCover('MIST', '#5c4a82', '#e0b7c9'),
    sound: 'mist'
  },
  {
    id: 'forest-calm',
    title: { en: 'Forest Calm', ru: 'Лесное спокойствие' },
    subtitle: { en: 'Leaves · Calm', ru: 'Листья · Спокойствие' },
    description: { en: 'A quiet forest bed with slow leaf movement.', ru: 'Тихий лесной фон с мягким движением листвы.' },
    mood: 'Calm / Nature',
    category: 'nature',
    access: 'premium',
    sortOrder: 4,
    cover: sceneCover('FOREST', '#1f513b', '#9fcf9d'),
    sound: 'forest'
  },
  {
    id: 'soft-rain',
    title: { en: 'Soft Rain', ru: 'Мягкий дождь' },
    subtitle: { en: 'Light rain · Rest', ru: 'Лёгкий дождь · Отдых' },
    description: { en: 'A soft rain loop for winding down.', ru: 'Мягкий дождевой цикл для замедления.' },
    mood: 'Sleep / Rest',
    category: 'sleep',
    access: 'premium',
    sortOrder: 5,
    cover: sceneCover('RAIN', '#28375e', '#9fb5ff'),
    sound: 'rain'
  }
] satisfies SceneDefinition[]).sort((left, right) => left.sortOrder - right.sortOrder);

const gardenElements: GardenElement[] = [
  {
    id: 'first_bloom',
    name: { en: 'First Bloom', ru: 'Первый цветок' },
    description: { en: 'The first bloom opens in your quiet place.', ru: 'Первый цветок раскрывается в твоём тихом месте.' },
    cost: 10,
    type: 'bloom',
    unlockLevel: 1,
    visual: 'bloom'
  },
  {
    id: 'lantern_glow',
    name: { en: 'Lantern Glow', ru: 'Свет фонаря' },
    description: { en: 'A warm light begins to guide the path.', ru: 'Тёплый свет начинает вести по тропе.' },
    cost: 10,
    type: 'light',
    unlockLevel: 2,
    visual: 'lantern'
  },
  {
    id: 'stone_path',
    name: { en: 'Stone Path', ru: 'Каменная тропа' },
    description: { en: 'A path through calm begins to take shape.', ru: 'Путь через спокойствие начинает обретать форму.' },
    cost: 10,
    type: 'path',
    unlockLevel: 3,
    visual: 'path'
  },
  {
    id: 'twin_bloom',
    name: { en: 'Twin Bloom', ru: 'Два цветка' },
    description: { en: 'Your garden begins to bloom more fully.', ru: 'Твой сад начинает расцветать полнее.' },
    cost: 10,
    type: 'bloom',
    unlockLevel: 4,
    visual: 'twinBloom'
  },
  {
    id: 'moon_bridge',
    name: { en: 'Moon Bridge', ru: 'Лунный мост' },
    description: { en: 'A bridge appears across the moonlit water.', ru: 'Мост появляется над лунной водой.' },
    cost: 10,
    type: 'bridge',
    unlockLevel: 5,
    visual: 'bridge'
  },
  {
    id: 'reflection_garden',
    name: { en: 'Reflection Garden', ru: 'Сад отражений' },
    description: { en: 'Reflections deepen in your quiet place.', ru: 'Отражения становятся глубже в твоём тихом месте.' },
    cost: 10,
    type: 'water',
    unlockLevel: 6,
    visual: 'reflection'
  },
  {
    id: 'full_moon_garden',
    name: { en: 'Full Moon Garden', ru: 'Сад полной луны' },
    description: { en: 'Your Moon Garden becomes a flourishing sanctuary.', ru: 'Твой Лунный сад становится цветущим убежищем.' },
    cost: 10,
    type: 'sanctuary',
    unlockLevel: 7,
    visual: 'garden'
  }
];

const gardenStages = [
  {
    level: 0,
    minPlantedUpgrades: 0,
    title: { en: 'Empty Garden', ru: 'Пустой сад' },
    path: '/assets/moon-garden/level-0-empty-garden.png',
    subtitle: { en: 'Your quiet place is waiting for its first seed.', ru: 'Твоё тихое место ждёт первое семя.' }
  },
  {
    level: 1,
    minPlantedUpgrades: 1,
    title: { en: 'First Bloom', ru: 'Первый цветок' },
    path: '/assets/moon-garden/level-1-first-bloom.png',
    subtitle: { en: 'The first bloom has opened.', ru: 'Первый цветок раскрылся.' }
  },
  {
    level: 2,
    minPlantedUpgrades: 2,
    title: { en: 'Lantern Glow', ru: 'Свет фонаря' },
    path: '/assets/moon-garden/level-2-lantern-glow.png',
    subtitle: { en: 'A warm light now guides the path.', ru: 'Тёплый свет теперь ведёт по тропе.' }
  },
  {
    level: 3,
    minPlantedUpgrades: 3,
    title: { en: 'Stone Path', ru: 'Каменная тропа' },
    path: '/assets/moon-garden/level-3-stone-path.png',
    subtitle: { en: 'Your path through calm is taking shape.', ru: 'Твой путь к спокойствию обретает форму.' }
  },
  {
    level: 4,
    minPlantedUpgrades: 4,
    title: { en: 'Twin Bloom', ru: 'Два цветка' },
    path: '/assets/moon-garden/level-4-twin-bloom.png',
    subtitle: { en: 'Your garden begins to bloom.', ru: 'Твой сад начинает расцветать.' }
  },
  {
    level: 5,
    minPlantedUpgrades: 5,
    title: { en: 'Moon Bridge', ru: 'Лунный мост' },
    path: '/assets/moon-garden/level-5-moon-bridge.png',
    subtitle: { en: 'A bridge appears across the moonlit water.', ru: 'Над лунной водой появляется мост.' }
  },
  {
    level: 6,
    minPlantedUpgrades: 6,
    title: { en: 'Reflection Garden', ru: 'Сад отражений' },
    path: '/assets/moon-garden/level-6-reflection-garden.png',
    subtitle: { en: 'Reflections deepen in your quiet place.', ru: 'Отражения становятся глубже в твоём тихом месте.' }
  },
  {
    level: 7,
    minPlantedUpgrades: 7,
    title: { en: 'Full Moon Garden', ru: 'Сад полной луны' },
    path: '/assets/moon-garden/level-7-full-moon-garden.png',
    subtitle: { en: 'Your Moon Garden is flourishing.', ru: 'Твой Лунный сад расцветает.' }
  }
];

function createSceneAudioUrl(kind: SceneDefinition['sound']) {
  const cached = sceneAudioCache.get(kind);
  if (cached) return cached;

  const sampleRate = 22050;
  const seconds = 5;
  const totalSamples = sampleRate * seconds;
  const samples = new Float32Array(totalSamples);
  const base = kind === 'ocean' ? 0.18 : kind === 'rain' ? 0.12 : kind === 'forest' ? 0.1 : kind === 'mist' ? 0.08 : 0.11;

  for (let index = 0; index < totalSamples; index += 1) {
    const t = index / sampleRate;
    const cycle = t / seconds;
    const fade = Math.min(1, index / 1400, (totalSamples - index) / 1400);
    const wave = Math.sin(Math.PI * 2 * cycle);
    const noise = (Math.random() * 2 - 1) * base;
    const low = Math.sin(Math.PI * 2 * (kind === 'mist' ? 110 : 72) * t) * 0.025;
    const pulse = kind === 'ocean'
      ? Math.sin(Math.PI * 2 * 0.32 * t) * 0.12
      : kind === 'water'
        ? Math.sin(Math.PI * 2 * 0.21 * t) * 0.08
        : kind === 'rain'
          ? Math.random() * 0.12
          : kind === 'forest'
            ? Math.sin(Math.PI * 2 * 0.17 * t) * 0.05
            : Math.sin(Math.PI * 2 * 0.12 * t) * 0.035;
    samples[index] = Math.max(-0.8, Math.min(0.8, (noise * (0.55 + Math.abs(wave) * 0.45) + low + pulse) * fade));
  }

  const dataSize = totalSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  samples.forEach((sample) => {
    view.setInt16(offset, sample * 32767, true);
    offset += 2;
  });

  const url = URL.createObjectURL(new Blob([view], { type: 'audio/wav' }));
  sceneAudioCache.set(kind, url);
  return url;
}

const copy = {
  en: {
    tagline: 'AI Guided Calm Inside Telegram',
    language: 'Language',
    premium: 'Premium',
    free: 'Free',
    begin: 'Begin',
    play: 'Play',
    resume: 'Continue',
    favorite: 'Favorite',
    share: 'Share',
    timer: 'Timer',
    availableInEnglish: 'Available in English',
    loadingAudio: 'Loading audio...',
    sharingFreeOnly: 'Sharing is available for free meditations.',
    linkCopied: 'Link copied.',
    copyFailed: 'Copy failed. Please try again.',
    goodMorning: 'Good morning',
    goodAfternoon: 'Good afternoon',
    goodEvening: 'Good evening',
    feeling: 'How are you feeling today?',
    todayMeditation: "Today's Meditation",
    recommendedForYou: 'Recommended for You',
    forYourMood: 'For Your Mood',
    moreToExplore: 'More to Explore',
    exploreLibrary: 'Explore Library',
    openLibrary: 'Open Library',
    libraryTitle: 'Luna Library',
    meditationsTab: 'Meditations',
    scenesTab: 'Scenes',
    scenesTitle: 'Soundscapes',
    scenesHomeTitle: 'Scenes',
    scenesHomeBody: 'Play calming soundscapes while Luna is open.',
    scenesLibraryBody: 'Loopable ambience for sleep, breath, and focus.',
    sceneLoop: 'Loop enabled',
    sceneVolume: 'Scene volume',
    scenePremiumLocked: 'Premium soundscape',
    sceneUpgradeBody: 'Unlock premium scenes with Luna Premium.',
    noScene: 'Choose a scene to begin.',
    closeScene: 'Close scene player',
    changeScene: 'Change scene',
    searchByTitle: 'Search by title',
    all: 'All',
    short: 'Short',
    noMeditations: 'No meditations found.',
    noMeditationsBody: 'Try another mood, category, or search phrase.',
    firstPracticeTitle: 'Your first calm practice is coming soon.',
    firstPracticeBody: 'Luna’s library will appear here as soon as new meditations are published.',
    unlockPremium: 'Unlock Premium',
    popularToday: 'Popular today',
    profile: 'Profile',
    member: 'Luna member',
    restore: 'Restore purchases',
    checkinKicker: 'DAILY CHECK-IN',
    checkinTitle: 'How is your inner weather?',
    checkinSleep: 'Sleep last night',
    checkinMood: 'Mood right now',
    checkinTime: 'Time available',
    checkinSaveError: 'Could not save your check-in. Please try again.',
    checkinSave: 'Save today',
    checkinSaving: 'Saving...',
    checkinSkip: 'Skip',
    checkinSaved: '✓ Today’s check-in saved',
    checkins: 'Check-Ins',
    sleepLess4: '<4h',
    sleep4To6: '4-6h',
    sleep6To8: '6-8h',
    sleep8Plus: '8h+',
    moodCalm: 'Calm',
    moodStressed: 'Stressed',
    moodTired: 'Tired',
    moodAnxious: 'Anxious',
    moodFocused: 'Focused',
    moodLowEnergy: 'Low energy',
    minutes3: '3 min',
    minutes5: '5 min',
    minutes10: '10 min',
    minutes15Plus: '15+ min',
    navHome: 'Home',
    navLibrary: 'Library',
    navSaved: 'Saved',
    navPremium: 'Premium',
    navProfile: 'Profile',
    categorySleep: 'Sleep',
    categoryCalm: 'Calm',
    categoryFocus: 'Focus',
    categoryAnxiety: 'Anxiety',
    categoryBreath: 'Breath',
    categoryEnergy: 'Energy',
    categoryStress: 'Stress',
    categoryMorning: 'Morning',
    categoryEvening: 'Evening',
    categoryBreathing: 'Breathing',
    categoryQuickReset: 'Quick Reset',
    categoryDeepRelaxation: 'Deep Relaxation',
    moodSleep: 'Sleep',
    moodEnergy: 'Energy',
    continueListening: 'Continue listening',
    recentlyPlayed: 'Recently played',
    popularMeditations: 'Popular meditations',
    breathingExercises: 'Breathing exercises',
    premiumRecommendations: 'Premium recommendations',
    weeklyTitle: 'This week with Luna',
    weeklyInsightMinutes: 'You created {minutes} minutes of calm. A small repeat tomorrow matters more than a perfect session.',
    weeklyInsightStart: 'A short check-in is enough to begin. Luna will personalize your next practice from there.',
    weeklyInsightShort: 'Start with one short practice today. Luna will build your weekly insight as you check in and listen.',
    recommendedFocus: 'Recommended focus: {focus}',
    focusBreathAnxiety: 'Breath and anxiety relief',
    focusSleepRecovery: 'Sleep recovery',
    focusKeepStreak: 'Keep the streak gentle',
    focusShortReset: 'A short calm reset',
    preparingCalm: 'Preparing your calm',
    savedTitle: 'Your Sanctuary',
    savedSubtitle: 'Practices you saved to return to.',
    savedEmptyTitle: 'Your saved calm will live here.',
    savedEmptyBody: 'Tap the heart on any meditation to build a small refuge you can return to anytime.',
    premiumTitle: 'Luna Premium',
    premiumHeadline: 'Unlock your calm.',
    premiumBody: 'Full library, premium breathwork, daily streaks and new practices every week.',
    premiumLibrary: 'Premium Library',
    weeklyContent: 'Weekly Content',
    dailyStreak: 'Daily Streak',
    lockedPremium: '{title} is part of Luna Premium.',
    monthlyPremium: 'Monthly Premium',
    lifetimePremium: 'Lifetime Premium',
    unlimitedMeditations: 'Unlimited meditations',
    premiumBreathing: 'Premium breathing',
    sleepAnxietyFocus: 'Sleep, anxiety and focus',
    dailyStreaks: 'Daily streaks',
    premiumForever: 'Premium library forever',
    allFuturePractices: 'All future practices',
    bestValue: 'Best value',
    instantTelegramUnlock: 'Instant Telegram unlock',
    unlockMonthly: 'Unlock Monthly',
    getLifetime: 'Get Lifetime',
    sleepDeeper: 'Sleep deeper',
    sleepDeeperBody: 'Evening practices made for softer endings.',
    calmFaster: 'Calm faster',
    calmFasterBody: 'Breath-led resets for anxious moments.',
    buildRhythm: 'Build rhythm',
    buildRhythmBody: 'Streaks, favorites, and weekly guidance.',
    growGently: 'Grow gently',
    growGentlyBody: 'New meditations as your needs change.',
    freePlanFeature: 'Basic meditations only',
    comingSoon: 'Coming Soon',
    starsAvailable: 'Telegram Stars are available now for Luna Premium.',
    close: 'Close',
    openPremiumLibrary: 'Open Premium Library',
    openingPayment: 'Opening payment...',
    openingStarsPayment: 'Opening Telegram Stars payment...',
    paymentSuccessful: 'Payment successful. Your Luna access is unlocked.',
    paymentCancelled: 'Payment cancelled. You can restart checkout anytime.',
    paymentPending: 'Payment is pending. Telegram will confirm it shortly.',
    invoiceOpened: 'Invoice opened in Telegram. Complete payment there to unlock access.',
    paymentFailed: 'Payment could not open. Please try again, or open the bot and use /plans.',
    sessionComplete: 'Session Complete',
    sessionCompleteBody: 'You gave yourself a moment of calm.',
    sessionCompleteAlt: 'You returned to yourself for a few minutes.',
    minutesPracticed: 'Minutes practiced',
    plusCalmPoint: '+1 Calm Point',
    plusMoonSeed: '+1 Moon Seed',
    returnHome: 'Return Home',
    continueListeningButton: 'Continue Listening',
    viewProgress: 'View Progress',
    elapsedRemaining: '{elapsed} elapsed · {remaining} remaining',
    playbackSpeed: 'Playback speed',
    rewind15: 'Rewind 15 seconds',
    forward15: 'Forward 15 seconds',
    profileLevel: 'Level {level}',
    levelFirstLight: 'First Light',
    levelCalmBuilder: 'Calm Builder',
    levelMoonGuide: 'Moon Guide',
    levelDeepPractice: 'Deep Practice',
    nextLevel: 'Next: {level}',
    memberSince: 'Member since',
    premiumStatus: 'Premium status',
    active: 'Active',
    activeUntil: 'Active until',
    notActive: 'Not active',
    minutesMeditated: 'Minutes meditated',
    completedSessions: 'Completed sessions',
    currentStreak: 'Current streak',
    longestStreak: 'Longest streak',
    moonGarden: 'Moon Garden',
    moonGardenBody: 'Your calm grows with every practice.',
    openMoonGarden: 'Open Moon Garden',
    availableMoonSeeds: 'Available Moon Seeds',
    plantedElements: 'Planted upgrades',
    nextUnlock: 'Next unlock',
    readyToPlant: 'Ready to plant: {name}',
    completePracticeSeed: 'Complete a practice to earn your next Moon Seed.',
    plant: 'Plant',
    planting: 'Planting...',
    planted: 'Planted',
    locked: 'Locked',
    availableToPlant: 'Available to plant',
    needMoreSeeds: 'Need {count} more seeds',
    gardenElements: 'Garden Upgrades',
    nextSuggestedElement: 'Next suggested upgrade',
    gardenComplete: 'Garden Complete',
    plantUpgrade: 'Plant Upgrade',
    cost: 'Cost',
    gardenGrew: 'Your garden grew a little today.',
    elementPlanted: '{name} planted.',
    alreadyPlanted: 'This upgrade is already planted.',
    notEnoughSeeds: 'Not enough Moon Seeds yet.',
    gardenLevel: 'Garden level',
    moonSeeds: 'Moon Seeds',
    moonSeedsInfo: 'Moon Seeds grow when you complete practices.',
    playGardenAmbience: 'Play ambience',
    pauseGardenAmbience: 'Pause ambience',
    gardenAmbience: 'Moon Garden ambience',
    gardenAmbienceUnavailable: 'Ambience unavailable',
    developerTools: 'Admin Garden Tools',
    grant100Seeds: 'Grant 100 Seeds',
    unlockFullGarden: 'Unlock Full Garden',
    resetGarden: 'Reset Garden & Seeds',
    resetPlantedGarden: 'Reset My Garden',
    seedBalanceQuickSet: 'Seed balance quick set',
    setSeeds: 'Set to {count}',
    gardenUpdated: 'Moon Garden updated.',
    unlocksLevel: 'Unlocks Level {level}',
    gardenTakingShape: 'Your garden is taking shape.',
    gardenFlourishing: 'Your moon garden is flourishing.',
    gardenQuietPlace: 'Your quiet place is growing.',
    calmPoints: 'Calm Points',
    totalPractice: 'Total Practice',
    thisWeek: 'This Week',
    quietRhythm: 'Quiet Rhythm',
    totalMinutesWithLuna: 'Total minutes with Luna',
    totalPracticeMinutes: 'Total practice minutes',
    breathSessions: 'Breath sessions',
    yourRhythm: 'Your rhythm is growing.',
    returnedToday: 'You returned today.',
    newBeginning: 'Every day is a new beginning.',
    levelGentleRhythm: 'Gentle Rhythm',
    levelQuietGarden: 'Quiet Garden',
    levelMoonlitPath: 'Moonlit Path',
    levelInnerSanctuary: 'Inner Sanctuary',
    breathCircle: 'Breath Circle',
    breathCircleSubtitle: 'Breathe with the moon',
    breathCircleBody: 'A quiet visual guide for returning to yourself.',
    startBreathing: 'Start breathing',
    pauseBreathing: 'Pause',
    calmBreath: 'Calm Breath',
    calmBreathBody: 'Inhale 4 · Exhale 6',
    boxBreath: 'Box Breath',
    boxBreathBody: 'Inhale 4 · Hold 4 · Exhale 4 · Hold 4',
    softReset: 'Soft Reset',
    softResetBody: 'A natural slow visual guide',
    inhale: 'Inhale',
    hold: 'Hold',
    exhale: 'Exhale',
    breatheNaturally: 'Breathe naturally',
    breathComplete: 'Breath practice complete',
    calmBreathsComplete: 'You completed {count} calm breaths.',
    minutesToReturn: 'You took {minutes} minutes to return.',
    breathSaveError: 'Could not save your breath practice. Your moment still counts.',
    calmScore: 'Calm score',
    weeklyCheckins: 'Weekly check-ins',
    averageSleep: 'Average sleep',
    currentMood: 'Current mood',
    premiumActive: 'Premium Active',
    premiumFree: 'Free Plan',
    weeklyInsightZero: 'Your calm can begin with one minute today.',
    weeklyInsightSmall: 'You started your rhythm this week. Even a few minutes can become a gentle habit.',
    weeklyInsightStrong: 'You spent {minutes} minutes with Luna this week. A small return tomorrow matters more than a perfect session.',
    preferredLength: 'Preferred length',
    today: 'Today',
    noCheckinsYet: 'No check-ins yet',
    notEnoughData: 'Not enough data',
    notSet: 'Not set',
    weeklyInsightTitle: 'Your weekly insight',
    achievements: 'Achievements',
    streakReward: 'Streak reward',
    logout: 'Logout'
  },
  ru: {
    tagline: 'AI-спокойствие внутри Telegram',
    language: 'Язык',
    premium: 'Премиум',
    free: 'Бесплатно',
    begin: 'Начать',
    play: 'Слушать',
    resume: 'Продолжить',
    favorite: 'В избранное',
    share: 'Поделиться',
    timer: 'Таймер',
    availableInEnglish: 'Доступно на английском',
    loadingAudio: 'Загружаю аудио...',
    sharingFreeOnly: 'Поделиться можно только бесплатными медитациями.',
    linkCopied: 'Ссылка скопирована.',
    copyFailed: 'Не удалось скопировать. Попробуй еще раз.',
    goodMorning: 'Доброе утро',
    goodAfternoon: 'Добрый день',
    goodEvening: 'Добрый вечер',
    feeling: 'Как ты себя чувствуешь сегодня?',
    todayMeditation: 'Медитация дня',
    recommendedForYou: 'Рекомендация для тебя',
    forYourMood: 'Под твоё настроение',
    moreToExplore: 'Ещё для практики',
    exploreLibrary: 'Открыть библиотеку',
    openLibrary: 'Открыть библиотеку',
    libraryTitle: 'Библиотека Luna',
    meditationsTab: 'Медитации',
    scenesTab: 'Сцены',
    scenesTitle: 'Саундскейпы',
    scenesHomeTitle: 'Сцены',
    scenesHomeBody: 'Включи спокойный фон, пока Luna открыта.',
    scenesLibraryBody: 'Зацикленные звуки для сна, дыхания и фокуса.',
    sceneLoop: 'Повтор включён',
    sceneVolume: 'Громкость сцены',
    scenePremiumLocked: 'Премиум-сцена',
    sceneUpgradeBody: 'Открой премиум-сцены с Luna Premium.',
    noScene: 'Выбери сцену, чтобы начать.',
    closeScene: 'Закрыть плеер сцен',
    changeScene: 'Сменить сцену',
    searchByTitle: 'Поиск по названию',
    all: 'Все',
    short: 'Короткие',
    noMeditations: 'Медитации не найдены.',
    noMeditationsBody: 'Попробуй другое настроение, категорию или запрос.',
    firstPracticeTitle: 'Первая практика скоро появится.',
    firstPracticeBody: 'Библиотека Luna появится здесь, когда медитации будут опубликованы.',
    unlockPremium: 'Открыть Premium',
    popularToday: 'Популярно сегодня',
    profile: 'Профиль',
    member: 'Участник Luna',
    restore: 'Восстановить покупки',
    checkinKicker: 'ЕЖЕДНЕВНЫЙ ЧЕК-ИН',
    checkinTitle: 'Как ты чувствуешь себя внутри?',
    checkinSleep: 'Сон прошлой ночью',
    checkinMood: 'Настроение сейчас',
    checkinTime: 'Сколько есть времени',
    checkinSaveError: 'Не удалось сохранить чек-ин. Попробуй ещё раз.',
    checkinSave: 'Сохранить',
    checkinSaving: 'Сохраняю...',
    checkinSkip: 'Пропустить',
    checkinSaved: '✓ Чекин на сегодня сохранен',
    checkins: 'Чек-ины',
    sleepLess4: '<4 ч',
    sleep4To6: '4–6 ч',
    sleep6To8: '6–8 ч',
    sleep8Plus: '8+ ч',
    moodCalm: 'Спокойно',
    moodStressed: 'Стресс',
    moodTired: 'Усталость',
    moodAnxious: 'Тревожно',
    moodFocused: 'Фокус',
    moodLowEnergy: 'Мало энергии',
    minutes3: '3 мин',
    minutes5: '5 мин',
    minutes10: '10 мин',
    minutes15Plus: '15+ мин',
    navHome: 'Главная',
    navLibrary: 'Библиотека',
    navSaved: 'Сохранённое',
    navPremium: 'Премиум',
    navProfile: 'Профиль',
    categorySleep: 'Сон',
    categoryCalm: 'Спокойствие',
    categoryFocus: 'Фокус',
    categoryAnxiety: 'Тревога',
    categoryBreath: 'Дыхание',
    categoryEnergy: 'Энергия',
    categoryStress: 'Стресс',
    categoryMorning: 'Утро',
    categoryEvening: 'Вечер',
    categoryBreathing: 'Дыхание',
    categoryQuickReset: 'Быстрый сброс',
    categoryDeepRelaxation: 'Глубокое расслабление',
    moodSleep: 'Сон',
    moodEnergy: 'Энергия',
    continueListening: 'Продолжить слушать',
    recentlyPlayed: 'Недавно прослушано',
    popularMeditations: 'Популярные медитации',
    breathingExercises: 'Дыхательные практики',
    premiumRecommendations: 'Премиум-рекомендации',
    weeklyTitle: 'Эта неделя с Luna',
    weeklyInsightMinutes: 'Ты создал(а) {minutes} минут спокойствия. Небольшая практика завтра важнее идеальной сессии.',
    weeklyInsightStart: 'Короткого чек-ина достаточно, чтобы начать. Luna подберёт следующую практику по твоему состоянию.',
    weeklyInsightShort: 'Начни с одной короткой практики сегодня. Luna соберёт недельный инсайт по чек-инам и прослушиваниям.',
    recommendedFocus: 'Рекомендация: {focus}',
    focusBreathAnxiety: 'Дыхание и снижение тревоги',
    focusSleepRecovery: 'Восстановление сна',
    focusKeepStreak: 'поддерживай серию мягко',
    focusShortReset: 'Короткий сброс к спокойствию',
    preparingCalm: 'Готовим твоё спокойствие',
    savedTitle: 'Твоё пространство',
    savedSubtitle: 'Практики, к которым ты хочешь вернуться.',
    savedEmptyTitle: 'Здесь будет твоё сохранённое спокойствие.',
    savedEmptyBody: 'Нажми сердечко на любой медитации, чтобы собрать практики для возвращения.',
    premiumTitle: 'Luna Premium',
    premiumHeadline: 'Открой своё спокойствие.',
    premiumBody: 'Полная библиотека, премиальные дыхательные практики, ежедневные серии и новые медитации каждую неделю.',
    premiumLibrary: 'Премиум-библиотека',
    weeklyContent: 'Новый контент каждую неделю',
    dailyStreak: 'Ежедневная серия',
    lockedPremium: '{title} входит в Luna Premium.',
    monthlyPremium: 'Месячный Premium',
    lifetimePremium: 'Lifetime Premium',
    unlimitedMeditations: 'Безлимитные медитации',
    premiumBreathing: 'Премиальное дыхание',
    sleepAnxietyFocus: 'Сон, тревога и фокус',
    dailyStreaks: 'Ежедневные серии',
    premiumForever: 'Премиум-библиотека навсегда',
    allFuturePractices: 'Все будущие практики',
    bestValue: 'Лучшая ценность',
    instantTelegramUnlock: 'Мгновенный доступ в Telegram',
    unlockMonthly: 'Открыть на месяц',
    getLifetime: 'Получить навсегда',
    sleepDeeper: 'Глубже засыпать',
    sleepDeeperBody: 'Вечерние практики для мягкого расслабления.',
    calmFaster: 'Быстрее успокоиться',
    calmFasterBody: 'Дыхательные практики для тревожных моментов.',
    buildRhythm: 'Создать ритм',
    buildRhythmBody: 'Серии, избранное и еженедельная поддержка.',
    growGently: 'Расти мягко',
    growGentlyBody: 'Новые медитации под твои меняющиеся состояния.',
    freePlanFeature: 'Только базовые медитации',
    comingSoon: 'Скоро',
    starsAvailable: 'Telegram Stars уже доступны для Luna Premium.',
    close: 'Закрыть',
    openPremiumLibrary: 'Открыть Premium-библиотеку',
    openingPayment: 'Открываем оплату...',
    openingStarsPayment: 'Открываем оплату Telegram Stars...',
    paymentSuccessful: 'Оплата прошла. Доступ Luna открыт.',
    paymentCancelled: 'Оплата отменена. Можно начать снова в любой момент.',
    paymentPending: 'Оплата ожидает подтверждения. Telegram скоро подтвердит её.',
    invoiceOpened: 'Счёт открыт в Telegram. Заверши оплату там, чтобы открыть доступ.',
    paymentFailed: 'Не удалось открыть оплату. Попробуй ещё раз или открой бота и используй /plans.',
    sessionComplete: 'Сессия завершена',
    sessionCompleteBody: 'Ты подарил(а) себе момент спокойствия.',
    sessionCompleteAlt: 'Ты вернулся(ась) к себе на несколько минут.',
    minutesPracticed: 'Минут практики',
    plusCalmPoint: '+1 балл спокойствия',
    plusMoonSeed: '+1 лунное семя',
    returnHome: 'На главную',
    continueListeningButton: 'Продолжить слушать',
    viewProgress: 'Посмотреть прогресс',
    elapsedRemaining: '{elapsed} прошло · {remaining} осталось',
    playbackSpeed: 'Скорость воспроизведения',
    rewind15: 'Назад на 15 секунд',
    forward15: 'Вперёд на 15 секунд',
    profileLevel: 'Уровень {level}',
    levelFirstLight: 'Первый свет',
    levelCalmBuilder: 'Спокойствие',
    levelMoonGuide: 'Лунный проводник',
    levelDeepPractice: 'Глубокая практика',
    nextLevel: 'Далее: {level}',
    memberSince: 'С нами с',
    premiumStatus: 'Статус Premium',
    active: 'Активен',
    activeUntil: 'Активен до',
    notActive: 'Не активен',
    minutesMeditated: 'Минут медитации',
    completedSessions: 'Завершено сессий',
    currentStreak: 'Текущая серия',
    longestStreak: 'Лучшая серия',
    moonGarden: 'Лунный сад',
    moonGardenBody: 'Твоё спокойствие растёт с каждой практикой.',
    openMoonGarden: 'Открыть Лунный сад',
    availableMoonSeeds: 'Доступные лунные семена',
    plantedElements: 'Посажено улучшений',
    nextUnlock: 'Следующее открытие',
    readyToPlant: 'Можно посадить: {name}',
    completePracticeSeed: 'Заверши практику, чтобы получить следующее лунное семя.',
    plant: 'Посадить',
    planting: 'Сажаем...',
    planted: 'Посажено',
    locked: 'Закрыто',
    availableToPlant: 'Можно посадить',
    needMoreSeeds: 'Нужно ещё {count} сем.',
    gardenElements: 'Улучшения сада',
    nextSuggestedElement: 'Следующее улучшение',
    gardenComplete: 'Сад завершён',
    plantUpgrade: 'Посадить улучшение',
    cost: 'Стоимость',
    gardenGrew: 'Твой сад сегодня немного вырос.',
    elementPlanted: '{name} посажен.',
    alreadyPlanted: 'Это улучшение уже посажено.',
    notEnoughSeeds: 'Пока не хватает лунных семян.',
    gardenLevel: 'Уровень сада',
    moonSeeds: 'Лунные семена',
    moonSeedsInfo: 'Лунные семена растут, когда ты завершаешь практики.',
    playGardenAmbience: 'Включить атмосферу',
    pauseGardenAmbience: 'Пауза атмосферы',
    gardenAmbience: 'Атмосфера Лунного сада',
    gardenAmbienceUnavailable: 'Атмосфера недоступна',
    developerTools: 'Admin Garden Tools',
    grant100Seeds: 'Добавить 100 семян',
    unlockFullGarden: 'Открыть весь сад',
    resetGarden: 'Сбросить сад и семена',
    resetPlantedGarden: 'Сбросить мой сад',
    seedBalanceQuickSet: 'Быстрый баланс семян',
    setSeeds: 'Поставить {count}',
    gardenUpdated: 'Лунный сад обновлён.',
    unlocksLevel: 'Открывает уровень {level}',
    gardenTakingShape: 'Твой сад обретает форму.',
    gardenFlourishing: 'Твой лунный сад расцветает.',
    gardenQuietPlace: 'Твоё тихое место растёт.',
    calmPoints: 'Баллы спокойствия',
    totalPractice: 'Практика',
    thisWeek: 'За неделю',
    quietRhythm: 'Тихий ритм',
    totalMinutesWithLuna: 'Минут с Luna',
    totalPracticeMinutes: 'Всего минут практики',
    breathSessions: 'Дыхательные сессии',
    yourRhythm: 'Твой ритм растёт.',
    returnedToday: 'Сегодня ты вернулся(ась).',
    newBeginning: 'Каждый день — новое начало.',
    levelGentleRhythm: 'Мягкий ритм',
    levelQuietGarden: 'Тихий сад',
    levelMoonlitPath: 'Лунная тропа',
    levelInnerSanctuary: 'Внутреннее убежище',
    breathCircle: 'Круг дыхания',
    breathCircleSubtitle: 'Дыши вместе с луной',
    breathCircleBody: 'Спокойный визуальный ритм, чтобы вернуться к себе.',
    startBreathing: 'Начать дыхание',
    pauseBreathing: 'Пауза',
    calmBreath: 'Спокойное дыхание',
    calmBreathBody: 'Вдох 4 · Выдох 6',
    boxBreath: 'Квадратное дыхание',
    boxBreathBody: 'Вдох 4 · Пауза 4 · Выдох 4 · Пауза 4',
    softReset: 'Мягкий сброс',
    softResetBody: 'Естественный медленный визуальный ритм',
    inhale: 'Вдох',
    hold: 'Пауза',
    exhale: 'Выдох',
    breatheNaturally: 'Дыши естественно',
    breathComplete: 'Дыхательная практика завершена',
    calmBreathsComplete: 'Ты сделал(а) {count} спокойных вдохов.',
    minutesToReturn: 'Ты взял(а) {minutes} мин, чтобы вернуться.',
    breathSaveError: 'Не удалось сохранить дыхательную практику. Этот момент всё равно считается.',
    calmScore: 'Индекс спокойствия',
    weeklyCheckins: 'Чек-ины за неделю',
    averageSleep: 'Средний сон',
    currentMood: 'Текущее настроение',
    premiumActive: 'Premium активен',
    premiumFree: 'Бесплатный план',
    weeklyInsightZero: 'Твоё спокойствие может начаться с одной минуты сегодня.',
    weeklyInsightSmall: 'Ты начал(а) свой ритм на этой неделе. Даже несколько минут могут стать мягкой привычкой.',
    weeklyInsightStrong: 'Ты провёл(а) {minutes} минут с Luna на этой неделе. Небольшое возвращение завтра важнее идеальной сессии.',
    preferredLength: 'Желаемая длина',
    today: 'Сегодня',
    noCheckinsYet: 'Пока нет чек-инов',
    notEnoughData: 'Недостаточно данных',
    notSet: 'Не выбрано',
    weeklyInsightTitle: 'Твой недельный инсайт',
    achievements: 'Достижения',
    streakReward: 'Награда за серию',
    logout: 'Выйти'
  }
} satisfies Record<AppLanguage, Record<string, string>>;

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

function languageFromCode(languageCode?: string | null): AppLanguage {
  return languageCode?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

function readStoredLanguage(): AppLanguage | null {
  try {
    const saved = window.localStorage.getItem(languageStorageKey);
    return saved === 'en' || saved === 'ru' ? saved : null;
  } catch {
    return null;
  }
}

function saveStoredLanguage(language: AppLanguage) {
  try {
    window.localStorage.setItem(languageStorageKey, language);
  } catch {
    // Language persistence is best-effort in restricted browser storage.
  }
}

function readMoonGardenVolume() {
  try {
    const saved = Number(window.localStorage.getItem(moonGardenVolumeStorageKey));
    return Number.isFinite(saved) ? Math.max(0, Math.min(1, saved)) : 0.14;
  } catch {
    return 0.14;
  }
}

function initialLanguage(user?: TelegramWebAppUser): AppLanguage {
  return readStoredLanguage() ?? languageFromCode(user?.language_code);
}

function dayGreeting(language: AppLanguage) {
  const hour = new Date().getHours();
  if (hour < 12) return copy[language].goodMorning;
  if (hour < 18) return copy[language].goodAfternoon;
  return copy[language].goodEvening;
}

function text(language: AppLanguage, key: keyof typeof copy.en, replacements: Record<string, string | number> = {}) {
  return Object.entries(replacements).reduce((value, [name, replacement]) => {
    return value.replace(`{${name}}`, String(replacement));
  }, copy[language][key]);
}

function streakLabel(count: number, language: AppLanguage) {
  if (language === 'en') return count === 1 ? '1 quiet day' : `${count} quiet days with Luna`;
  if (count === 1) return '1 тихий день';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return `${count} тихих дня с Luna`;
  return `${count} тихих дней с Luna`;
}

function quietDayCountLabel(count: number, language: AppLanguage) {
  if (language === 'en') return count === 1 ? '1 quiet day' : `${count} quiet days`;
  if (count === 1) return '1 тихий день';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return `${count} тихих дня`;
  return `${count} тихих дней`;
}

function minutesCountLabel(minutes: number, language: AppLanguage) {
  return `${minutes} ${language === 'en' ? 'min' : 'мин'}`;
}

function moonGardenLevel(minutes: number, language: AppLanguage) {
  if (minutes >= 150) return { level: 5, title: copy[language].levelInnerSanctuary, next: copy[language].levelInnerSanctuary, ceiling: 150, progress: 100 };
  if (minutes >= 60) return { level: 4, title: copy[language].levelMoonlitPath, next: copy[language].levelInnerSanctuary, ceiling: 150, progress: ((minutes - 60) / 90) * 100 };
  if (minutes >= 30) return { level: 3, title: copy[language].levelQuietGarden, next: copy[language].levelMoonlitPath, ceiling: 60, progress: ((minutes - 30) / 30) * 100 };
  if (minutes >= 10) return { level: 2, title: copy[language].levelGentleRhythm, next: copy[language].levelQuietGarden, ceiling: 30, progress: ((minutes - 10) / 20) * 100 };
  return { level: 1, title: copy[language].levelFirstLight, next: copy[language].levelGentleRhythm, ceiling: 10, progress: (minutes / 10) * 100 };
}

function availableMoonSeeds(profile: ProfileStats | null) {
  const value = Number(profile?.moonSeedsAvailable ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function plantedGardenElements(profile: ProfileStats | null) {
  if (!Array.isArray(profile?.plantedGardenElements)) return [];
  const knownIds = new Set(gardenElements.map((element) => element.id));
  const normalized = [...new Set(profile.plantedGardenElements.map((item) => item.replace(/-/g, '_')))];
  const upgradeIds = normalized.filter((item) => knownIds.has(item));
  if (upgradeIds.length > 0) return upgradeIds.slice(0, gardenElements.length);

  const legacyOrder = [
    'moon_flower',
    'calm_stone',
    'water_ripple',
    'golden_lantern',
    'night_lily',
    'crescent_tree',
    'star_path',
    'breathing_pond'
  ];
  const legacyCount = legacyOrder.filter((item) => normalized.includes(item)).length;
  return gardenElements.slice(0, legacyCount).map((element) => element.id);
}

function getCurrentGardenStage(plantedCount: number) {
  const normalizedCount = Math.max(0, Math.min(gardenElements.length, plantedCount));
  return [...gardenStages]
    .reverse()
    .find((stage) => normalizedCount >= stage.minPlantedUpgrades) ?? gardenStages[0];
}

function nextGardenElement(profile: ProfileStats | null) {
  const planted = new Set(plantedGardenElements(profile));
  return gardenElements.find((element) => !planted.has(element.id)) ?? null;
}

function readyGardenElement(profile: ProfileStats | null) {
  const seeds = availableMoonSeeds(profile);
  const planted = new Set(plantedGardenElements(profile));
  return gardenElements.find((element) => !planted.has(element.id) && element.cost <= seeds) ?? null;
}

function GardenUpgradeIcon({ visual, active }: { visual: GardenVisual; active: boolean }) {
  const line = active ? 'bg-gold' : 'bg-lavender/45';
  const border = active ? 'border-gold/70' : 'border-white/15';
  const glow = active ? 'shadow-gold' : '';
  if (visual === 'lantern') {
    return (
      <span className={`relative grid h-11 w-11 place-items-center rounded-[16px] border ${border} ${glow}`}>
        <span className={`absolute top-2 h-2 w-5 rounded-t-full ${line}`} />
        <span className={`h-6 w-4 rounded-b-lg rounded-t-sm border ${active ? 'border-gold bg-gold/20' : 'border-lavender/40 bg-lavender/10'}`} />
        <span className={`absolute bottom-2 h-2 w-2 rounded-full ${active ? 'bg-gold' : 'bg-lavender/40'}`} />
      </span>
    );
  }
  if (visual === 'path') {
    return (
      <span className={`flex h-11 w-11 items-end justify-center gap-1 rounded-[16px] border ${border} ${glow}`}>
        {[0, 1, 2, 3].map((item) => <span key={item} style={{ marginBottom: item % 2 === 0 ? 12 : 8 }} className={`h-1.5 w-1.5 rounded-full ${line}`} />)}
      </span>
    );
  }
  if (visual === 'bridge') {
    return (
      <span className={`relative h-11 w-11 rounded-[16px] border ${border} ${glow}`}>
        <span className={`absolute left-2 right-2 top-5 h-4 rounded-t-full border-t-2 ${active ? 'border-gold' : 'border-lavender/45'}`} />
        <span className={`absolute bottom-3 left-2 right-2 h-0.5 ${line}`} />
      </span>
    );
  }
  if (visual === 'reflection') {
    return (
      <span className={`relative h-11 w-11 rounded-[16px] border ${border} ${glow}`}>
        <span className={`absolute left-2 right-2 top-4 h-4 rounded-[50%] border ${active ? 'border-gold/70' : 'border-lavender/40'}`} />
        <span className={`absolute bottom-3 left-3 right-3 h-0.5 ${line}`} />
      </span>
    );
  }
  if (visual === 'garden') {
    return (
      <span className={`relative h-11 w-11 rounded-[16px] border ${border} ${glow}`}>
        <span className={`absolute left-1/2 top-2 h-6 w-6 -translate-x-1/2 rounded-full border ${active ? 'border-gold bg-gold/15' : 'border-lavender/40 bg-lavender/10'}`} />
        <span className={`absolute bottom-3 left-3 h-1.5 w-5 rounded-full ${line}`} />
      </span>
    );
  }
  return (
    <span className={`relative h-11 w-11 rounded-[16px] border ${border} ${glow}`}>
      <span className={`absolute bottom-2 left-1/2 h-5 w-0.5 -translate-x-1/2 ${line}`} />
      <span className={`absolute left-1/2 top-2 h-4 w-4 -translate-x-1/2 rounded-full ${active ? 'bg-gold/80' : 'bg-lavender/45'}`} />
      {visual === 'twinBloom' && <span className={`absolute right-2 top-4 h-3 w-3 rounded-full ${active ? 'bg-gold/70' : 'bg-lavender/35'}`} />}
    </span>
  );
}

function profileWeeklyInsight(profile: ProfileStats | null, language: AppLanguage) {
  const minutes = profile?.weeklyPracticeMinutes ?? 0;
  if (minutes <= 0) return copy[language].weeklyInsightZero;
  if (minutes <= 10) return copy[language].weeklyInsightSmall;
  return text(language, 'weeklyInsightStrong', { minutes });
}

function normalizeSlug(value?: string | null) {
  return (value ?? '').trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
}

function translateCategory(category: string | null | undefined, language: AppLanguage) {
  const keyBySlug: Record<string, keyof typeof copy.en> = {
    sleep: 'categorySleep',
    calm: 'categoryCalm',
    focus: 'categoryFocus',
    anxiety: 'categoryAnxiety',
    breath: 'categoryBreath',
    breathing: 'categoryBreathing',
    energy: 'categoryEnergy',
    stress: 'categoryStress',
    stressed: 'categoryStress',
    morning: 'categoryMorning',
    evening: 'categoryEvening',
    'quick-reset': 'categoryQuickReset',
    'deep-relaxation': 'categoryDeepRelaxation',
    premium: 'premium'
  };
  const key = keyBySlug[normalizeSlug(category)];
  return key ? copy[language][key] : (category ?? '');
}

function translateMoodLabel(label: string | null | undefined, language: AppLanguage) {
  const keyBySlug: Record<string, keyof typeof copy.en> = {
    sleep: 'moodSleep',
    calm: 'moodCalm',
    focused: 'moodFocused',
    focus: 'moodFocused',
    anxious: 'moodAnxious',
    anxiety: 'moodAnxious',
    stressed: 'moodStressed',
    stress: 'moodStressed',
    tired: 'moodTired',
    energy: 'moodEnergy',
    'low-energy': 'moodLowEnergy',
    'not-enough-data-yet': 'notEnoughData'
  };
  const key = keyBySlug[normalizeSlug(label)];
  return key ? copy[language][key] : (label ?? '');
}

function translateFocus(focus: string | null | undefined, language: AppLanguage) {
  const keyByFocus: Record<string, keyof typeof copy.en> = {
    'breath and anxiety relief': 'focusBreathAnxiety',
    'sleep recovery': 'focusSleepRecovery',
    'keep the streak gentle': 'focusKeepStreak',
    'a short calm reset': 'focusShortReset'
  };
  const key = keyByFocus[(focus ?? '').trim().toLowerCase()];
  return key ? copy[language][key] : (focus ?? '');
}

function localizeWeeklyInsight(wellness: WellnessSummary, language: AppLanguage) {
  if (language === 'en') return wellness.weeklyInsight;
  const minutesMatch = wellness.weeklyInsight.match(/You created (\d+) minutes/);
  if (minutesMatch) return text(language, 'weeklyInsightMinutes', { minutes: minutesMatch[1] });
  if (wellness.weeklyCheckinCount > 0) return copy[language].weeklyInsightStart;
  return copy[language].weeklyInsightShort;
}

function planLabel(plan: string, language: AppLanguage) {
  if (plan.toLowerCase() === 'free') return copy[language].free;
  if (plan.toLowerCase() === 'monthly') return language === 'ru' ? copy[language].monthlyPremium : plan;
  if (plan.toLowerCase() === 'lifetime') return language === 'ru' ? copy[language].lifetimePremium : plan;
  return plan;
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

function moodMessage(mood: MoodChip, wellness: WellnessSummary | null, language: AppLanguage) {
  if (wellness?.todayCheckin) return text(language, 'recommendedFocus', { focus: translateFocus(wellness.recommendedFocus, language) });
  if (language === 'ru') {
    if (mood === 'Sleep') return 'Пусть вечер будет мягким, а нервная система постепенно замедлится.';
    if (mood === 'Anxiety') return 'Практика с дыханием поможет создать пространство между мыслями.';
    if (mood === 'Focus') return 'Короткая практика фокуса сделает следующий час яснее.';
    if (mood === 'Energy') return 'Начнем бодро, а потом вернемся в устойчивое спокойствие.';
    if (mood === 'Breath') return 'Дыхание — самый быстрый путь вернуться в тело.';
    return 'Красиво. Luna поможет сохранить день мягким и устойчивым.';
  }
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

function meditationText(meditation: Meditation) {
  return [
    meditation.title,
    meditation.subtitle,
    meditation.description,
    meditation.category,
    meditation.mood,
    meditation.translations?.en?.title,
    meditation.translations?.en?.subtitle,
    meditation.translations?.ru?.title,
    meditation.translations?.ru?.subtitle
  ].filter(Boolean).join(' ').toLowerCase();
}

function isDemoMeditation(meditation: Meditation) {
  const title = meditation.title?.trim().toLowerCase() ?? '';
  const combined = meditationText(meditation);
  return (
    title === 'meditation free' ||
    title === 'test' ||
    title.startsWith('test ') ||
    combined.includes('placeholder') ||
    combined.includes('demo meditation') ||
    combined.includes('test meditation')
  );
}

function sortMeditationsStable(meditations: Meditation[]) {
  return [...meditations].sort((left, right) => {
    const leftTime = new Date(left.created_at ?? 0).getTime();
    const rightTime = new Date(right.created_at ?? 0).getTime();
    if (rightTime !== leftTime) return rightTime - leftTime;
    return left.id.localeCompare(right.id);
  });
}

function findMeditation(meditations: Meditation[], matcher: (meditation: Meditation) => boolean) {
  return meditations.find(matcher);
}

function hasTitle(meditation: Meditation, title: string) {
  return meditationText(meditation).includes(title.toLowerCase());
}

function categoryMatches(meditation: Meditation, categories: string[]) {
  const category = normalizeSlug(meditation.category);
  return categories.some((item) => category.includes(normalizeSlug(item)));
}

function recommendedMeditationForMood(mood: MoodChip, meditations: Meditation[]) {
  if (mood === 'Sleep') {
    return findMeditation(meditations, (item) => hasTitle(item, 'Deep Sleep')) ??
      findMeditation(meditations, (item) => categoryMatches(item, ['sleep']));
  }

  if (mood === 'Anxiety') {
    return findMeditation(meditations, (item) => hasTitle(item, 'Anxiety Relief')) ??
      findMeditation(meditations, (item) => categoryMatches(item, ['anxiety']));
  }

  if (mood === 'Focus' || mood === 'Energy') {
    return findMeditation(meditations, (item) => hasTitle(item, 'Morning Clarity')) ??
      findMeditation(meditations, (item) => categoryMatches(item, ['focus', 'morning']));
  }

  if (mood === 'Breath') {
    return findMeditation(meditations, (item) => categoryMatches(item, ['breath', 'breathing'])) ??
      findMeditation(meditations, (item) => hasTitle(item, 'Anxiety Relief'));
  }

  return findMeditation(meditations, (item) => hasTitle(item, 'Anxiety Relief')) ??
    findMeditation(meditations, (item) => item.mood === 'Calm' || categoryMatches(item, ['calm']));
}

function defaultDailyMeditation(meditations: Meditation[]) {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return findMeditation(meditations, (item) => hasTitle(item, 'Morning Clarity')) ??
      findMeditation(meditations, (item) => categoryMatches(item, ['morning', 'focus']));
  }
  if (hour >= 12 && hour < 18) {
    return findMeditation(meditations, (item) => hasTitle(item, 'Anxiety Relief')) ??
      findMeditation(meditations, (item) => item.mood === 'Calm' || categoryMatches(item, ['calm', 'anxiety']));
  }
  return findMeditation(meditations, (item) => hasTitle(item, 'Deep Sleep')) ??
    findMeditation(meditations, (item) => categoryMatches(item, ['sleep']));
}

function uniqueById(meditations: Meditation[]) {
  const seen = new Set<string>();
  return meditations.filter((meditation) => {
    if (seen.has(meditation.id)) return false;
    seen.add(meditation.id);
    return true;
  });
}

function isInProgress(meditation: Meditation) {
  const history = meditation.history;
  if (!history) return false;
  const completion = Number(history.completion_percent ?? 0);
  const position = Number(history.last_position ?? 0);
  const duration = Math.max(1, meditation.duration || 1);
  return position > 0 && completion < 95 && position < duration * 0.95 && !history.completed;
}

function getLocalizedMeditation(meditation: Meditation, language: AppLanguage) {
  const english = meditation.translations?.en ?? {};
  const selected = meditation.translations?.[language] ?? {};
  const englishTitle = english.title?.trim() || meditation.title?.trim();
  const englishSubtitle = english.subtitle?.trim() || meditation.subtitle?.trim();
  const englishDescription = english.description?.trim() || meditation.description?.trim();
  const englishAudio = english.audioUrl?.trim() || meditation.audio_file?.trim();
  const title = selected.title?.trim() || englishTitle || displayMeditationTitle(meditation);
  const subtitle = selected.subtitle?.trim() || englishSubtitle || translateCategory(meditation.category, language);
  const description = selected.description?.trim() || englishDescription || '';
  const selectedAudio = selected.audioUrl?.trim();
  const audioUrl = selectedAudio || englishAudio || '';

  return {
    title,
    subtitle,
    description,
    audioUrl,
    fallbackLanguageUsed: language !== 'en' && (!selected.title?.trim() || !selected.description?.trim()),
    hasSelectedLanguageAudio: language === 'en' || Boolean(selectedAudio)
  };
}

function meditationShareSubtitle(meditation: Meditation, language: AppLanguage) {
  return getLocalizedMeditation(meditation, language).subtitle;
}

function botUsername() {
  return import.meta.env.VITE_BOT_USERNAME?.trim().replace(/^@/, '') ?? '';
}

function meditationShareUrl(meditationId: string) {
  const username = botUsername();
  if (!username) return window.location.origin;
  return `https://t.me/${username}?startapp=meditation_${encodeURIComponent(meditationId)}`;
}

function miniAppStartParam() {
  const search = new URLSearchParams(window.location.search);
  return (
    window.Telegram?.WebApp?.initDataUnsafe?.start_param ||
    search.get('tgWebAppStartParam') ||
    search.get('startapp') ||
    ''
  );
}

function meditationIdFromStartParam(startParam: string) {
  if (!startParam.startsWith('meditation_')) return null;
  const id = startParam.slice('meditation_'.length);
  if (!id) return null;

  try {
    return decodeURIComponent(id);
  } catch {
    return null;
  }
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}

function durationLabel(value: DailyCheckin['available_minutes'] | null | undefined, language: AppLanguage) {
  if (!value) return copy[language].notSet;
  if (value === '15_plus') return copy[language].minutes15Plus;
  if (value === '10') return copy[language].minutes10;
  if (value === '5') return copy[language].minutes5;
  return copy[language].minutes3;
}

function MoonMark({ className = '' }: { className?: string }) {
  return <span className={`luna-moon-mark ${className}`} aria-hidden="true" />;
}

function App() {
  const telegram = getTelegram();
  const user = telegram?.initDataUnsafe.user ?? fallbackUser;
  const initData = telegram?.initData;
  const sceneAudioRef = useRef<HTMLAudioElement | null>(null);
  const moonGardenAudioRef = useRef<HTMLAudioElement | null>(null);
  const sceneListenSecondsRef = useRef(0);
  const sceneMoonSeedAwardedRef = useRef(false);
  const [initialLibraryCache] = useState(() => readLibraryCache());
  const [language, setLanguage] = useState<AppLanguage>(() => initialLanguage(user));
  const [page, setPage] = useState<Page>(window.location.pathname === '/admin' || window.location.hash === '#admin' ? 'admin' : 'home');
  const [libraryMode, setLibraryMode] = useState<LibraryMode>('meditations');
  const [mood, setMood] = useState<MoodChip>('Calm');
  const [moodSelectedByUser, setMoodSelectedByUser] = useState(false);
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
  const [selectedScene, setSelectedScene] = useState<SceneDefinition | null>(null);
  const [scenePlaying, setScenePlaying] = useState(false);
  const [sceneVolume, setSceneVolume] = useState(0.35);
  const [sceneAudioUrl, setSceneAudioUrl] = useState('');
  const [moonGardenAmbiencePlaying, setMoonGardenAmbiencePlaying] = useState(false);
  const [moonGardenVolume, setMoonGardenVolume] = useState(readMoonGardenVolume);
  const [moonGardenAmbienceError, setMoonGardenAmbienceError] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [openingPlan, setOpeningPlan] = useState<'monthly' | 'lifetime' | null>(null);
  const [adminStatus, setAdminStatus] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [adminMeditations, setAdminMeditations] = useState<Meditation[]>([]);
  const [adminDashboard, setAdminDashboard] = useState<AdminDashboardData | null>(null);
  const [wellness, setWellness] = useState<WellnessSummary | null>(null);
  const [showCheckin, setShowCheckin] = useState(false);
  const [pendingMeditationId, setPendingMeditationId] = useState(() => meditationIdFromStartParam(miniAppStartParam()));
  const [openedStartMeditationId, setOpenedStartMeditationId] = useState<string | null>(null);

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
    const savedLanguage = profileStats?.user?.language_code ?? accessState.user?.language_code;
    if (savedLanguage === 'en' || savedLanguage === 'ru') {
      setLanguage(savedLanguage);
      saveStoredLanguage(savedLanguage);
    }
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
    return meditations.filter((meditation) => !isDemoMeditation(meditation)).map((meditation) => ({
      ...meditation,
      favorite: favoriteIds.has(meditation.id) || meditation.favorite,
      history: historyByMeditation.get(meditation.id) ?? meditation.history ?? null
    }));
  }, [favoriteIds, historyByMeditation, meditations]);

  const filteredMeditations = useMemo(() => {
    return decoratedMeditations.filter((meditation) => {
      const localized = getLocalizedMeditation(meditation, language);
      const matchesQuery = [localized.title, localized.subtitle, localized.description].some((value) =>
        value.toLowerCase().includes(query.toLowerCase())
      );
      const matchesCategory = category === 'all' || (category === 'short' ? meditation.duration <= 600 : meditation.category === category);
      return matchesQuery && matchesCategory;
    });
  }, [category, decoratedMeditations, language, query]);

  const stableMeditations = useMemo(() => sortMeditationsStable(decoratedMeditations), [decoratedMeditations]);

  const heroMood = useMemo(() => {
    if (moodSelectedByUser) return mood;
    if (wellness?.todayCheckin) return checkinMoodToMoodChip(wellness.todayCheckin.mood);
    return null;
  }, [mood, moodSelectedByUser, wellness]);

  const dailyMeditation = useMemo(() => {
    return (heroMood ? recommendedMeditationForMood(heroMood, stableMeditations) : defaultDailyMeditation(stableMeditations)) ??
      stableMeditations[0];
  }, [heroMood, stableMeditations]);

  const heroLabelKey: keyof typeof copy.en = moodSelectedByUser ? 'forYourMood' : wellness?.todayCheckin ? 'recommendedForYou' : 'todayMeditation';

  const homeSections = useMemo(() => {
    const displayedIds = new Set<string>();
    if (dailyMeditation) displayedIds.add(dailyMeditation.id);

    const inProgress = uniqueById(stableMeditations)
      .filter(isInProgress)
      .sort((a, b) => new Date(b.history?.last_played ?? 0).getTime() - new Date(a.history?.last_played ?? 0).getTime())
      .slice(0, 3);

    const continueListening = inProgress.filter((meditation) => {
      if (displayedIds.has(meditation.id)) return false;
      displayedIds.add(meditation.id);
      return true;
    });

    const recentCandidates = uniqueById(stableMeditations)
      .filter((meditation) => meditation.history?.last_played)
      .sort((a, b) => new Date(b.history?.last_played ?? 0).getTime() - new Date(a.history?.last_played ?? 0).getTime())
      .filter((meditation) => !displayedIds.has(meditation.id));

    const recentlyPlayed = recentCandidates.length >= 2 ? recentCandidates.slice(0, 4).filter((meditation) => {
      displayedIds.add(meditation.id);
      return true;
    }) : [];

    const explore = uniqueById([
      ...stableMeditations.filter((meditation) => meditation.premium),
      ...stableMeditations
    ])
      .filter((meditation) => !displayedIds.has(meditation.id))
      .slice(0, 6);

    return {
      continueListening,
      recentlyPlayed,
      explore
    };
  }, [dailyMeditation, stableMeditations]);

  const changeLanguage = (nextLanguage: AppLanguage) => {
    setLanguage(nextLanguage);
    saveStoredLanguage(nextLanguage);
    telegram?.HapticFeedback?.impactOccurred('light');
    if (initData) {
      updateUserLanguage(nextLanguage, initData).catch((error) => {
        console.info('[Luna language save failed]', error instanceof Error ? error.message : 'Language save failed.');
      });
    }
  };

  useEffect(() => {
    if (!wellness || wellness.todayCheckin) return;
    const dismissed = window.localStorage.getItem(`luna.checkin.dismissed.${todayLocalDate()}`);
    if (!dismissed) setShowCheckin(true);
  }, [wellness]);

  useEffect(() => {
    preloadCoverImages([dailyMeditation, ...homeSections.continueListening, ...homeSections.recentlyPlayed, ...homeSections.explore].filter(Boolean) as Meditation[]);
  }, [dailyMeditation, homeSections]);

  const openMeditation = (meditation: Meditation) => {
    const locked = meditation.premium && !access.hasPremium;
    telegram?.HapticFeedback?.impactOccurred('light');
    if (locked) {
      setSelectedMeditation(meditation);
      setPage('pricing');
      return;
    }
    sceneAudioRef.current?.pause();
    setScenePlaying(false);
    moonGardenAudioRef.current?.pause();
    setMoonGardenAmbiencePlaying(false);
    setSelectedMeditation(meditation);
    setPage('player');
  };

  const openScene = (scene: SceneDefinition) => {
    telegram?.HapticFeedback?.impactOccurred('light');
    if (scene.access === 'premium' && !access.hasPremium) {
      setPaymentMessage(copy[language].scenePremiumLocked);
      setSelectedMeditation(null);
      setPage('pricing');
      return;
    }

    const shouldContinuePlaying = Boolean(selectedScene && selectedScene.id !== scene.id && scenePlaying);
    if (selectedScene?.id !== scene.id) {
      const nextUrl = createSceneAudioUrl(scene.sound);
      const audio = sceneAudioRef.current;
      sceneListenSecondsRef.current = 0;
      sceneMoonSeedAwardedRef.current = false;
      audio?.pause();
      setScenePlaying(false);
      setSceneAudioUrl(nextUrl);
      if (audio) {
        audio.src = nextUrl;
        audio.loop = true;
        audio.volume = sceneVolume;
      }
      if (shouldContinuePlaying && audio) {
        void audio.play().then(() => setScenePlaying(true)).catch(() => setScenePlaying(false));
      }
    }
    setSelectedScene(scene);
    setPage('scenePlayer');
  };

  const toggleScenePlayback = async () => {
    const audio = sceneAudioRef.current;
    if (!audio || !selectedScene) return;

    if (!sceneAudioUrl) {
      const nextUrl = createSceneAudioUrl(selectedScene.sound);
      setSceneAudioUrl(nextUrl);
      audio.src = nextUrl;
    }

    audio.loop = true;
    audio.volume = sceneVolume;

    if (audio.paused) {
      await audio.play();
      setScenePlaying(true);
      return;
    }

    audio.pause();
    setScenePlaying(false);
  };

  const closeScenePlayer = () => {
    sceneAudioRef.current?.pause();
    setScenePlaying(false);
    setPage('library');
  };

  const toggleMoonGardenAmbience = async () => {
    const audio = moonGardenAudioRef.current;
    if (!audio) return;

    if (!audio.src || !audio.src.endsWith(moonGardenAmbienceUrl)) {
      audio.src = moonGardenAmbienceUrl;
    }
    audio.loop = true;
    audio.volume = moonGardenVolume;

    if (audio.paused) {
      sceneAudioRef.current?.pause();
      setScenePlaying(false);
      setMoonGardenAmbienceError(false);
      try {
        await audio.play();
        setMoonGardenAmbiencePlaying(true);
      } catch (error) {
        console.info('[Luna Moon Garden ambience failed]', error instanceof Error ? error.message : 'Ambience playback failed.');
        setMoonGardenAmbienceError(true);
        setMoonGardenAmbiencePlaying(false);
      }
      return;
    }

    audio.pause();
    setMoonGardenAmbiencePlaying(false);
  };

  const pauseMoonGardenAmbience = () => {
    moonGardenAudioRef.current?.pause();
    setMoonGardenAmbiencePlaying(false);
  };

  const changeMoonGardenVolume = (nextVolume: number) => {
    const volume = Math.max(0, Math.min(1, nextVolume));
    setMoonGardenVolume(volume);
    try {
      window.localStorage.setItem(moonGardenVolumeStorageKey, String(volume));
    } catch {
      // Moon Garden ambience volume is best-effort local preference.
    }
    if (moonGardenAudioRef.current) moonGardenAudioRef.current.volume = volume;
  };

  const runMoonGardenDevAction = async (input: { action: MoonGardenDevAction; seedBalance?: number; amount?: number; stageLevel?: number }) => {
    const result = await updateMoonGardenDevState(input, initData);
    setProfile(result.profile);
    return result.profile;
  };

  const openBreathCircle = () => {
    telegram?.HapticFeedback?.impactOccurred('light');
    setPage('breathCircle');
  };

  const completeBreathCircle = async (mode: BreathMode, durationSeconds: number, breathCount: number) => {
    try {
      await saveBreathSession({ mode, duration_seconds: durationSeconds, breath_count: breathCount }, initData);
      await refreshAccount();
    } catch (error) {
      console.info('[Luna breath session save failed]', error instanceof Error ? error.message : 'Breath session save failed.');
      throw error;
    }
  };

  useEffect(() => {
    if (!pendingMeditationId || openedStartMeditationId === pendingMeditationId || !decoratedMeditations.length) return;

    const meditation = decoratedMeditations.find((item) => item.id === pendingMeditationId);
    if (!meditation) {
      if (!libraryLoading) setPendingMeditationId(null);
      return;
    }

    setOpenedStartMeditationId(pendingMeditationId);
    setPendingMeditationId(null);
    openMeditation(meditation);
  }, [decoratedMeditations, libraryLoading, openedStartMeditationId, pendingMeditationId]);

  const toggleFavorite = async (meditation: Meditation) => {
    const next = !favoriteIds.has(meditation.id);
    await setFavorite(meditation.id, next, initData);
    await refreshAccount();
  };

  const withCheckinAuthFallback = (input: DailyCheckinPayload): DailyCheckinPayload => {
    if (initData) return input;

    return {
      ...input,
      telegram_id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      language_code: user.language_code
    };
  };

  const selectMood = async (nextMood: MoodChip) => {
    setMood(nextMood);
    setMoodSelectedByUser(true);
    telegram?.HapticFeedback?.impactOccurred('light');

    if (!wellness?.todayCheckin) {
      setShowCheckin(true);
      return;
    }

    try {
      const checkin = await saveDailyCheckin(withCheckinAuthFallback({
        sleep_range: wellness.todayCheckin.sleep_range,
        available_minutes: wellness.todayCheckin.available_minutes,
        mood: moodChipToCheckinMood(nextMood),
        local_date: wellness.todayCheckin.local_date
      }), initData);
      const nextSummary = await getWellnessSummary(initData);
      setWellness({ ...nextSummary, todayCheckin: checkin });
    } catch (error) {
      console.info('[Luna check-in mood update failed]', error instanceof Error ? error.message : 'Check-in update failed.');
    }
  };

  const saveCheckin = async (input: DailyCheckinPayload) => {
    const checkin = await saveDailyCheckin(withCheckinAuthFallback(input), initData);
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
    setPaymentMessage(copy[language].openingPayment);
    telegram?.HapticFeedback?.impactOccurred('light');
    try {
      const { invoiceLink } = await createInvoiceLink(plan, initData);
      setPaymentMessage(copy[language].openingStarsPayment);

      if (telegram?.openInvoice) {
        telegram.openInvoice(invoiceLink, (status) => {
          setOpeningPlan(null);
          if (status === 'paid') {
            setPaymentMessage(copy[language].paymentSuccessful);
            void refreshAccount();
            return;
          }
          setPaymentMessage(status === 'cancelled' ? copy[language].paymentCancelled : copy[language].paymentPending);
        });
      } else {
        telegram?.openTelegramLink(invoiceLink);
        setOpeningPlan(null);
        setPaymentMessage(copy[language].invoiceOpened);
      }
    } catch {
      setOpeningPlan(null);
      const botUsername = import.meta.env.VITE_BOT_USERNAME;
      setPaymentMessage(copy[language].paymentFailed);
      if (botUsername) telegram?.openTelegramLink(`https://t.me/${botUsername}?start=luna`);
    }
  };

  const nextMeditation = selectedMeditation
    ? decoratedMeditations[(decoratedMeditations.findIndex((item) => item.id === selectedMeditation.id) + 1) % decoratedMeditations.length]
    : undefined;

  useEffect(() => {
    const audio = sceneAudioRef.current;
    if (!audio) return;
    audio.volume = sceneVolume;
  }, [sceneVolume]);

  useEffect(() => {
    const audio = moonGardenAudioRef.current;
    if (!audio) return;
    audio.volume = moonGardenVolume;
  }, [moonGardenVolume]);

  useEffect(() => {
    const audio = sceneAudioRef.current;
    if (!audio || !sceneAudioUrl) return;
    if (audio.src !== sceneAudioUrl) audio.src = sceneAudioUrl;
    audio.loop = true;
    audio.volume = sceneVolume;
  }, [sceneAudioUrl, sceneVolume]);

  useEffect(() => {
    const audio = sceneAudioRef.current;
    if (!audio) return;
    const syncPause = () => setScenePlaying(false);
    const syncPlay = () => setScenePlaying(true);
    audio.addEventListener('pause', syncPause);
    audio.addEventListener('play', syncPlay);
    return () => {
      audio.removeEventListener('pause', syncPause);
      audio.removeEventListener('play', syncPlay);
    };
  }, []);

  useEffect(() => {
    const audio = moonGardenAudioRef.current;
    if (!audio) return;
    const syncPause = () => setMoonGardenAmbiencePlaying(false);
    const syncPlay = () => {
      setMoonGardenAmbienceError(false);
      setMoonGardenAmbiencePlaying(true);
    };
    const syncError = () => {
      console.info('[Luna Moon Garden ambience missing or failed to load]', moonGardenAmbienceUrl);
      setMoonGardenAmbienceError(true);
      setMoonGardenAmbiencePlaying(false);
    };
    audio.src = moonGardenAmbienceUrl;
    audio.loop = true;
    audio.volume = readMoonGardenVolume();
    audio.addEventListener('pause', syncPause);
    audio.addEventListener('play', syncPlay);
    audio.addEventListener('error', syncError);
    return () => {
      audio.removeEventListener('pause', syncPause);
      audio.removeEventListener('play', syncPlay);
      audio.removeEventListener('error', syncError);
    };
  }, []);

  useEffect(() => {
    if (!scenePlaying || !selectedScene || sceneMoonSeedAwardedRef.current) return;

    const timer = window.setInterval(() => {
      sceneListenSecondsRef.current += 1;
      if (sceneListenSecondsRef.current < 300 || sceneMoonSeedAwardedRef.current) return;

      sceneMoonSeedAwardedRef.current = true;
      recordSceneMoonSeed({ scene_id: selectedScene.id, duration_seconds: sceneListenSecondsRef.current }, initData)
        .then(() => refreshAccount())
        .catch((error) => {
          console.info('[Luna scene Moon Seed save failed]', error instanceof Error ? error.message : 'Scene Moon Seed save failed.');
        });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [initData, scenePlaying, selectedScene]);

  return (
    <main className="min-h-screen overflow-hidden bg-night text-cream">
      <div className="fixed inset-0 luna-bg" />
      <section className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-28 pt-4">
        <Header plan={access.plan} streak={profile?.currentStreak ?? 0} language={language} onLanguageChange={changeLanguage} />

        {page === 'home' && (
          <HomePage
            firstName={user.first_name ?? 'friend'}
            mood={mood}
            setMood={selectMood}
            wellness={wellness}
            daily={dailyMeditation}
            heroLabel={copy[language][heroLabelKey]}
            continueListening={homeSections.continueListening}
            recentlyPlayed={homeSections.recentlyPlayed}
            explore={homeSections.explore}
            loading={libraryLoading}
            onOpen={openMeditation}
            onLibrary={() => setPage('library')}
            onScenes={() => {
              setLibraryMode('scenes');
              setPage('library');
            }}
            onBreath={openBreathCircle}
            language={language}
          />
        )}

        {page === 'library' && (
          <LibraryPage
            categories={categories}
            query={query}
            setQuery={setQuery}
            category={category}
            setCategory={setCategory}
            mode={libraryMode}
            setMode={setLibraryMode}
            meditations={filteredMeditations}
            scenes={scenes}
            hasPremium={access.hasPremium}
            loading={libraryLoading}
            onOpen={openMeditation}
            onOpenScene={openScene}
            onFavorite={toggleFavorite}
            onUnlock={() => setPage('pricing')}
            language={language}
          />
        )}

        {page === 'favorites' && (
          <FavoritesPage meditations={decoratedMeditations.filter((item) => favoriteIds.has(item.id))} onOpen={openMeditation} onFavorite={toggleFavorite} language={language} />
        )}

        {page === 'pricing' && (
          <PricingPage onBuy={buyPlan} message={paymentMessage} openingPlan={openingPlan} onLibrary={() => setPage('library')} locked={selectedMeditation} language={language} />
        )}

        {page === 'profile' && (
          <ProfilePage
            profile={profile}
            access={access}
            firstName={user.first_name ?? 'Luna'}
            username={user.username}
            wellness={wellness}
            showAdminButton={adminStatus === 'allowed'}
            onMoonGarden={() => setPage('moonGarden')}
            onAdmin={() => {
              window.history.pushState({}, '', '/admin');
              setPage('admin');
            }}
            onRestore={refreshAccount}
            language={language}
          />
        )}

        {page === 'moonGarden' && (
          <MoonGardenPage
            profile={profile}
            onBack={() => setPage('profile')}
            onPlant={async (element) => {
              const result = await plantMoonGardenElement(element.id, initData);
              setProfile(result.profile);
              return result.profile;
            }}
            isAdmin={adminStatus === 'allowed'}
            ambiencePlaying={moonGardenAmbiencePlaying}
            ambienceVolume={moonGardenVolume}
            ambienceError={moonGardenAmbienceError}
            onToggleAmbience={toggleMoonGardenAmbience}
            onAmbienceVolume={changeMoonGardenVolume}
            onDevAction={runMoonGardenDevAction}
            language={language}
          />
        )}

        {page === 'player' && selectedMeditation && (
          <PlayerPage
            meditation={selectedMeditation}
            nextMeditation={nextMeditation}
            favorite={favoriteIds.has(selectedMeditation.id)}
            onFavorite={() => toggleFavorite(selectedMeditation)}
            onSave={(position, duration, completed) =>
              saveHistory({ meditation_id: selectedMeditation.id, last_position: position, duration, completed }, initData).then(async (result) => {
                await refreshAccount();
                return result;
              })
            }
            onHome={() => setPage('home')}
            onProgress={() => setPage('profile')}
            onPlaybackStart={pauseMoonGardenAmbience}
            onContinue={() => {
              if (nextMeditation && nextMeditation.id !== selectedMeditation.id) openMeditation(nextMeditation);
              else setPage('library');
            }}
            language={language}
          />
        )}

        {page === 'scenePlayer' && selectedScene && (
          <ScenePlayerPage
            scene={selectedScene}
            scenes={scenes}
            hasPremium={access.hasPremium}
            playing={scenePlaying}
            volume={sceneVolume}
            onVolume={setSceneVolume}
            onToggle={() => void toggleScenePlayback()}
            onScene={openScene}
            onClose={closeScenePlayer}
            language={language}
          />
        )}

        {page === 'breathCircle' && (
          <BreathCirclePage
            hasPremium={access.hasPremium}
            onComplete={completeBreathCircle}
            onClose={() => setPage('home')}
            onPremium={() => setPage('pricing')}
            language={language}
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

        <audio ref={sceneAudioRef} loop preload="none" />
        <audio ref={moonGardenAudioRef} src={moonGardenAmbienceUrl} loop preload="none" />
        {selectedScene && page !== 'scenePlayer' && page !== 'admin' && (
          <SceneMiniPlayer
            scene={selectedScene}
            playing={scenePlaying}
            volume={sceneVolume}
            onToggle={() => void toggleScenePlayback()}
            onOpen={() => setPage('scenePlayer')}
            onVolume={setSceneVolume}
            language={language}
          />
        )}
        {page !== 'admin' && <Nav active={page} onChange={setPage} language={language} />}
        {showCheckin && page !== 'admin' && (
          <DailyCheckinSheet onClose={dismissCheckin} onSave={saveCheckin} initialMood={moodChipToCheckinMood(mood)} language={language} />
        )}
      </section>
    </main>
  );
}

function Header({
  plan,
  streak,
  language,
  onLanguageChange
}: {
  plan: string;
  streak: number;
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <MoonMark className="h-10 w-10 shrink-0" />
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-gold">LUNA</p>
          <h1 className="font-serif text-2xl tracking-[0.16em] text-cream">MEDITATION</h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-beige">{copy[language].tagline}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="rounded-full border border-white/10 bg-ink px-3 py-1.5 text-[11px] text-cream shadow-glow">
          {streak > 0 ? streakLabel(streak, language) : planLabel(plan, language)}
        </div>
        <div className="flex rounded-full border border-white/10 bg-ink p-1 text-[10px] font-semibold shadow-glow" aria-label={copy[language].language}>
          {(['en', 'ru'] as const).map((item) => (
            <button
              key={item}
              onClick={() => onLanguageChange(item)}
              className={`rounded-full px-2 py-1 transition ${language === item ? 'bg-gold text-night' : 'text-lavender'}`}
            >
              {item.toUpperCase()}
            </button>
          ))}
        </div>
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
  heroLabel: string;
  continueListening: Meditation[];
  recentlyPlayed: Meditation[];
  explore: Meditation[];
  loading: boolean;
  onOpen: (meditation: Meditation) => void;
  onLibrary: () => void;
  onScenes: () => void;
  onBreath: () => void;
  language: AppLanguage;
}) {
  const t = copy[props.language];
  return (
    <div className="space-y-4">
      <section className="luna-fade overflow-hidden rounded-[24px] border border-white/10 bg-ink p-4 shadow-glow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-beige">{dayGreeting(props.language)},</p>
            <h2 className="mt-0.5 font-serif text-3xl font-semibold leading-tight text-cream">{props.firstName}</h2>
          </div>
          <MoonMark className="h-14 w-14 shrink-0" />
        </div>
        <p className="mt-3 text-sm text-beige">{t.feeling}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {moods.map((item) => (
            <button
              key={item}
              onClick={() => props.setMood(item)}
              className={`rounded-full px-3.5 py-1.5 text-sm transition ${
                props.mood === item ? 'bg-gold text-night' : 'bg-surface text-cream'
              }`}
            >
              {translateCategory(item, props.language)}
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-2xl border border-gold/20 bg-gold/10 px-3 py-2">
          <p className="line-clamp-1 text-xs font-medium text-cream/85">{props.wellness?.todayCheckin ? t.checkinSaved : moodMessage(props.mood, props.wellness, props.language)}</p>
          {props.wellness?.weeklyCheckinCount ? (
            <p className="mt-1 text-[11px] capitalize text-gold">
              {translateMoodLabel(props.wellness.mostCommonMoodLabel, props.language)} · {props.wellness.weeklyCheckinCount}/7 {t.checkins}
            </p>
          ) : null}
        </div>
      </section>

      {props.daily ? (
        <PracticeHero label={props.heroLabel} meditation={props.daily} onOpen={() => props.onOpen(props.daily!)} language={props.language} />
      ) : props.loading ? (
        <PracticeHeroSkeleton />
      ) : (
        <EmptyState title={t.firstPracticeTitle} body={t.firstPracticeBody} />
      )}

      <Rail title={t.continueListening} meditations={props.continueListening} onOpen={props.onOpen} language={props.language} />
      <Rail title={t.recentlyPlayed} meditations={props.recentlyPlayed} onOpen={props.onOpen} language={props.language} />
      <button onClick={props.onScenes} className="relative w-full overflow-hidden rounded-[24px] border border-gold/20 bg-gradient-to-br from-lavender/25 via-gold/10 to-white/5 p-4 text-left shadow-glow">
        <div className="absolute right-4 top-4 grid h-12 w-12 place-items-center rounded-full bg-gold/15 text-gold">
          <Waves size={24} />
        </div>
        <p className="text-xs uppercase tracking-[0.18em] text-gold">{t.scenesHomeTitle}</p>
        <h3 className="mt-1 font-serif text-2xl">{t.scenesTitle}</h3>
        <p className="mt-2 max-w-[250px] text-sm leading-5 text-cream/75">{t.scenesHomeBody}</p>
      </button>
      <button onClick={props.onBreath} className="relative w-full overflow-hidden rounded-[24px] border border-white/10 bg-ink p-4 text-left shadow-glow">
        <div className="absolute right-4 top-4 grid h-12 w-12 place-items-center rounded-full border border-gold/30 bg-gold/10 text-gold">
          <Sparkles size={22} />
        </div>
        <p className="text-xs uppercase tracking-[0.18em] text-gold">{t.categoryBreath}</p>
        <h3 className="mt-1 font-serif text-2xl">{t.breathCircle}</h3>
        <p className="mt-2 max-w-[250px] text-sm leading-5 text-cream/75">{t.breathCircleSubtitle}</p>
      </button>
      {props.explore.length >= 3 ? (
        <Rail title={t.moreToExplore} meditations={props.explore} onOpen={props.onOpen} language={props.language} />
      ) : props.explore.length > 0 ? (
        <section className="rounded-[24px] border border-gold/20 bg-gold/10 p-4 shadow-glow">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-gold">{t.moreToExplore}</p>
              <h2 className="mt-1 font-serif text-2xl">{t.exploreLibrary}</h2>
            </div>
            <button onClick={props.onLibrary} className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-night">
              {t.openLibrary}
            </button>
          </div>
        </section>
      ) : null}
      {props.wellness && <InsightCard title={t.weeklyTitle} body={localizeWeeklyInsight(props.wellness, props.language)} meta={text(props.language, 'recommendedFocus', { focus: translateFocus(props.wellness.recommendedFocus, props.language) })} />}
      {props.loading && !props.daily && <RailSkeleton title={t.preparingCalm} />}

      <button onClick={props.onLibrary} className="w-full rounded-[20px] bg-gold px-5 py-4 font-semibold text-night shadow-glow hover:brightness-110">
        {t.openLibrary}
      </button>
    </div>
  );
}

function PracticeHero({ meditation, label, onOpen, language }: { meditation: Meditation; label: string; onOpen: () => void; language: AppLanguage }) {
  const localized = getLocalizedMeditation(meditation, language);
  const cta = isInProgress(meditation) ? copy[language].resume : copy[language].begin;
  return (
    <button onClick={onOpen} className="group relative h-[260px] w-full overflow-hidden rounded-[26px] border border-white/10 text-left shadow-glow transition duration-300 ease-in-out hover:brightness-110">
      <img src={meditation.cover_image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70 transition group-hover:scale-105" loading="eager" />
      <div className="absolute inset-0 bg-gradient-to-t from-night via-night/40 to-transparent" />
      <span className="absolute right-4 top-4 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-night">
        {meditation.premium ? copy[language].premium : copy[language].free}
      </span>
      <div className="absolute bottom-0 p-4">
        <p className="mb-2 inline-flex rounded-full bg-lavender/25 px-3 py-1 text-xs text-cream backdrop-blur">{label}</p>
        <h3 className="font-serif text-2xl font-semibold">{localized.title}</h3>
        <p className="mt-1 text-sm capitalize text-cream/75">
          {translateCategory(meditation.category, language)} · {formatTime(meditation.duration)}
        </p>
        {!localized.hasSelectedLanguageAudio && <p className="mt-2 text-xs text-gold">{copy[language].availableInEnglish}</p>}
        <span className="mt-3 inline-flex rounded-[18px] bg-gold px-5 py-2.5 text-sm font-semibold text-night shadow-gold">
          {cta}
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

function Rail({ title, meditations, onOpen, language }: { title: string; meditations: Meditation[]; onOpen: (meditation: Meditation) => void; language: AppLanguage }) {
  if (!meditations.length) return null;

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {meditations.map((meditation) => (
          <button key={meditation.id} onClick={() => onOpen(meditation)} className="w-40 shrink-0 text-left">
            <img src={meditation.cover_image} alt="" className="h-40 w-40 rounded-3xl object-cover shadow-glow" loading="lazy" />
            <p className="mt-2 line-clamp-1 font-semibold">{getLocalizedMeditation(meditation, language).title}</p>
            <p className="text-xs capitalize text-lavender">{translateCategory(meditation.category, language)} · {formatTime(meditation.duration)}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function InsightCard({ title, body, meta }: { title: string; body: string; meta?: string }) {
  return (
    <section className="rounded-[24px] border border-gold/20 bg-gradient-to-br from-gold/15 via-lavender/10 to-white/5 p-4 shadow-glow">
      <p className="text-xs uppercase tracking-[0.18em] text-gold">{title}</p>
      <p className="mt-3 text-sm leading-6 text-cream/85">{body}</p>
      {meta ? <p className="mt-3 text-xs text-lavender">{meta}</p> : null}
    </section>
  );
}

function LibraryPage(props: {
  categories: Category[];
  query: string;
  setQuery: (query: string) => void;
  category: string;
  setCategory: (category: string) => void;
  mode: LibraryMode;
  setMode: (mode: LibraryMode) => void;
  meditations: Meditation[];
  scenes: SceneDefinition[];
  hasPremium: boolean;
  loading: boolean;
  onOpen: (meditation: Meditation) => void;
  onOpenScene: (scene: SceneDefinition) => void;
  onFavorite: (meditation: Meditation) => void;
  onUnlock: () => void;
  language: AppLanguage;
}) {
  const t = copy[props.language];
  const filteredScenes = props.scenes.filter((scene) =>
    [scene.title[props.language], scene.subtitle[props.language], scene.mood, scene.category].join(' ').toLowerCase().includes(props.query.toLowerCase())
  );
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">{t.libraryTitle}</h2>
      <div className="grid grid-cols-2 gap-2 rounded-[18px] bg-cream/10 p-1">
        <button onClick={() => props.setMode('meditations')} className={`rounded-[14px] px-3 py-2 text-sm font-semibold ${props.mode === 'meditations' ? 'bg-gold text-night' : 'text-lavender'}`}>
          {t.meditationsTab}
        </button>
        <button onClick={() => props.setMode('scenes')} className={`rounded-[14px] px-3 py-2 text-sm font-semibold ${props.mode === 'scenes' ? 'bg-gold text-night' : 'text-lavender'}`}>
          {t.scenesTab}
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-cream/15 bg-white/10 px-4 py-3 backdrop-blur-xl">
        <Search size={18} className="text-lavender" />
        <input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder={t.searchByTitle} className="w-full bg-transparent text-sm outline-none placeholder:text-cream/45" />
      </div>
      {props.mode === 'meditations' ? (
        <>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
            <FilterPill active={props.category === 'all'} onClick={() => props.setCategory('all')} label={t.all} />
            <FilterPill active={props.category === 'short'} onClick={() => props.setCategory('short')} label={t.short} />
            {props.categories.map((item) => (
              <FilterPill key={item.slug} active={props.category === item.slug} onClick={() => props.setCategory(item.slug)} label={translateCategory(item.slug || item.name, props.language)} />
            ))}
          </div>
          {props.loading && !props.meditations.length ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => <MeditationCardSkeleton key={item} />)}
            </div>
          ) : props.meditations.length ? (
            props.meditations.map((meditation) => (
              <MeditationCard key={meditation.id} meditation={meditation} locked={meditation.premium && !props.hasPremium} onOpen={props.onOpen} onFavorite={props.onFavorite} onUnlock={props.onUnlock} language={props.language} />
            ))
          ) : (
            <EmptyState title={t.noMeditations} body={t.noMeditationsBody} />
          )}
        </>
      ) : filteredScenes.length ? (
        <section className="space-y-3">
          <p className="text-sm leading-6 text-lavender">{t.scenesLibraryBody}</p>
          {filteredScenes.map((scene) => (
            <SceneCard key={scene.id} scene={scene} locked={scene.access === 'premium' && !props.hasPremium} onOpen={props.onOpenScene} language={props.language} />
          ))}
        </section>
      ) : (
        <EmptyState title={t.noMeditations} body={t.noMeditationsBody} />
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

function MeditationCard({ meditation, locked, onOpen, onFavorite, onUnlock, language }: {
  meditation: Meditation;
  locked: boolean;
  onOpen: (meditation: Meditation) => void;
  onFavorite: (meditation: Meditation) => void;
  onUnlock: () => void;
  language: AppLanguage;
}) {
  const localized = getLocalizedMeditation(meditation, language);
  return (
    <article className="rounded-3xl border border-cream/15 bg-white/10 p-3 backdrop-blur-xl">
      <div className="flex gap-3">
        <div className="relative">
          <img src={meditation.cover_image} alt="" className={`h-24 w-24 rounded-2xl object-cover ${locked ? 'blur-sm' : ''}`} loading="lazy" />
          {locked && <Lock className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-gold" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{localized.title}</h3>
            {meditation.premium && <Crown size={15} className="text-gold" />}
          </div>
          <p className="mt-1 text-xs capitalize text-lavender">{translateCategory(meditation.category, language)}</p>
          <p className="mt-2 line-clamp-2 text-sm text-cream/70">{localized.description}</p>
          {!localized.hasSelectedLanguageAudio && <p className="mt-1 text-[11px] text-gold">{copy[language].availableInEnglish}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full bg-gold/15 px-2 py-1 text-gold">{meditation.premium ? copy[language].premium : copy[language].free}</span>
            <span className="rounded-full bg-cream/10 px-2 py-1 text-cream/70">{formatTime(meditation.duration)}</span>
            {meditation.play_count > 0 && <span className="rounded-full bg-lavender/15 px-2 py-1 text-lavender">{copy[language].popularToday}</span>}
            {meditation.history?.last_position ? <span className="rounded-full bg-cream/10 px-2 py-1 text-cream/70">{copy[language].resume}</span> : null}
          </div>
        </div>
        <button onClick={() => onFavorite(meditation)} className="self-start rounded-full bg-cream/10 p-2" aria-label="Favorite meditation">
          <Heart size={17} className={meditation.favorite ? 'fill-gold text-gold' : 'text-cream'} />
        </button>
      </div>
      <button onClick={() => (locked ? onUnlock() : onOpen(meditation))} className={`mt-3 w-full rounded-2xl px-4 py-3 text-sm font-semibold ${locked ? 'bg-gold text-night' : 'bg-cream/15 text-cream'}`}>
        {locked ? copy[language].unlockPremium : meditation.history?.last_position ? `${copy[language].resume} ${formatTime(meditation.history.last_position)}` : copy[language].play}
      </button>
    </article>
  );
}

function SceneCard({ scene, locked, onOpen, language }: {
  scene: SceneDefinition;
  locked: boolean;
  onOpen: (scene: SceneDefinition) => void;
  language: AppLanguage;
}) {
  return (
    <button onClick={() => onOpen(scene)} className="group w-full rounded-3xl border border-cream/15 bg-white/10 p-3 text-left backdrop-blur-xl transition hover:border-gold/35">
      <div className="flex gap-3">
        <div className="relative">
          <img src={scene.cover} alt="" className={`h-24 w-24 rounded-2xl object-cover shadow-glow ${locked ? 'blur-[2px]' : ''}`} loading="lazy" />
          {locked && <Lock className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-gold" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{scene.title[language]}</h3>
            {scene.access === 'premium' && <Crown size={15} className="text-gold" />}
          </div>
          <p className="mt-1 text-xs text-lavender">{scene.subtitle[language]}</p>
          <p className="mt-2 line-clamp-2 text-sm text-cream/70">{scene.description[language]}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full bg-gold/15 px-2 py-1 text-gold">{scene.access === 'premium' ? copy[language].premium : copy[language].free}</span>
            <span className="rounded-full bg-cream/10 px-2 py-1 text-cream/70">{scene.mood}</span>
            <span className="rounded-full bg-lavender/15 px-2 py-1 text-lavender">{copy[language].sceneLoop}</span>
          </div>
        </div>
        <Waves className="mt-1 text-gold" size={20} />
      </div>
    </button>
  );
}

function ScenePlayerPage({
  scene,
  scenes,
  hasPremium,
  playing,
  volume,
  onVolume,
  onToggle,
  onScene,
  onClose,
  language
}: {
  scene: SceneDefinition;
  scenes: SceneDefinition[];
  hasPremium: boolean;
  playing: boolean;
  volume: number;
  onVolume: (volume: number) => void;
  onToggle: () => void;
  onScene: (scene: SceneDefinition) => void;
  onClose: () => void;
  language: AppLanguage;
}) {
  return (
    <div className="relative space-y-4 luna-fade">
      <img src={scene.cover} alt="" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] w-full scale-110 rounded-[34px] object-cover opacity-25 blur-3xl" />
      <div className="rounded-[28px] border border-white/10 bg-ink p-4 shadow-glow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold">{copy[language].scenesTitle}</p>
            <h2 className="mt-1 font-serif text-3xl">{scene.title[language]}</h2>
          </div>
          <button onClick={onClose} aria-label={copy[language].closeScene} className="grid h-10 w-10 place-items-center rounded-full bg-cream/10 text-cream">
            <X size={18} />
          </button>
        </div>

        <img src={scene.cover} alt="" className="mt-4 aspect-square w-full rounded-[26px] object-cover shadow-glow" />
        <p className="mt-4 text-center text-sm text-lavender">{scene.subtitle[language]}</p>
        <p className="mt-2 text-center text-xs uppercase tracking-[0.18em] text-gold">{copy[language].sceneLoop}</p>

        <button onClick={onToggle} className="mx-auto mt-5 grid h-16 w-16 place-items-center rounded-full bg-gold text-night shadow-glow">
          {playing ? <Pause /> : <Play />}
        </button>

        <div className="mt-5 rounded-[20px] bg-surface p-4">
          <div className="mb-2 flex items-center justify-between text-sm text-lavender">
            <span className="inline-flex items-center gap-2"><Volume2 size={16} />{copy[language].sceneVolume}</span>
            <span>{Math.round(volume * 100)}%</span>
          </div>
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => onVolume(Number(event.target.value))} className="h-8 w-full accent-gold" />
        </div>
      </div>

      <section>
        <h3 className="mb-3 text-lg font-semibold">{copy[language].changeScene}</h3>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {scenes.map((item) => {
            const locked = item.access === 'premium' && !hasPremium;
            return (
              <button key={item.id} onClick={() => onScene(item)} className={`w-32 shrink-0 text-left ${locked ? 'opacity-70' : ''}`}>
                <div className="relative">
                  <img src={item.cover} alt="" className="h-32 w-32 rounded-3xl object-cover shadow-glow" />
                  {locked && <Lock className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-gold" />}
                </div>
                <p className="mt-2 line-clamp-1 text-sm font-semibold">{item.title[language]}</p>
                <p className="text-xs text-lavender">{item.access === 'premium' ? copy[language].premium : copy[language].free}</p>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SceneMiniPlayer({ scene, playing, volume, onToggle, onOpen, onVolume, language }: {
  scene: SceneDefinition;
  playing: boolean;
  volume: number;
  onToggle: () => void;
  onOpen: () => void;
  onVolume: (volume: number) => void;
  language: AppLanguage;
}) {
  return (
    <div className="fixed inset-x-4 bottom-[86px] z-20 mx-auto max-w-md rounded-[22px] border border-gold/20 bg-night/90 p-3 shadow-glow backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <img src={scene.cover} alt="" className="h-12 w-12 rounded-2xl object-cover" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{scene.title[language]}</p>
            <p className="truncate text-xs text-lavender">{scene.subtitle[language]}</p>
          </div>
        </button>
        <button onClick={onToggle} className="grid h-11 w-11 place-items-center rounded-full bg-gold text-night">
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
      </div>
      <input aria-label={copy[language].sceneVolume} type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => onVolume(Number(event.target.value))} className="mt-2 h-6 w-full accent-gold" />
    </div>
  );
}

function FavoritesPage({ meditations, onOpen, onFavorite, language }: { meditations: Meditation[]; onOpen: (meditation: Meditation) => void; onFavorite: (meditation: Meditation) => void; language: AppLanguage }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-3xl font-semibold">{copy[language].savedTitle}</h2>
        <p className="mt-1 text-sm text-lavender">{copy[language].savedSubtitle}</p>
      </div>
      {meditations.length ? meditations.map((meditation) => (
        <MeditationCard key={meditation.id} meditation={meditation} locked={false} onOpen={onOpen} onFavorite={onFavorite} onUnlock={() => undefined} language={language} />
      )) : <EmptyState title={copy[language].savedEmptyTitle} body={copy[language].savedEmptyBody} />}
    </div>
  );
}

function DailyCheckinSheet({
  initialMood,
  onClose,
  onSave,
  language
}: {
  initialMood: DailyCheckin['mood'];
  onClose: () => void;
  onSave: (input: DailyCheckinPayload) => Promise<void>;
  language: AppLanguage;
}) {
  const t = copy[language];
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
    } catch (saveError) {
      console.error('[Luna check-in save failed]', saveError);
      setError(t.checkinSaveError);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-night/70 px-4 pb-4 backdrop-blur-sm">
      <section className="w-full rounded-[30px] border border-white/10 bg-ink p-5 shadow-glow luna-fade">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold">{t.checkinKicker}</p>
            <h3 className="mt-1 font-serif text-3xl">{t.checkinTitle}</h3>
          </div>
          <button onClick={onClose} className="rounded-full bg-surface px-3 py-2 text-sm text-lavender">{t.checkinSkip}</button>
        </div>
        <CheckinGroup
          title={t.checkinSleep}
          options={[
            ['less_than_4', t.sleepLess4],
            ['4_6', t.sleep4To6],
            ['6_8', t.sleep6To8],
            ['8_plus', t.sleep8Plus]
          ]}
          value={sleepRange}
          onChange={(value) => setSleepRange(value as DailyCheckin['sleep_range'])}
        />
        <CheckinGroup
          title={t.checkinMood}
          options={[
            ['calm', t.moodCalm],
            ['stressed', t.moodStressed],
            ['tired', t.moodTired],
            ['anxious', t.moodAnxious],
            ['focused', t.moodFocused],
            ['low_energy', t.moodLowEnergy]
          ]}
          value={mood}
          onChange={(value) => setMood(value as DailyCheckin['mood'])}
        />
        <CheckinGroup
          title={t.checkinTime}
          options={[
            ['3', t.minutes3],
            ['5', t.minutes5],
            ['10', t.minutes10],
            ['15_plus', t.minutes15Plus]
          ]}
          value={availableMinutes}
          onChange={(value) => setAvailableMinutes(value as DailyCheckin['available_minutes'])}
        />
        {error && <p className="mt-3 rounded-2xl bg-red-500/15 p-3 text-sm text-red-100">{error}</p>}
        <button onClick={save} disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-[20px] bg-gold px-5 py-4 font-semibold text-night disabled:opacity-70">
          {saving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-night/30 border-t-night" />}
          {saving ? t.checkinSaving : t.checkinSave}
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
  locked,
  language
}: {
  onBuy: (plan: 'monthly' | 'lifetime') => void;
  message: string;
  openingPlan: 'monthly' | 'lifetime' | null;
  onLibrary: () => void;
  locked: Meditation | null;
  language: AppLanguage;
}) {
  const [comingSoon, setComingSoon] = useState('');
  const t = copy[language];

  return (
    <div className="space-y-2.5 luna-fade">
      <section className="overflow-hidden rounded-[24px] border border-white/10 bg-ink p-4 shadow-glow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold">{t.premiumTitle}</p>
            <h2 className="mt-1 font-serif text-3xl font-semibold leading-tight">{t.premiumHeadline}</h2>
          </div>
          <MoonMark className="h-14 w-14 shrink-0" />
        </div>
        <p className="mt-2 text-sm leading-5 text-beige">
          {t.premiumBody}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <PremiumBadge label={t.premiumLibrary} />
          <PremiumBadge label={t.weeklyContent} />
          <PremiumBadge label={t.dailyStreak} />
        </div>
      </section>
      {locked && <p className="rounded-[20px] bg-surface p-4 text-sm text-cream/80">{text(language, 'lockedPremium', { title: getLocalizedMeditation(locked, language).title })}</p>}
      <PlanCard title={t.monthlyPremium} price={`${premiumPrices.monthly} ⭐`} features={[t.unlimitedMeditations, t.premiumBreathing, t.sleepAnxietyFocus, t.dailyStreaks]} action={t.unlockMonthly} loading={openingPlan === 'monthly'} disabled={Boolean(openingPlan)} onClick={() => onBuy('monthly')} language={language} featured />
      <PlanCard title={t.lifetimePremium} price={`${premiumPrices.lifetime} ⭐`} features={[t.premiumForever, t.allFuturePractices, t.bestValue, t.instantTelegramUnlock]} action={t.getLifetime} loading={openingPlan === 'lifetime'} disabled={Boolean(openingPlan)} onClick={() => onBuy('lifetime')} language={language} />
      <div className="grid grid-cols-2 gap-2">
        <PremiumValue title={t.sleepDeeper} body={t.sleepDeeperBody} />
        <PremiumValue title={t.calmFaster} body={t.calmFasterBody} />
        <PremiumValue title={t.buildRhythm} body={t.buildRhythmBody} />
        <PremiumValue title={t.growGently} body={t.growGentlyBody} />
      </div>
      <PlanCard title={t.free} price="0" features={[t.freePlanFeature]} language={language} />
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setComingSoon('Card')} className="rounded-[20px] border border-white/10 bg-surface px-4 py-3 text-sm font-semibold">Card</button>
        <button onClick={() => setComingSoon('Crypto')} className="rounded-[20px] border border-white/10 bg-surface px-4 py-3 text-sm font-semibold">Crypto</button>
      </div>
      {message && <p className="rounded-2xl bg-lavender/15 p-4 text-sm text-cream/80">{message}</p>}
      {openingPlan && <div className="h-1 overflow-hidden rounded-full bg-cream/10"><div className="h-full w-1/2 animate-pulse rounded-full bg-gold" /></div>}
      {message === t.paymentSuccessful && <button onClick={onLibrary} className="w-full rounded-2xl bg-cream px-5 py-4 font-semibold text-night">{t.openPremiumLibrary}</button>}
      {comingSoon && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-night/80 px-5 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[28px] border border-white/10 bg-ink p-5 text-center shadow-glow">
            <p className="text-xs uppercase tracking-[0.18em] text-gold">{comingSoon}</p>
            <h3 className="mt-2 font-serif text-2xl">{t.comingSoon}</h3>
            <p className="mt-2 text-sm text-lavender">{t.starsAvailable}</p>
            <button onClick={() => setComingSoon('')} className="mt-5 w-full rounded-[20px] bg-gold px-4 py-3 font-semibold text-night">{t.close}</button>
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

function PlanCard(props: { title: string; price: string; features: string[]; action?: string; loading?: boolean; disabled?: boolean; featured?: boolean; onClick?: () => void; language: AppLanguage }) {
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
          {props.loading ? copy[props.language].openingPayment : props.action}
        </button>
      )}
    </article>
  );
}

function PlayerPage({ meditation, nextMeditation, favorite, onFavorite, onSave, onHome, onProgress, onPlaybackStart, onContinue, language }: {
  meditation: Meditation;
  nextMeditation?: Meditation;
  favorite: boolean;
  onFavorite: () => void;
  onSave: (position: number, duration: number, completed?: boolean) => Promise<unknown>;
  onHome: () => void;
  onProgress: () => void;
  onPlaybackStart?: () => void;
  onContinue: () => void;
  language: AppLanguage;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasInitializedPlaybackRef = useRef(false);
  const livePositionRef = useRef(0);
  const savedCompletionRef = useRef(false);
  const onSaveRef = useRef(onSave);
  const localized = getLocalizedMeditation(meditation, language);
  const nextLocalized = nextMeditation ? getLocalizedMeditation(nextMeditation, language) : null;
  const savedProgress = meditation.history?.last_position ?? 0;
  const initialPosition = meditation.history?.completed ||
    Number(meditation.history?.completion_percent ?? 0) >= 95 ||
    savedProgress >= Math.max(1, meditation.duration || 1) * 0.95
    ? 0
    : savedProgress;
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState(initialPosition);
  const [audioTime, setAudioTime] = useState(initialPosition);
  const [duration, setDuration] = useState(meditation.duration);
  const [speed, setSpeed] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [moonSeedRewardMessage, setMoonSeedRewardMessage] = useState('');

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const setLiveTime = (source: string, next: number, audio = audioRef.current) => {
    const safeDuration = Math.max(1, duration || meditation.duration || 1);
    const safeNext = Math.max(0, Math.min(next, safeDuration));
    console.log('[PLAYER_TIME_SET]', {
      source,
      newTime: safeNext,
      oldCurrentTime: position,
      audioTime: audio?.currentTime ?? null,
      savedProgress,
      livePosition: livePositionRef.current,
      meditationId: meditation.id,
      version: playerFixVersion,
      stack: new Error().stack
    });
    livePositionRef.current = safeNext;
    setPosition(safeNext);
    setAudioTime(audio?.currentTime ?? safeNext);
  };

  const seekTo = (next: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    hasInitializedPlaybackRef.current = true;
    audio.currentTime = next;
    setLiveTime('seekTo', next, audio);
    setAudioTime(audio.currentTime);
  };

  const pausePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const t = audio.currentTime;
    console.log('[PLAYER_PAUSE_CLICK]', {
      beforeAudioTime: t,
      beforeStateTime: position,
      savedProgress,
      livePosition: livePositionRef.current,
      meditationId: meditation.id,
      version: playerFixVersion
    });

    audio.pause();
    setPlaying(false);
    setLiveTime('pausePlayback:isolation-no-save', t, audio);
    setAudioTime(audio.currentTime);

    console.log('[PLAYER_AFTER_PAUSE]', {
      afterAudioTime: audio.currentTime,
      afterStateTime: t,
      savedProgress,
      livePosition: livePositionRef.current,
      meditationId: meditation.id,
      version: playerFixVersion
    });
  };

  useEffect(() => {
    audioRef.current?.pause();
    hasInitializedPlaybackRef.current = false;
    livePositionRef.current = initialPosition;
    setPlaying(false);
    setPosition(initialPosition);
    setAudioTime(initialPosition);
    setDuration(meditation.duration);
    setLoading(true);
    setCompleted(false);
    setMoonSeedRewardMessage('');
    savedCompletionRef.current = false;
    setShareMessage('');
    console.log('[PLAYER_ISOLATION_LOAD]', {
      initialPosition,
      savedProgress,
      meditationId: meditation.id,
      version: playerFixVersion
    });
  }, [language, localized.audioUrl, meditation.duration, meditation.id]);

  useEffect(() => {
    if (nextLocalized?.audioUrl) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'audio';
      link.href = nextLocalized.audioUrl;
      document.head.appendChild(link);
      return () => link.remove();
    }
  }, [nextLocalized?.audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const audioDuration = () => (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : meditation.duration);
    const syncProgress = () => {
      const nextDuration = audioDuration();
      const nextPosition = Math.min(audio.currentTime, nextDuration);
      setDuration(nextDuration);
      livePositionRef.current = nextPosition;
      setPosition(nextPosition);
      setAudioTime(audio.currentTime);
    };
    const loadedMetadata = () => {
      audio.playbackRate = speed;
      if (!hasInitializedPlaybackRef.current) {
        audio.currentTime = initialPosition;
        livePositionRef.current = initialPosition;
        setPosition(initialPosition);
        setAudioTime(audio.currentTime);
        hasInitializedPlaybackRef.current = true;
        console.log('[PLAYER_METADATA_INIT]', {
          initialPosition,
          savedProgress,
          meditationId: meditation.id,
          version: playerFixVersion
        });
      }
      setLoading(false);
      syncProgress();
    };
    const played = () => {
      onPlaybackStart?.();
      setPlaying(true);
      syncProgress();
    };
    const paused = () => {
      setPlaying(false);
      console.log('[PLAYER_NATIVE_PAUSE_ISOLATED]', {
        audioTime: audio.currentTime,
        stateTime: position,
        livePosition: livePositionRef.current,
        savedProgress,
        meditationId: meditation.id,
        version: playerFixVersion
      });
    };
    const ended = () => {
      const nextDuration = audioDuration();
      setPlaying(false);
      setCompleted(true);
      setDuration(nextDuration);
      setPosition(nextDuration);
      setAudioTime(nextDuration);
      livePositionRef.current = nextDuration;
      if (!savedCompletionRef.current) {
        savedCompletionRef.current = true;
        void onSaveRef.current(nextDuration, nextDuration, true)
          .then((result) => {
            const reward = result as { moonSeedsAwarded?: number; completionBonusAwarded?: boolean } | undefined;
            if (!reward?.moonSeedsAwarded) return;
            const base = language === 'en'
              ? `You earned ${reward.moonSeedsAwarded} Moon Seeds.`
              : `Ты получил(а) ${reward.moonSeedsAwarded} лунных семян.`;
            setMoonSeedRewardMessage(reward.completionBonusAwarded
              ? `${base} ${language === 'en' ? 'Includes a completion bonus.' : 'Включая бонус за завершение.'}`
              : base);
          })
          .catch((error) => {
            console.info('[Luna meditation completion save failed]', error instanceof Error ? error.message : 'Completion save failed.');
          });
      }
    };

    audio.addEventListener('loadedmetadata', loadedMetadata);
    audio.addEventListener('timeupdate', syncProgress);
    audio.addEventListener('play', played);
    audio.addEventListener('pause', paused);
    audio.addEventListener('ended', ended);
    if (audio.readyState >= 1) loadedMetadata();

    return () => {
      audio.removeEventListener('loadedmetadata', loadedMetadata);
      audio.removeEventListener('timeupdate', syncProgress);
      audio.removeEventListener('play', played);
      audio.removeEventListener('pause', paused);
      audio.removeEventListener('ended', ended);
      audio.pause();
    };
  }, [localized.audioUrl, meditation.duration, meditation.id, onPlaybackStart]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const shareMeditation = async () => {
    if (meditation.premium) {
      setShareMessage(copy[language].sharingFreeOnly);
      return;
    }

    const title = localized.title;
    const subtitle = meditationShareSubtitle(meditation, language);
    const shareText = `Try this meditation in Luna: ${title} — ${subtitle}`;
    const shareUrl = meditationShareUrl(meditation.id);

    setShareMessage('');
    getTelegram()?.HapticFeedback?.impactOccurred('light');

    try {
      const sharePayload = { title: 'Luna Meditation', text: shareText, url: shareUrl };
      if (getTelegram()?.openTelegramLink) {
        getTelegram()?.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`);
        setShareMessage(copy[language].linkCopied);
        return;
      }

      if (navigator.share) {
        await navigator.share(sharePayload);
        setShareMessage(copy[language].linkCopied);
        return;
      }

      const copied = await copyText(shareUrl);
      setShareMessage(copied ? copy[language].linkCopied : shareText);
    } catch {
      setShareMessage(copy[language].copyFailed);
    }
  };

  return (
    <div className="relative space-y-4 luna-fade">
      <img src={meditation.cover_image} alt="" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[440px] w-full scale-110 rounded-[34px] object-cover opacity-25 blur-3xl" />
      <div className="rounded-[24px] border border-white/10 bg-ink p-4 shadow-glow">
        <div className="relative mx-auto aspect-square w-full max-w-[300px] overflow-hidden rounded-[24px] border border-white/10 bg-night/80">
          <img src={meditation.cover_image} alt="" className="h-full w-full object-contain p-2" />
          {loading && <div className="absolute left-4 top-4 rounded-full bg-night/70 px-4 py-2 text-xs text-cream backdrop-blur">{copy[language].loadingAudio}</div>}
          {meditation.premium && <div className="absolute right-4 top-4 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-night">{copy[language].premium}</div>}
          {completed && (
            <div className="absolute inset-0 grid place-items-center bg-night/80 p-5 text-center backdrop-blur-sm">
              <div className="w-full rounded-[22px] border border-gold/25 bg-gradient-to-br from-gold/15 via-lavender/10 to-night/80 p-4 shadow-glow">
                <CheckCircle className="mx-auto text-gold" size={42} />
                <h3 className="mt-3 font-serif text-3xl">{copy[language].sessionComplete}</h3>
                <p className="mt-2 text-sm text-cream/75">{copy[language].sessionCompleteBody}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-left text-xs">
                  <span className="rounded-2xl bg-night/70 p-3 text-lavender">
                    {copy[language].minutesPracticed}
                    <strong className="mt-1 block text-lg text-cream">{Math.max(1, Math.round(duration / 60))}</strong>
                  </span>
                  <span className="rounded-2xl bg-night/70 p-3 text-lavender">
                    {translateCategory(meditation.category, language)}
                    <strong className="mt-1 block text-gold">{copy[language].plusCalmPoint}</strong>
                  </span>
                </div>
                <p className="mt-3 rounded-full bg-gold/15 px-3 py-2 text-xs font-semibold text-gold">{moonSeedRewardMessage || copy[language].plusMoonSeed}</p>
                <div className="mt-4 grid gap-2">
                  <button onClick={onHome} className="rounded-[16px] bg-gold px-4 py-2.5 text-sm font-semibold text-night">{copy[language].returnHome}</button>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={onContinue} className="rounded-[16px] bg-cream/10 px-3 py-2.5 text-xs text-cream">{copy[language].continueListeningButton}</button>
                    <button onClick={onProgress} className="rounded-[16px] bg-cream/10 px-3 py-2.5 text-xs text-cream">{copy[language].viewProgress}</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-gold">{translateCategory(meditation.category, language)}</p>
          <h2 className="mt-1 font-serif text-2xl font-semibold">{localized.title}</h2>
          <p className="mt-1 text-sm text-cream/70">{localized.subtitle}</p>
          {!localized.hasSelectedLanguageAudio && <p className="mt-2 text-xs text-gold">{copy[language].availableInEnglish}</p>}
          <p className="mt-2 text-sm text-lavender">{text(language, 'elapsedRemaining', { elapsed: formatTime(position), remaining: formatTime(Math.max(0, duration - position)) })}</p>
        </div>

        <input className="mt-5 h-8 w-full accent-gold" type="range" min={0} max={duration || 1} value={position} onChange={(event) => {
          const next = Number(event.target.value);
          seekTo(next);
        }} />
        <div className="mt-1 flex justify-between text-xs text-lavender">
          <span>{formatTime(position)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        <div className="mt-4 flex items-center justify-center gap-5">
          <IconButton label={copy[language].rewind15} onClick={() => {
            seekTo((audioRef.current?.currentTime ?? position) - 15);
          }}><SkipBack /></IconButton>
          <button onClick={() => {
            if (!audioRef.current) return;
            if (audioRef.current.paused) void audioRef.current.play();
            else pausePlayback();
          }} className="grid h-16 w-16 place-items-center rounded-full bg-gold text-night shadow-glow hover:brightness-110">
            {playing ? <Pause /> : <Play />}
          </button>
          <IconButton label={copy[language].forward15} onClick={() => {
            seekTo((audioRef.current?.currentTime ?? position) + 15);
          }}><SkipForward /></IconButton>
        </div>

        <div className="mt-4 rounded-[18px] border border-gold/20 bg-night/70 p-3 text-left text-[11px] leading-5 text-lavender">
          <p className="font-semibold text-gold">Player isolation debug</p>
          <p>version: {playerFixVersion}</p>
          <p>currentTime state: {position.toFixed(2)}</p>
          <p>audio.currentTime: {audioTime.toFixed(2)}</p>
          <p>savedProgress: {Number(savedProgress).toFixed(2)}</p>
          <p>livePositionRef: {livePositionRef.current.toFixed(2)}</p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button onClick={onFavorite} className="min-h-[72px] rounded-[18px] bg-surface px-2 py-3 text-xs"><Heart className={favorite ? 'mx-auto fill-gold text-gold' : 'mx-auto'} size={18} /><span className="mt-1.5 block">{copy[language].favorite}</span></button>
          <button onClick={() => void shareMeditation()} disabled={meditation.premium} className="min-h-[72px] rounded-[18px] bg-surface px-2 py-3 text-xs text-lavender disabled:cursor-not-allowed disabled:opacity-50"><Share2 className="mx-auto" size={18} /><span className="mt-1.5 block">{copy[language].share}</span></button>
          <div className="min-h-[72px] rounded-[18px] bg-surface px-2 py-3 text-center text-xs text-lavender"><Timer className="mx-auto" size={18} /><span className="mt-1.5 block">{formatTime(Math.max(0, duration - position))}</span></div>
        </div>
        {shareMessage && <p className="mt-2 rounded-2xl bg-gold/10 px-3 py-2 text-center text-xs text-cream/80">{shareMessage}</p>}

        <div className="mt-3 flex items-center justify-between rounded-[18px] bg-surface px-4 py-2.5">
          <span className="text-sm text-lavender">{copy[language].playbackSpeed}</span>
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
          src={localized.audioUrl}
          preload="auto"
          controlsList="nodownload"
          onContextMenu={(event) => event.preventDefault()}
        />
      </div>
    </div>
  );
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return <button aria-label={label} onClick={onClick} className="grid h-11 w-11 place-items-center rounded-full bg-surface text-cream">{children}</button>;
}

const breathModes: Array<{ id: BreathMode; key: 'calmBreath' | 'boxBreath' | 'softReset'; body: 'calmBreathBody' | 'boxBreathBody' | 'softResetBody' }> = [
  { id: 'calm', key: 'calmBreath', body: 'calmBreathBody' },
  { id: 'box', key: 'boxBreath', body: 'boxBreathBody' },
  { id: 'reset', key: 'softReset', body: 'softResetBody' }
];

function breathPhase(mode: BreathMode, elapsed: number, language: AppLanguage) {
  if (mode === 'box') {
    const step = elapsed % 16;
    if (step < 4) return { label: copy[language].inhale, scale: 1 + step / 4 * 0.34 };
    if (step < 8) return { label: copy[language].hold, scale: 1.34 };
    if (step < 12) return { label: copy[language].exhale, scale: 1.34 - (step - 8) / 4 * 0.34 };
    return { label: copy[language].hold, scale: 1 };
  }

  if (mode === 'reset') {
    const wave = (Math.sin((elapsed / 8) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
    return { label: copy[language].breatheNaturally, scale: 1 + wave * 0.26 };
  }

  const step = elapsed % 10;
  if (step < 4) return { label: copy[language].inhale, scale: 1 + step / 4 * 0.34 };
  return { label: copy[language].exhale, scale: 1.34 - (step - 4) / 6 * 0.34 };
}

function breathCycleLength(mode: BreathMode) {
  if (mode === 'box') return 16;
  if (mode === 'reset') return 8;
  return 10;
}

function BreathCirclePage({
  hasPremium,
  onComplete,
  onClose,
  onPremium,
  language
}: {
  hasPremium: boolean;
  onComplete: (mode: BreathMode, durationSeconds: number, breathCount: number) => Promise<void>;
  onClose: () => void;
  onPremium: () => void;
  language: AppLanguage;
}) {
  const [mode, setMode] = useState<BreathMode>('calm');
  const [minutes, setMinutes] = useState(1);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [savingError, setSavingError] = useState('');
  const startedAtRef = useRef<number | null>(null);
  const durationSeconds = minutes * 60;
  const phase = breathPhase(mode, elapsed, language);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const startedAt = startedAtRef.current ?? Date.now();
      const nextElapsed = Math.min(durationSeconds, (Date.now() - startedAt) / 1000);
      setElapsed(nextElapsed);
      if (nextElapsed >= durationSeconds) {
        window.clearInterval(timer);
        setRunning(false);
        setDone(true);
        const completedBreaths = Math.max(1, Math.floor(durationSeconds / breathCycleLength(mode)));
        onComplete(mode, durationSeconds, completedBreaths).catch(() => setSavingError(copy[language].breathSaveError));
      }
    }, 180);
    return () => window.clearInterval(timer);
  }, [durationSeconds, language, mode, onComplete, running]);

  const start = () => {
    if (minutes > 1 && !hasPremium) {
      onPremium();
      return;
    }
    setSavingError('');
    setDone(false);
    setElapsed(0);
    startedAtRef.current = Date.now();
    setRunning(true);
  };

  return (
    <div className="space-y-4 luna-fade">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold">{copy[language].categoryBreath}</p>
          <h2 className="font-serif text-3xl font-semibold">{copy[language].breathCircle}</h2>
          <p className="mt-1 text-sm text-lavender">{copy[language].breathCircleSubtitle}</p>
        </div>
        <button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full bg-surface text-cream" aria-label={copy[language].close}>
          <X size={18} />
        </button>
      </div>

      <section className="rounded-[28px] border border-gold/20 bg-gradient-to-br from-gold/10 via-lavender/10 to-ink p-5 text-center shadow-glow">
        <div className="mx-auto grid aspect-square w-[240px] max-w-full place-items-center rounded-full border border-gold/20 bg-night/70">
          <div
            className="grid h-36 w-36 place-items-center rounded-full border border-gold/40 bg-gradient-to-br from-gold/35 via-lavender/30 to-night text-center shadow-glow transition-transform duration-700 ease-in-out"
            style={{ transform: `scale(${phase.scale})` }}
          >
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-gold">{phase.label}</p>
              <p className="mt-1 font-serif text-2xl">{formatTime(Math.max(0, durationSeconds - elapsed))}</p>
            </div>
          </div>
        </div>
        <p className="mt-5 text-sm leading-6 text-cream/75">{copy[language].breathCircleBody}</p>
      </section>

      <section className="space-y-3">
        <div className="grid gap-2">
          {breathModes.map((item) => (
            <button key={item.id} onClick={() => setMode(item.id)} disabled={running} className={`rounded-[20px] border p-3 text-left ${mode === item.id ? 'border-gold bg-gold/15' : 'border-white/10 bg-surface'}`}>
              <strong className="block text-cream">{copy[language][item.key]}</strong>
              <span className="mt-1 block text-xs text-lavender">{copy[language][item.body]}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 3, 5].map((item) => (
            <button key={item} onClick={() => setMinutes(item)} disabled={running} className={`min-h-[48px] rounded-[18px] text-sm font-semibold ${minutes === item ? 'bg-gold text-night' : 'bg-surface text-cream'}`}>
              {item} {language === 'en' ? 'min' : 'мин'} {item > 1 && !hasPremium ? '⭐' : ''}
            </button>
          ))}
        </div>
      </section>

      {done ? (
        <div className="rounded-[24px] border border-gold/20 bg-gold/10 p-4 text-center">
          <CheckCircle className="mx-auto text-gold" />
          <h3 className="mt-2 font-serif text-2xl">{copy[language].breathComplete}</h3>
          <p className="mt-2 text-sm text-cream/75">
            {mode === 'reset'
              ? text(language, 'minutesToReturn', { minutes })
              : text(language, 'calmBreathsComplete', { count: Math.max(1, Math.floor(durationSeconds / breathCycleLength(mode))) })}
          </p>
          {savingError && <p className="mt-2 text-xs text-gold">{savingError}</p>}
        </div>
      ) : null}

      <button onClick={running ? () => setRunning(false) : start} className="w-full rounded-[20px] bg-gold px-5 py-4 font-semibold text-night shadow-glow">
        {running ? copy[language].pauseBreathing : copy[language].startBreathing}
      </button>
    </div>
  );
}

function MoonGardenCard({ profile, onOpen, language }: { profile: ProfileStats | null; onOpen: () => void; language: AppLanguage }) {
  const minutes = profile?.totalPracticeMinutes ?? profile?.minutesListened ?? 0;
  const wellnessLevel = moonGardenLevel(minutes, language);
  const seeds = availableMoonSeeds(profile);
  const plantedCount = plantedGardenElements(profile).length;
  const nextElement = nextGardenElement(profile);
  const readyElement = readyGardenElement(profile);
  const stage = getCurrentGardenStage(plantedCount);
  const progress = Math.max(0, Math.min(100, (stage.level / 7) * 100));

  return (
    <section className="mt-4 overflow-hidden rounded-[30px] border border-gold/25 bg-night shadow-glow">
      <div className="relative min-h-[300px]">
        <img src={stage.path} alt={stage.title[language]} className="absolute inset-0 h-full w-full object-cover object-[center_58%]" draggable={false} />
        <div className="absolute inset-0 bg-gradient-to-b from-night/70 via-night/10 to-night/85" />
        <div className="relative flex min-h-[300px] flex-col justify-between p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-gold">{copy[language].moonGarden}</p>
              <h3 className="mt-1 font-serif text-3xl leading-tight">{wellnessLevel.title}</h3>
              <p className="mt-1 text-sm leading-5 text-cream/75">{copy[language].profileLevel.replace('{level}', `${stage.level}`)} · {stage.title[language]}</p>
            </div>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-gold/30 bg-night/70 shadow-gold">
              <MoonMark className="h-9 w-9" />
            </div>
          </div>
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-night/80">
              <div className="h-full rounded-full bg-gold transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <span className="rounded-2xl bg-night/70 p-3 text-lavender backdrop-blur">
                {copy[language].moonSeeds}
                <strong className="mt-1 block text-2xl text-cream">{seeds}</strong>
              </span>
              <span className="rounded-2xl bg-night/70 p-3 text-lavender backdrop-blur">
                {copy[language].plantedElements}
                <strong className="mt-1 block text-2xl text-cream">{plantedCount}</strong>
              </span>
            </div>
            <div className="mt-3 rounded-2xl bg-night/70 p-3 text-xs text-lavender backdrop-blur">
              <p className="text-gold">
                {readyElement
                  ? text(language, 'readyToPlant', { name: readyElement.name[language] })
                  : plantedCount >= 7
                    ? copy[language].gardenFlourishing
                    : seeds === 0
                      ? copy[language].completePracticeSeed
                      : nextElement
                        ? `${copy[language].nextUnlock}: ${nextElement.name[language]}`
                        : copy[language].yourRhythm}
              </p>
            </div>
            <button onClick={onOpen} className="mt-3 w-full rounded-[18px] bg-gold px-4 py-3 text-sm font-semibold text-night">
              {copy[language].openMoonGarden}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function MoonGardenScene({
  profile,
  language,
  expanded = false,
  ambiencePlaying = false
}: {
  profile: ProfileStats | null;
  language: AppLanguage;
  appearedElementId?: string | null;
  expanded?: boolean;
  ambiencePlaying?: boolean;
}) {
  const plantedCount = plantedGardenElements(profile).length;
  const stage = getCurrentGardenStage(plantedCount);

  return (
    <AnimatedMoonGardenScene
      stage={{
        level: stage.level,
        path: stage.path,
        title: stage.title[language],
        subtitle: stage.subtitle[language]
      }}
      heading={copy[language].moonGarden}
      emptyMessage={language === 'en' ? 'Your garden is waiting for its first seed.' : 'Твой сад ждёт первое семя.'}
      compact={!expanded}
      ambiencePlaying={ambiencePlaying}
    />
  );
}

function MoonGardenPage({
  profile,
  onBack,
  onPlant,
  isAdmin,
  ambiencePlaying,
  ambienceVolume,
  ambienceError,
  onToggleAmbience,
  onAmbienceVolume,
  onDevAction,
  language
}: {
  profile: ProfileStats | null;
  onBack: () => void;
  onPlant: (element: GardenElement) => Promise<ProfileStats>;
  isAdmin: boolean;
  ambiencePlaying: boolean;
  ambienceVolume: number;
  ambienceError: boolean;
  onToggleAmbience: () => Promise<void>;
  onAmbienceVolume: (volume: number) => void;
  onDevAction: (input: { action: MoonGardenDevAction; seedBalance?: number; amount?: number; stageLevel?: number }) => Promise<ProfileStats>;
  language: AppLanguage;
}) {
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [devWorking, setDevWorking] = useState<string | null>(null);
  const [liveProfile, setLiveProfile] = useState<ProfileStats | null>(profile);
  const [message, setMessage] = useState('');
  const [appearedElementId, setAppearedElementId] = useState<string | null>(null);
  const [devOpen, setDevOpen] = useState(false);
  const [grantAmount, setGrantAmount] = useState(40);
  const [exactBalance, setExactBalance] = useState(25);
  const activeProfile = liveProfile ?? profile;
  const seeds = availableMoonSeeds(activeProfile);
  const planted = new Set(plantedGardenElements(activeProfile));
  const plantedCount = planted.size;
  const stage = getCurrentGardenStage(plantedCount);
  const nextElement = nextGardenElement(activeProfile);
  const readyElement = gardenElements.find((element) => !planted.has(element.id) && element.cost <= seeds) ?? null;
  const nextSuggestedElement = readyElement ?? nextElement;
  const isGardenComplete = plantedCount >= gardenElements.length;
  const nextUpgradeNeeded = nextSuggestedElement ? Math.max(0, nextSuggestedElement.cost - seeds) : 0;
  const canPlantNextUpgrade = Boolean(nextSuggestedElement && nextUpgradeNeeded === 0 && !workingId);
  const progressMessage = plantedCount >= gardenElements.length
    ? copy[language].gardenFlourishing
    : plantedCount >= 3
      ? copy[language].gardenTakingShape
      : plantedCount > 0
        ? copy[language].gardenQuietPlace
        : copy[language].completePracticeSeed;

  useEffect(() => {
    setLiveProfile(profile);
  }, [profile]);

  const plant = async (element: GardenElement) => {
    if (workingId) return;
    if (import.meta.env.DEV) {
      console.info('[MOON_GARDEN_PLANT_ATTEMPT]', {
        elementId: element.id,
        availableSeeds: seeds,
        cost: element.cost,
        planted: [...planted]
      });
      console.info('[MOON_GARDEN_BALANCE]', {
        moonSeedsAvailable: activeProfile?.moonSeedsAvailable,
        moonSeeds: activeProfile?.moonSeeds,
        moonSeedsEarnedTotal: activeProfile?.moonSeedsEarnedTotal
      });
    }
    if (planted.has(element.id)) {
      if (import.meta.env.DEV) console.info('[MOON_GARDEN_PLANT_BLOCKED]', { reason: 'already_planted', elementId: element.id });
      setMessage(copy[language].alreadyPlanted);
      return;
    }
    if (seeds < element.cost) {
      if (import.meta.env.DEV) console.info('[MOON_GARDEN_PLANT_BLOCKED]', { reason: 'not_enough_seeds', elementId: element.id, availableSeeds: seeds, cost: element.cost });
      setMessage(readyElement ? text(language, 'readyToPlant', { name: readyElement.name[language] }) : copy[language].notEnoughSeeds);
      return;
    }

    setWorkingId(element.id);
    setMessage('');
    const previousProfile = activeProfile;
    const previousStage = getCurrentGardenStage(planted.size);
    const nextPlanted = [...planted, element.id];
    if (activeProfile) {
      setLiveProfile({
        ...activeProfile,
        moonSeeds: seeds - element.cost,
        moonSeedsAvailable: seeds - element.cost,
        plantedGardenElements: nextPlanted,
        plantedElementsCount: nextPlanted.length
      });
      setAppearedElementId(element.id);
    }
    try {
      const nextProfile = await onPlant(element);
      setLiveProfile(nextProfile);
      setAppearedElementId(element.id);
      const plantedAfterSave = plantedGardenElements(nextProfile).length;
      const nextStage = getCurrentGardenStage(plantedAfterSave);
      const stageMessage = nextStage.level > previousStage.level
        ? ` ${language === 'en' ? 'New garden stage unlocked' : 'Открыт новый уровень сада'}: ${nextStage.title[language]}.`
        : '';
      setMessage(`${text(language, 'elementPlanted', { name: element.name[language] })} ${copy[language].gardenGrew}${stageMessage}`);
      if (import.meta.env.DEV) {
        console.info('[MOON_GARDEN_PLANT_SUCCESS]', {
          elementId: element.id,
          moonSeedsAvailable: nextProfile.moonSeedsAvailable,
          plantedGardenElements: nextProfile.plantedGardenElements
        });
      }
    } catch {
      if (import.meta.env.DEV) console.info('[MOON_GARDEN_PLANT_BLOCKED]', { reason: 'api_failed', elementId: element.id });
      setLiveProfile(previousProfile);
      setAppearedElementId(null);
      setMessage(readyElement ? text(language, 'readyToPlant', { name: readyElement.name[language] }) : copy[language].notEnoughSeeds);
    } finally {
      setWorkingId(null);
    }
  };

  const runDevAction = async (input: { action: MoonGardenDevAction; seedBalance?: number; amount?: number; stageLevel?: number }) => {
    if (devWorking) return;
    setDevWorking(input.seedBalance === undefined && input.stageLevel === undefined ? input.action : `${input.action}-${input.seedBalance ?? input.stageLevel}`);
    setMessage('');
    try {
      const nextProfile = await onDevAction(input);
      setLiveProfile(nextProfile);
      setAppearedElementId(input.action === 'unlock_full' || input.action === 'set_stage' ? 'full_moon_garden' : null);
      setMessage(copy[language].gardenUpdated);
    } catch {
      setMessage(language === 'en' ? 'Developer action failed.' : 'Не удалось выполнить действие.');
    } finally {
      setDevWorking(null);
    }
  };

  return (
    <div className="space-y-4 pb-[calc(120px+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top,0px)+56px)] luna-fade">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold">{copy[language].moonGarden}</p>
          <h2 className="font-serif text-3xl font-semibold">{copy[language].moonGarden}</h2>
          <p className="mt-1 text-sm text-lavender">{copy[language].moonGardenBody}</p>
        </div>
        <button onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full bg-surface text-cream" aria-label={copy[language].close}>
          <X size={18} />
        </button>
      </div>

      <MoonGardenScene profile={activeProfile} language={language} appearedElementId={appearedElementId} expanded ambiencePlaying={ambiencePlaying} />

      <section className="rounded-[24px] border border-white/10 bg-ink/90 p-4 shadow-glow">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-gold">{copy[language].gardenAmbience}</p>
            <p className="mt-1 text-sm text-lavender">{language === 'en' ? 'A soft night layer for your garden.' : 'Мягкий ночной слой для твоего сада.'}</p>
          </div>
          <button onClick={() => void onToggleAmbience()} className="rounded-2xl bg-gold px-4 py-3 text-sm font-semibold text-night">
            {ambiencePlaying ? copy[language].pauseGardenAmbience : copy[language].playGardenAmbience}
          </button>
        </div>
        <label className="mt-3 block text-xs text-lavender">
          <span className="inline-flex items-center gap-2"><Volume2 size={14} />{Math.round(ambienceVolume * 100)}%</span>
          <input
            aria-label={copy[language].gardenAmbience}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={ambienceVolume}
            onChange={(event) => onAmbienceVolume(Number(event.target.value))}
            className="mt-2 h-6 w-full accent-gold"
          />
        </label>
        {ambienceError && <p className="mt-3 rounded-2xl bg-gold/10 px-3 py-2 text-xs text-gold">{copy[language].gardenAmbienceUnavailable}</p>}
      </section>

      <section className="rounded-[26px] border border-gold/20 bg-ink p-4 shadow-glow">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Stat label={copy[language].availableMoonSeeds} value={String(seeds)} />
          <Stat label={copy[language].gardenLevel} value={`${stage.level} · ${stage.title[language]}`} />
          <Stat label={copy[language].plantedElements} value={String(plantedCount)} />
        </div>
        {message && <p className="mt-3 rounded-2xl bg-night/70 px-3 py-2 text-sm text-gold">{message}</p>}
      </section>

      <section className="rounded-[26px] border border-gold/20 bg-gradient-to-br from-gold/15 via-surface/80 to-night p-4 shadow-glow">
        {isGardenComplete ? (
          <>
            <p className="text-xs uppercase tracking-[0.18em] text-gold">{copy[language].gardenComplete}</p>
            <h3 className="mt-1 font-serif text-2xl">{stage.title[language]}</h3>
            <p className="mt-2 text-sm leading-6 text-cream/75">{copy[language].gardenFlourishing}</p>
            <p className="mt-3 rounded-2xl bg-night/60 px-3 py-2 text-sm text-gold">{plantedCount} / {gardenElements.length} {copy[language].plantedElements.toLowerCase()}</p>
          </>
        ) : nextSuggestedElement ? (
          <>
            <p className="text-xs uppercase tracking-[0.18em] text-gold">{copy[language].nextUnlock}</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[20px] border border-gold/30 bg-gold/10">
                <GardenUpgradeIcon visual={nextSuggestedElement.visual} active />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-2xl">{nextSuggestedElement.name[language]}</h3>
                <p className="mt-1 text-xs text-lavender">{text(language, 'unlocksLevel', { level: nextSuggestedElement.unlockLevel })} · {copy[language].cost}: {nextSuggestedElement.cost} {copy[language].moonSeeds}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-cream/75">{nextSuggestedElement.description[language]}</p>
            <button
              onClick={() => void plant(nextSuggestedElement)}
              disabled={!canPlantNextUpgrade}
              className={`mt-4 w-full rounded-[18px] px-4 py-3 text-sm font-semibold ${
                canPlantNextUpgrade ? 'bg-gold text-night' : 'bg-surface text-lavender'
              } disabled:cursor-not-allowed disabled:opacity-80`}
            >
              {canPlantNextUpgrade
                ? (workingId === nextSuggestedElement.id ? copy[language].planting : copy[language].plantUpgrade)
                : text(language, 'needMoreSeeds', { count: nextUpgradeNeeded })}
            </button>
          </>
        ) : (
          <p className="text-sm text-lavender">{progressMessage}</p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-serif text-2xl">{copy[language].gardenElements}</h3>
        {gardenElements.map((element) => {
          const isPlanted = planted.has(element.id);
          const needed = Math.max(0, element.cost - seeds);
          const canPlant = !isPlanted && needed === 0;
          const status = isPlanted ? copy[language].planted : canPlant ? copy[language].availableToPlant : copy[language].locked;
          return (
            <article key={element.id} className="rounded-[24px] border border-white/10 bg-gradient-to-br from-ink via-surface/70 to-night p-4 shadow-glow">
              <div className="flex items-center gap-3">
                <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-[22px] border ${isPlanted ? 'border-gold bg-gold/20 shadow-gold' : canPlant ? 'border-gold/30 bg-gold/10' : 'border-white/10 bg-night/70'}`}>
                  <GardenUpgradeIcon visual={element.visual} active={isPlanted || canPlant} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="truncate font-serif text-xl">{element.name[language]}</h4>
                    <span className={`rounded-full px-2 py-1 text-[11px] ${isPlanted ? 'bg-white/10 text-lavender' : 'bg-gold/15 text-gold'}`}>{element.cost} {copy[language].moonSeeds}</span>
                  </div>
                  <p className="mt-1 text-xs text-lavender">{text(language, 'unlocksLevel', { level: element.unlockLevel })} · {status}</p>
                  <p className="mt-2 text-sm leading-5 text-cream/70">{element.description[language]}</p>
                </div>
              </div>
              {isPlanted ? (
                <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-gold/15 px-3 py-2 text-xs font-semibold text-gold">
                  <CheckCircle size={14} /> {copy[language].planted}
                </p>
              ) : (
                <button
                  onClick={() => void plant(element)}
                  disabled={Boolean(workingId) || !canPlant}
                  className={`mt-3 w-full rounded-[18px] px-4 py-3 text-sm font-semibold ${
                    canPlant ? 'bg-gold text-night' : 'bg-surface text-lavender'
                  } disabled:cursor-not-allowed disabled:opacity-80`}
                >
                  {canPlant
                    ? (workingId === element.id ? copy[language].planting : copy[language].plantUpgrade)
                    : text(language, 'needMoreSeeds', { count: needed })}
                </button>
              )}
            </article>
          );
        })}
      </section>

      {isAdmin && (
        <section className="rounded-[24px] border border-gold/20 bg-night/80 p-4 shadow-glow">
          <button onClick={() => setDevOpen((value) => !value)} className="flex w-full items-center justify-between text-left">
            <span className="text-xs uppercase tracking-[0.18em] text-gold">{copy[language].developerTools}</span>
            <span className="text-xs text-lavender">{devOpen ? 'Hide' : 'Show'}</span>
          </button>
          {devOpen && (
            <>
              <div className="mt-3 rounded-2xl bg-ink/80 p-3">
                <p className="text-xs text-lavender">Grant Moon Seeds</p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    min={1}
                    value={grantAmount}
                    onChange={(event) => setGrantAmount(Math.max(1, Number(event.target.value) || 1))}
                    className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-night px-3 py-2 text-sm text-cream outline-none focus:border-gold/50"
                  />
                  <button disabled={Boolean(devWorking)} onClick={() => void runDevAction({ action: 'grant_seeds', amount: grantAmount })} className="rounded-2xl bg-gold px-3 py-2 text-sm font-semibold text-night disabled:opacity-60">
                    Grant
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {[10, 25, 40, 70, 100].map((amount) => (
                    <button key={amount} disabled={Boolean(devWorking)} onClick={() => void runDevAction({ action: 'grant_seeds', amount })} className="rounded-2xl bg-surface px-2 py-2 text-xs font-semibold text-cream disabled:opacity-60">
                      +{amount}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button disabled={Boolean(devWorking)} onClick={() => void runDevAction({ action: 'grant_100' })} className="rounded-2xl bg-gold px-3 py-3 text-sm font-semibold text-night disabled:opacity-60">
                  {copy[language].grant100Seeds}
                </button>
                <button disabled={Boolean(devWorking)} onClick={() => void runDevAction({ action: 'unlock_full' })} className="rounded-2xl bg-gold/20 px-3 py-3 text-sm font-semibold text-gold disabled:opacity-60">
                  {copy[language].unlockFullGarden}
                </button>
                <button disabled={Boolean(devWorking)} onClick={() => window.confirm('Reset planted upgrades only?') && void runDevAction({ action: 'reset_planted' })} className="rounded-2xl bg-surface px-3 py-3 text-sm font-semibold text-lavender disabled:opacity-60">
                  {copy[language].resetPlantedGarden}
                </button>
                <button disabled={Boolean(devWorking)} onClick={() => window.confirm('Reset planted upgrades and seeds?') && void runDevAction({ action: 'reset_all' })} className="rounded-2xl bg-surface px-3 py-3 text-sm font-semibold text-lavender disabled:opacity-60">
                  {copy[language].resetGarden}
                </button>
              </div>

              <div className="mt-3 rounded-2xl bg-ink/80 p-3">
                <p className="text-xs text-lavender">Set exact Moon Seeds balance</p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    min={0}
                    value={exactBalance}
                    onChange={(event) => setExactBalance(Math.max(0, Number(event.target.value) || 0))}
                    className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-night px-3 py-2 text-sm text-cream outline-none focus:border-gold/50"
                  />
                  <button disabled={Boolean(devWorking)} onClick={() => void runDevAction({ action: 'set_balance', seedBalance: exactBalance })} className="rounded-2xl bg-gold/20 px-3 py-2 text-sm font-semibold text-gold disabled:opacity-60">
                    Set
                  </button>
                </div>
              </div>

              <p className="mt-4 text-xs text-lavender">{copy[language].seedBalanceQuickSet}</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[0, 10, 25, 100].map((count) => (
                  <button
                    key={count}
                    disabled={Boolean(devWorking)}
                    onClick={() => void runDevAction({ action: 'set_balance', seedBalance: count })}
                    className="rounded-2xl bg-surface px-2 py-3 text-xs font-semibold text-cream disabled:opacity-60"
                  >
                    {text(language, 'setSeeds', { count })}
                  </button>
                ))}
              </div>

              <p className="mt-4 text-xs text-lavender">Set Garden Stage</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {gardenStages.map((stage) => (
                  <button
                    key={stage.level}
                    disabled={Boolean(devWorking)}
                    onClick={() => void runDevAction({ action: 'set_stage', stageLevel: stage.level })}
                    className="rounded-2xl bg-surface px-2 py-3 text-xs font-semibold text-cream disabled:opacity-60"
                  >
                    L{stage.level}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function ProfilePage({
  profile,
  access,
  firstName,
  username,
  wellness,
  showAdminButton,
  onMoonGarden,
  onAdmin,
  onRestore,
  language
}: {
  profile: ProfileStats | null;
  access: AccessState;
  firstName: string;
  username?: string;
  wellness: WellnessSummary | null;
  showAdminButton: boolean;
  onMoonGarden: () => void;
  onAdmin: () => void;
  onRestore: () => void;
  language: AppLanguage;
}) {
  const weeklyMinutes = profile?.weeklyPracticeMinutes ?? 0;
  const currentMood = wellness?.mostCommonMoodLabel ? translateMoodLabel(wellness.mostCommonMoodLabel, language) : copy[language].notEnoughData;
  return (
    <div className="space-y-3 pt-[calc(env(safe-area-inset-top,0px)+56px)] luna-fade">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-gold">LUNA</p>
        <h2 className="font-serif text-3xl font-semibold">{copy[language].profile}</h2>
      </div>
      <div className="rounded-[24px] border border-white/10 bg-ink p-4 shadow-glow">
        <div className="flex items-center gap-4">
          <MoonMark className="h-16 w-16 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-serif text-2xl font-semibold">{firstName}</h3>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${access.hasPremium ? 'bg-gold text-night' : 'bg-cream/10 text-lavender'}`}>
                {access.hasPremium ? copy[language].premiumActive : copy[language].premiumFree}
              </span>
            </div>
            <p className="text-sm text-lavender">{username ? `@${username}` : copy[language].member}</p>
          </div>
        </div>
        <MoonGardenCard profile={profile} onOpen={onMoonGarden} language={language} />
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Stat label={copy[language].thisWeek} value={minutesCountLabel(weeklyMinutes, language)} />
          <Stat label={copy[language].quietRhythm} value={quietDayCountLabel(profile?.currentStreak ?? 0, language)} />
          <Stat label={copy[language].weeklyCheckins} value={`${wellness?.weeklyCheckinCount ?? 0}/7`} />
          <Stat label={copy[language].currentMood} value={currentMood} />
        </div>
        <div className="mt-6">
          <InsightCard title={copy[language].weeklyInsightTitle} body={profileWeeklyInsight(profile, language)} />
        </div>
        {showAdminButton && (
          <div className="mt-6 border-t border-white/10 pt-3">
            <button onClick={onAdmin} className="rounded-full border border-gold/25 bg-gold/10 px-4 py-2 text-xs font-semibold text-gold">
              Admin
            </button>
          </div>
        )}
        <button onClick={onRestore} className="mt-4 w-full rounded-[20px] bg-gold px-5 py-3.5 font-semibold text-night">{copy[language].restore}</button>
        <button className="mt-2.5 w-full rounded-[20px] bg-surface px-5 py-3.5 text-sm text-lavender">{copy[language].logout}</button>
      </div>
    </div>
  );
}

function meditationPayloadFromLocalized(base: Partial<MeditationPayload> = {}, category = 'sleep'): MeditationPayload {
  const en = base.translations?.en ?? {};
  return {
    title: en.title ?? base.title ?? '',
    subtitle: en.subtitle ?? base.subtitle ?? '',
    description: en.description ?? base.description ?? '',
    category: base.category ?? category,
    duration: base.duration ?? 600,
    cover_image: base.cover_image ?? '',
    audio_file: en.audioUrl ?? base.audio_file ?? '',
    premium: base.premium ?? false,
    published: base.published ?? true,
    mood: base.mood ?? 'Calm',
    translations: {
      en: {
        title: en.title ?? base.title ?? '',
        subtitle: en.subtitle ?? base.subtitle ?? '',
        description: en.description ?? base.description ?? '',
        audioUrl: en.audioUrl ?? base.audio_file ?? ''
      },
      ru: {
        title: base.translations?.ru?.title ?? '',
        subtitle: base.translations?.ru?.subtitle ?? '',
        description: base.translations?.ru?.description ?? '',
        audioUrl: base.translations?.ru?.audioUrl ?? ''
      }
    }
  };
}

const emptyMeditationForm = (category = 'sleep'): MeditationPayload => meditationPayloadFromLocalized({}, category);

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
  const [ruAudioProgress, setRuAudioProgress] = useState(0);
  const [coverProgress, setCoverProgress] = useState(0);
  const [audioFileName, setAudioFileName] = useState('');
  const [ruAudioFileName, setRuAudioFileName] = useState('');
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
    setRuAudioProgress(0);
    setCoverProgress(0);
    setAudioFileName('');
    setRuAudioFileName('');
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

  const setTranslation = (language: AppLanguage, field: 'title' | 'subtitle' | 'description' | 'audioUrl', value: string) => {
    setForm((current) => {
      const translations = {
        ...(current.translations ?? {}),
        [language]: {
          ...(current.translations?.[language] ?? {}),
          [field]: value
        }
      };

      if (language === 'en') {
        return {
          ...current,
          title: field === 'title' ? value : current.title,
          subtitle: field === 'subtitle' ? value : current.subtitle,
          description: field === 'description' ? value : current.description,
          audio_file: field === 'audioUrl' ? value : current.audio_file,
          translations
        };
      }

      return { ...current, translations };
    });
  };

  const upload = async (kind: 'audio' | 'cover', file?: File, language: AppLanguage = 'en') => {
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
        if (language === 'ru') {
          setRuAudioFileName(file.name);
          setRuAudioProgress(1);
        } else {
          setAudioFileName(file.name);
          setAudioProgress(1);
        }
      } else {
        setCoverFileName(file.name);
        setCoverProgress(1);
      }

      const result = await uploadAdminAsset(kind, file, initData, (progress) => {
        if (kind === 'audio' && language === 'ru') setRuAudioProgress(progress);
        else if (kind === 'audio') setAudioProgress(progress);
        else setCoverProgress(progress);
      });

      if (kind === 'audio') {
        setTranslation(language, 'audioUrl', result.publicUrl);
      } else {
        setForm((current) => ({ ...current, cover_image: result.publicUrl }));
      }
      setMessage(`${kind === 'audio' ? 'Audio' : 'Cover'} uploaded successfully.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed. Please try again.');
    }
  };

  const save = async () => {
    setError('');
    setMessage('');

    const payload = meditationPayloadFromLocalized(form, categories[0]?.slug);

    if (!payload.title.trim()) {
      setError('English title is required.');
      return;
    }

    if (!payload.audio_file || !payload.cover_image) {
      setError('Upload an English MP3 audio file and a cover image before saving.');
      return;
    }

    try {
      if (editingId) {
        await updateMeditation(editingId, payload, initData);
        setMessage('Meditation updated.');
      } else {
        await createMeditation(payload, initData);
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
    setForm(meditationPayloadFromLocalized({
      title: meditation.title,
      subtitle: meditation.subtitle ?? '',
      description: meditation.description,
      category: meditation.category,
      duration: meditation.duration,
      cover_image: meditation.cover_image,
      audio_file: meditation.audio_file,
      premium: meditation.premium,
      published: meditation.published,
      mood: meditation.mood,
      translations: meditation.translations
    }, categories[0]?.slug));
    setMessage('Editing meditation.');
    setAudioFileName((meditation.translations?.en?.audioUrl ?? meditation.audio_file).split('/').pop() ?? 'Audio uploaded');
    setRuAudioFileName(meditation.translations?.ru?.audioUrl?.split('/').pop() ?? '');
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
              <Stat label="Wanted length" value={durationLabel(dashboard.wellness?.mostRequestedDuration ?? null, 'en')} />
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
            <AdminSection title="English Content">
              <AdminInput label="English title" value={form.translations?.en?.title ?? form.title} onChange={(value) => setTranslation('en', 'title', value)} />
              <AdminInput label="English subtitle" value={form.translations?.en?.subtitle ?? form.subtitle} onChange={(value) => setTranslation('en', 'subtitle', value)} />
              <label className="text-sm text-lavender">
                English description
                <textarea value={form.translations?.en?.description ?? form.description} onChange={(event) => setTranslation('en', 'description', event.target.value)} className="mt-2 min-h-28 w-full rounded-2xl bg-night/70 px-4 py-3 text-sm text-cream outline-none" />
              </label>
            </AdminSection>

            <AdminSection title="Russian Content">
              <AdminInput label="Russian title" value={form.translations?.ru?.title ?? ''} onChange={(value) => setTranslation('ru', 'title', value)} />
              <AdminInput label="Russian subtitle" value={form.translations?.ru?.subtitle ?? ''} onChange={(value) => setTranslation('ru', 'subtitle', value)} />
              <label className="text-sm text-lavender">
                Russian description
                <textarea value={form.translations?.ru?.description ?? ''} onChange={(event) => setTranslation('ru', 'description', event.target.value)} className="mt-2 min-h-28 w-full rounded-2xl bg-night/70 px-4 py-3 text-sm text-cream outline-none" />
              </label>
              <p className="rounded-2xl bg-gold/10 px-3 py-2 text-xs text-gold">
                Leave Russian audio empty until the RU MP3 is ready. Russian users will hear the English fallback.
              </p>
            </AdminSection>

            <AdminSection title="Meditation Details">
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
                <DropUpload title="+ Upload English audio" body="MP3 only · up to 100 MB" readyText={audioFileName ? `${audioFileName} · ${formatTime(form.duration)} · Ready` : ''} icon={<Upload />} accept="audio/mpeg,audio/mp3,.mp3" progress={audioProgress} onFile={(file) => upload('audio', file, 'en')} />
                <DropUpload title="+ Upload Russian audio" body="MP3 only · optional" readyText={ruAudioFileName ? `${ruAudioFileName} · Ready` : ''} icon={<Upload />} accept="audio/mpeg,audio/mp3,.mp3" progress={ruAudioProgress} onFile={(file) => upload('audio', file, 'ru')} />
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
          Check-in: {checkin.user?.first_name ?? checkin.telegram_id} · {checkin.mood.replace('_', ' ')} · {durationLabel(checkin.available_minutes, 'en')}
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
          <Stat label="Practice length" value={durationLabel(dashboard.wellness?.mostRequestedDuration ?? null, 'en')} />
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

function Nav({ active, onChange, language }: { active: Page; onChange: (page: Page) => void; language: AppLanguage }) {
  const items: Array<{ page: Page; label: string; icon: typeof Home }> = [
    { page: 'home', label: copy[language].navHome, icon: Home },
    { page: 'library', label: copy[language].navLibrary, icon: BookOpen },
    { page: 'favorites', label: copy[language].navSaved, icon: Heart },
    { page: 'pricing', label: copy[language].navPremium, icon: Crown },
    { page: 'profile', label: copy[language].navProfile, icon: User }
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
