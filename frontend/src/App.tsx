import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Bell,
  Camera,
  CheckCircle,
  ChevronRight,
  CreditCard,
  Crown,
  Edit3,
  Globe2,
  Heart,
  Image as ImageIcon,
  Lock,
  Pause,
  Play,
  Search,
  Settings,
  Share2,
  SkipBack,
  SkipForward,
  Sparkles,
  Target,
  Timer,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import {
  createInvoiceLink,
  createMeditation,
  clearLunaConversations,
  clearLunaMemory,
  deleteLunaMemory,
  deleteMeditation,
  getAccess,
  checkAdmin,
  getAdminDashboard,
  getCategories,
  getAdminMeditations,
  getFavorites,
  getHistory,
  getLunaMemory,
  getMeditations,
  getProfile,
  getWellnessSummary,
  plantMoonGardenElement,
  recordSceneMoonSeed,
  removeProfileAvatar,
  saveDailyCheckin,
  saveBreathSession,
  saveHistory,
  setFavorite,
  setLunaMemoryEnabled,
  syncUser,
  uploadProfileAvatar,
  updateNotificationPreferences,
  updateProfileGoals,
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
  type LunaMemory,
  type MoonGardenDevAction,
  type NotificationPreferences,
  type PlaybackHistory,
  type ProfileStats,
  type WellnessSummary
} from './api';
import { MoonGardenScene as AnimatedMoonGardenScene } from './components/moon-garden/MoonGardenScene';
import { LunaChat } from './components/LunaChat';
import { V2BottomNav } from './v2/components/V2BottomNav';
import { HomeV2 } from './v2/pages/HomeV2';

type Page = 'home' | 'luna' | 'library' | 'progress' | 'favorites' | 'profile' | 'pricing' | 'player' | 'scenePlayer' | 'mantraPlayer' | 'breathCircle' | 'moonGarden' | 'admin';
type Mood = 'Calm' | 'Stressed' | 'Tired' | 'Anxious' | 'Focused';
type MoodChip = 'Sleep' | 'Calm' | 'Focus' | 'Anxiety' | 'Breath' | 'Energy';
type LibraryMode = 'meditations' | 'breathing' | 'mantras';
type SceneAccess = 'free' | 'premium';
type BreathMode = 'calm' | 'box' | 'reset';
type ContentAccess = 'free' | 'premium';
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
type MantraDefinition = {
  id: string;
  title: Record<AppLanguage, string>;
  subtitle: Record<AppLanguage, string>;
  description: Record<AppLanguage, string>;
  category: string;
  tags: string[];
  access: ContentAccess;
  duration: number;
  cover: string;
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
const mantraAudioCache = new Map<string, string>();
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

function mantraCover(seed: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <defs>
        <radialGradient id="bg" cx="50%" cy="36%" r="72%">
          <stop offset="0%" stop-color="#8e5fd6"/>
          <stop offset="48%" stop-color="#4b2d68"/>
          <stop offset="100%" stop-color="#141026"/>
        </radialGradient>
        <linearGradient id="gold" x1="0" x2="1">
          <stop stop-color="#f5f1e9"/>
          <stop offset="1" stop-color="#d4af37"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="64" fill="url(#bg)"/>
      <circle cx="256" cy="188" r="96" fill="none" stroke="url(#gold)" stroke-width="4" opacity=".82"/>
      <path d="M287 116a72 72 0 1 0 0 144a88 88 0 1 1 0-144Z" fill="url(#gold)" opacity=".94"/>
      <path d="M107 358c50-28 100-26 149 0s98 28 149 0" fill="none" stroke="#d4af37" stroke-width="5" opacity=".55"/>
      <text x="50%" y="424" text-anchor="middle" fill="#f5f1e9" font-family="Georgia, serif" font-size="38" letter-spacing="5">${seed}</text>
    </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const mantras = ([
  {
    id: 'moon-mantra',
    title: { en: 'Moon Mantra', ru: 'Лунная мантра' },
    subtitle: { en: 'Soft voice rhythm · Calm', ru: 'Мягкий ритм голоса · Спокойствие' },
    description: {
      en: 'A gentle mantra bed for returning to your breath and softening the mind.',
      ru: 'Мягкая мантра, чтобы вернуться к дыханию и успокоить мысли.'
    },
    category: 'mantra',
    tags: ['calm', 'moon', 'evening'],
    access: 'free',
    duration: 180,
    cover: mantraCover('MOON MANTRA')
  }
] satisfies MantraDefinition[]);

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
    videoPath: '/assets/moon-garden/videos/level-0-empty-garden.mp4',
    subtitle: { en: 'Your quiet place is waiting for its first seed.', ru: 'Твоё тихое место ждёт первое семя.' }
  },
  {
    level: 1,
    minPlantedUpgrades: 1,
    title: { en: 'First Bloom', ru: 'Первый цветок' },
    path: '/assets/moon-garden/level-1-first-bloom.png',
    videoPath: '/assets/moon-garden/videos/level-1-first-bloom.mp4',
    subtitle: { en: 'The first bloom has opened.', ru: 'Первый цветок раскрылся.' }
  },
  {
    level: 2,
    minPlantedUpgrades: 2,
    title: { en: 'Lantern Glow', ru: 'Свет фонаря' },
    path: '/assets/moon-garden/level-2-lantern-glow.png',
    videoPath: '/assets/moon-garden/videos/level-2-lantern-glow.mp4',
    subtitle: { en: 'A warm light now guides the path.', ru: 'Тёплый свет теперь ведёт по тропе.' }
  },
  {
    level: 3,
    minPlantedUpgrades: 3,
    title: { en: 'Stone Path', ru: 'Каменная тропа' },
    path: '/assets/moon-garden/level-3-stone-path.png',
    videoPath: '/assets/moon-garden/videos/level-3-stone-path.mp4',
    subtitle: { en: 'Your path through calm is taking shape.', ru: 'Твой путь к спокойствию обретает форму.' }
  },
  {
    level: 4,
    minPlantedUpgrades: 4,
    title: { en: 'Twin Bloom', ru: 'Два цветка' },
    path: '/assets/moon-garden/level-4-twin-bloom.png',
    videoPath: '/assets/moon-garden/videos/level-4-twin-bloom.mp4',
    subtitle: { en: 'Your garden begins to bloom.', ru: 'Твой сад начинает расцветать.' }
  },
  {
    level: 5,
    minPlantedUpgrades: 5,
    title: { en: 'Moon Bridge', ru: 'Лунный мост' },
    path: '/assets/moon-garden/level-5-moon-bridge.png',
    videoPath: '/assets/moon-garden/videos/level-5-moon-bridge.mp4',
    subtitle: { en: 'A bridge appears across the moonlit water.', ru: 'Над лунной водой появляется мост.' }
  },
  {
    level: 6,
    minPlantedUpgrades: 6,
    title: { en: 'Reflection Garden', ru: 'Сад отражений' },
    path: '/assets/moon-garden/level-6-reflection-garden.png',
    videoPath: '/assets/moon-garden/videos/level-6-reflection-garden.mp4',
    subtitle: { en: 'Reflections deepen in your quiet place.', ru: 'Отражения становятся глубже в твоём тихом месте.' }
  },
  {
    level: 7,
    minPlantedUpgrades: 7,
    title: { en: 'Full Moon Garden', ru: 'Сад полной луны' },
    path: '/assets/moon-garden/level-7-full-moon-garden.png',
    videoPath: '/assets/moon-garden/videos/level-7-full-moon-garden.mp4',
    subtitle: { en: 'Your Moon Garden is flourishing.', ru: 'Твой Лунный сад расцветает.' }
  }
];

type GardenStage = typeof gardenStages[number];

const gardenCollections = [
  {
    id: 'classic-moon',
    title: { en: 'Classic Moon Garden', ru: 'Классический Лунный сад' },
    body: { en: 'Your current moonlit sanctuary.', ru: 'Твоё текущее лунное пространство.' },
    status: { en: 'Active', ru: 'Активно' }
  },
  {
    id: 'winter-stillness',
    title: { en: 'Winter Stillness', ru: 'Зимняя тишина' },
    body: { en: 'A quiet seasonal direction for your garden.', ru: 'Тихое сезонное направление для твоего сада.' },
    status: { en: 'Season concept', ru: 'Концепт сезона' }
  },
  {
    id: 'spring-bloom',
    title: { en: 'Spring Bloom', ru: 'Весенний цвет' },
    body: { en: 'A lighter collection inspired by gentle renewal.', ru: 'Светлая коллекция о мягком обновлении.' },
    status: { en: 'Season concept', ru: 'Концепт сезона' }
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

function createMantraAudioUrl(id: string) {
  const cached = mantraAudioCache.get(id);
  if (cached) return cached;

  const sampleRate = 22050;
  const seconds = 8;
  const totalSamples = sampleRate * seconds;
  const samples = new Float32Array(totalSamples);
  const notes = [196, 246.94, 293.66, 392];

  for (let index = 0; index < totalSamples; index += 1) {
    const t = index / sampleRate;
    const fade = Math.min(1, index / 1800, (totalSamples - index) / 1800);
    const note = notes[Math.floor((t / 2) % notes.length)];
    const breath = 0.55 + Math.sin(Math.PI * 2 * 0.125 * t) * 0.35;
    const tone =
      Math.sin(Math.PI * 2 * note * t) * 0.055 +
      Math.sin(Math.PI * 2 * note * 0.5 * t) * 0.045 +
      Math.sin(Math.PI * 2 * note * 1.5 * t) * 0.018;
    samples[index] = Math.max(-0.7, Math.min(0.7, tone * breath * fade));
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
  mantraAudioCache.set(id, url);
  return url;
}

const copy = {
  en: {
    tagline: 'AI Guided Calm Inside Telegram',
    language: 'Language',
    premium: 'Premium',
    free: 'Free',
    monthly: 'Monthly',
    lifetime: 'Lifetime',
    on: 'On',
    off: 'Off',
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
    back: 'Back',
    goodMorning: 'Good morning',
    goodAfternoon: 'Good afternoon',
    goodEvening: 'Good evening',
    feeling: 'How are you feeling today?',
    todayMeditation: "Today's Meditation",
    todayRecommendation: "Today's recommendation",
    statDay: 'day',
    statDays: 'days',
    statMin: 'min',
    statMood: 'Mood',
    statCheckins: 'Check-ins',
    statStreak: 'Streak',
    statEnergy: 'Energy',
    energyHigh: 'High',
    energyMedium: 'Medium',
    energyLow: 'Low',
    recommendedForYou: 'Recommended for You',
    forYourMood: 'For Your Mood',
    moreToExplore: 'More to Explore',
    viewAll: 'View all',
    exploreLibrary: 'Explore Library',
    openLibrary: 'Open Library',
    libraryTitle: 'Luna Library',
    meditationsTab: 'Meditations',
    breathingTab: 'Breathing',
    mantrasTab: 'Mantras',
    scenesTitle: 'Soundscapes',
    scenesHomeTitle: 'Sound',
    scenesHomeBody: 'Soft ambience while Luna is open.',
    scenesLibraryBody: 'Loopable ambience for sleep, breath, and focus.',
    soundscapeSelect: 'Choose sound',
    soundscapeActive: 'Sound on',
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
    moonMantraBody: 'A gentle mantra for returning to yourself.',
    mantrasEmpty: 'New Luna mantras will appear here as your library grows.',
    addHomeTitle: 'Add Luna to Home Screen',
    addHomeBody: 'Open your calm in one tap from Telegram.',
    addHomeAction: 'Add',
    addHomeDone: 'Luna is on your Home Screen.',
    addHomeUnsupported: 'Home Screen shortcut is not available on this device yet.',
    firstPracticeTitle: 'Your first calm practice is waiting.',
    firstPracticeBody: 'Published Luna practices will appear here automatically.',
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
    navLuna: 'Luna',
    navLibrary: 'Library',
    navSaved: 'Saved',
    navPremium: 'Premium',
    navProgress: 'Progress',
    navProfile: 'Profile',
    lunaPageTitle: 'Luna',
    lunaPageSubtitle: 'Your quiet companion',
    lunaPageBody: "Tell Luna how you're feeling, ask for a meditation recommendation, or simply write what's on your mind.",
    lunaPageStatus: 'Your quiet companion',
    lunaPageSoon: 'Open Luna whenever you need a quiet moment.',
    progressTitle: 'Your Progress',
    progressSubtitle: 'A calm view of what you have actually practiced.',
    progressStreak: 'Current streak',
    progressSessions: 'Meditation sessions',
    progressMinutes: 'Listening minutes',
    progressMoonGarden: 'Moon Garden',
    weeklyReflection: 'Weekly Reflection',
    viewWeeklyReflection: 'View weekly reflection',
    weeklyReflectionTitle: 'Weekly Reflection',
    weeklyReflectionBody: 'Your reflection will grow from real check-ins and practice data.',
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
    askLunaTitle: 'Ask Luna',
    askLunaBody: 'Ask for a recommendation, a calming thought, or support.',
    askLunaAction: 'Talk to Luna',
    askLunaSoon: 'Open Luna whenever you need a quiet moment.',
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
    premiumHeadline: 'A deeper Luna, whenever you need calm.',
    premiumBody: 'Unlock the full meditation library, premium breathwork, soundscapes, mantras, and gentle Moon Garden growth.',
    premiumLibrary: 'Premium Library',
    weeklyContent: 'Weekly Content',
    dailyStreak: 'Daily Streak',
    lockedPremium: '{title} is part of Luna Premium.',
    monthlyPremium: 'Monthly Premium',
    lifetimePremium: 'Lifetime Premium',
    unlimitedMeditations: 'Full meditation library',
    premiumBreathing: 'Longer breath practices',
    sleepAnxietyFocus: 'Sleep, anxiety, focus, and calm',
    dailyStreaks: 'Gentle progress and Moon Seeds',
    premiumForever: 'Lifetime Luna access',
    allFuturePractices: 'Future meditations and mantras',
    bestValue: 'Best long-term value',
    instantTelegramUnlock: 'Instant unlock with Telegram Stars',
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
    monthly: 'Месячный',
    lifetime: 'Навсегда',
    on: 'Вкл',
    off: 'Выкл',
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
    back: 'Назад',
    goodMorning: 'Доброе утро',
    goodAfternoon: 'Добрый день',
    goodEvening: 'Добрый вечер',
    feeling: 'Как ты себя чувствуешь сегодня?',
    todayMeditation: 'Медитация дня',
    todayRecommendation: 'Рекомендация на сегодня',
    statDay: 'день',
    statDays: 'дней',
    statMin: 'мин',
    statMood: 'Настроение',
    statCheckins: 'Чек-ины',
    statStreak: 'Серия',
    statEnergy: 'Энергия',
    energyHigh: 'Высокая',
    energyMedium: 'Средняя',
    energyLow: 'Низкая',
    recommendedForYou: 'Рекомендация для тебя',
    forYourMood: 'Под твоё настроение',
    moreToExplore: 'Ещё для практики',
    viewAll: 'Смотреть все',
    exploreLibrary: 'Открыть библиотеку',
    openLibrary: 'Открыть библиотеку',
    libraryTitle: 'Библиотека Luna',
    meditationsTab: 'Медитации',
    breathingTab: 'Дыхание',
    mantrasTab: 'Мантры',
    scenesTitle: 'Саундскейпы',
    scenesHomeTitle: 'Звук',
    scenesHomeBody: 'Мягкий фон, пока Luna открыта.',
    scenesLibraryBody: 'Зацикленные звуки для сна, дыхания и фокуса.',
    soundscapeSelect: 'Выбрать звук',
    soundscapeActive: 'Звук включён',
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
    moonMantraBody: 'Мягкая мантра, чтобы вернуться к себе.',
    mantrasEmpty: 'Новые мантры Luna появятся здесь по мере роста библиотеки.',
    addHomeTitle: 'Добавить Luna на экран',
    addHomeBody: 'Открывай спокойствие в один тап из Telegram.',
    addHomeAction: 'Добавить',
    addHomeDone: 'Luna уже на твоём экране.',
    addHomeUnsupported: 'Добавление на экран пока недоступно на этом устройстве.',
    firstPracticeTitle: 'Первая спокойная практика ждёт тебя.',
    firstPracticeBody: 'Опубликованные практики Luna появятся здесь автоматически.',
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
    navLuna: 'Luna',
    navLibrary: 'Библиотека',
    navSaved: 'Сохранённое',
    navPremium: 'Премиум',
    navProgress: 'Прогресс',
    navProfile: 'Профиль',
    lunaPageTitle: 'Luna',
    lunaPageSubtitle: 'Твой тихий компаньон',
    lunaPageBody: 'Расскажи Luna, как ты себя чувствуешь, попроси рекомендацию или просто напиши, что на душе.',
    lunaPageStatus: 'Твой тихий компаньон',
    lunaPageSoon: 'Открывай Luna, когда нужен тихий момент.',
    progressTitle: 'Твой прогресс',
    progressSubtitle: 'Спокойный взгляд на реальные практики.',
    progressStreak: 'Текущая серия',
    progressSessions: 'Медитации',
    progressMinutes: 'Минуты слушания',
    progressMoonGarden: 'Лунный сад',
    weeklyReflection: 'Недельная рефлексия',
    viewWeeklyReflection: 'Открыть рефлексию',
    weeklyReflectionTitle: 'Недельная рефлексия',
    weeklyReflectionBody: 'Рефлексия будет расти из реальных чек-инов и практик.',
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
    askLunaTitle: 'Спросить Luna',
    askLunaBody: 'Попроси рекомендацию, спокойную мысль или поддержку.',
    askLunaAction: 'Написать Luna',
    askLunaSoon: 'Открывай Luna, когда нужен тихий момент.',
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
    premiumHeadline: 'Больше Luna, когда тебе нужно спокойствие.',
    premiumBody: 'Открой полную библиотеку медитаций, премиальное дыхание, саундскейпы, мантры и мягкий рост Лунного сада.',
    premiumLibrary: 'Премиум-библиотека',
    weeklyContent: 'Новый контент каждую неделю',
    dailyStreak: 'Ежедневная серия',
    lockedPremium: '{title} входит в Luna Premium.',
    monthlyPremium: 'Месячный Premium',
    lifetimePremium: 'Lifetime Premium',
    unlimitedMeditations: 'Полная библиотека медитаций',
    premiumBreathing: 'Длинные дыхательные практики',
    sleepAnxietyFocus: 'Сон, тревога, фокус и спокойствие',
    dailyStreaks: 'Мягкий прогресс и лунные семена',
    premiumForever: 'Доступ Luna навсегда',
    allFuturePractices: 'Будущие медитации и мантры',
    bestValue: 'Лучшая долгосрочная ценность',
    instantTelegramUnlock: 'Мгновенно через Telegram Stars',
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

function minutesCountLabel(minutes: number, language: AppLanguage) {
  return `${minutes} ${language === 'en' ? 'min' : 'мин'}`;
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

function practiceDaysLabel(days: number, language: AppLanguage) {
  if (language === 'en') return days === 1 ? '1 day' : `${days} days`;
  const lastDigit = days % 10;
  const lastTwoDigits = days % 100;
  const word = lastDigit === 1 && lastTwoDigits !== 11
    ? 'день'
    : lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)
      ? 'дня'
      : 'дней';
  return `${days} ${word}`;
}

function thisWeekWithLunaInsight(profile: ProfileStats | null, wellness: WellnessSummary | null, history: PlaybackHistory[], language: AppLanguage) {
  const now = Date.now();
  const recentHistory = history.filter((item) => {
    const played = new Date(item.last_played);
    return !Number.isNaN(played.getTime()) && now - played.getTime() <= 7 * 24 * 60 * 60 * 1000;
  });
  const practiceDates = new Set(
    recentHistory.map((item) => new Date(item.last_played).toISOString().slice(0, 10))
  );
  if (profile?.lastPracticeDate) {
    const lastPractice = new Date(`${profile.lastPracticeDate}T12:00:00`);
    if (!Number.isNaN(lastPractice.getTime()) && now - lastPractice.getTime() <= 7 * 24 * 60 * 60 * 1000) {
      practiceDates.add(profile.lastPracticeDate);
    }
  }

  const fallbackMinutes = recentHistory.reduce((sum, item) => sum + Math.max(0, Math.round(Number(item.last_position ?? 0) / 60)), 0);
  const weeklyMinutes = profile?.weeklyPracticeMinutes ?? fallbackMinutes;
  const completedThisWeek = recentHistory.filter((item) => item.completed || Number(item.completion_percent ?? 0) >= 95).length;
  const categoryCounts = recentHistory.reduce<Record<string, number>>((map, item) => {
    const category = item.meditation?.category;
    if (!category) return map;
    map[category] = (map[category] ?? 0) + 1;
    return map;
  }, {});
  const mostUsedCategory = Object.entries(categoryCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
  const checkins = [...(wellness?.weeklyCheckins ?? [])].sort((left, right) => (left.local_date || '').localeCompare(right.local_date || ''));
  const latestMood = wellness?.todayCheckin?.mood ?? checkins[checkins.length - 1]?.mood ?? wellness?.mostCommonMood ?? null;
  const hasPractice = weeklyMinutes > 0 || practiceDates.size > 0 || completedThisWeek > 0;

  if (!hasPractice) {
    return language === 'en'
      ? ['You’re just beginning.', 'Complete one practice and Luna will have more to reflect on.']
      : ['Ты только начинаешь.', 'Заверши одну практику, и Luna сможет мягче отразить твою неделю.'];
  }

  const lines = [
    language === 'en'
      ? `${minutesCountLabel(weeklyMinutes, language)} across ${practiceDaysLabel(practiceDates.size || 1, language)} became part of your week.`
      : `${minutesCountLabel(weeklyMinutes, language)} за ${practiceDaysLabel(practiceDates.size || 1, language)} стали частью твоей недели.`
  ];

  if (completedThisWeek > 0) {
    lines.push(language === 'en'
      ? `${completedThisWeek === 1 ? 'One completed session' : `${completedThisWeek} completed sessions`} gave the rhythm a little shape.`
      : `${completedThisWeek === 1 ? 'Одна завершённая сессия' : `${completedThisWeek} завершённые сессии`} мягко поддержали ритм.`);
  } else if (mostUsedCategory) {
    lines.push(language === 'en'
      ? `${translateCategory(mostUsedCategory, language)} quietly led your focus.`
      : `${translateCategory(mostUsedCategory, language)} мягко вело твой фокус.`);
  } else if (latestMood) {
    lines.push(language === 'en'
      ? `Your latest check-in felt ${translateMoodLabel(latestMood, language)}.`
      : `Последний чек-ин: ${translateMoodLabel(latestMood, language)}.`);
  }

  lines.push(language === 'en'
    ? (profile?.currentStreak ? 'Come back tomorrow and keep the rhythm soft.' : 'One quiet return is enough for tomorrow.')
    : (profile?.currentStreak ? 'Вернись завтра и сохрани мягкий ритм.' : 'Одного тихого возвращения завтра достаточно.'));

  return lines.slice(0, 3);
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

function homeMoodLabel(mood: MoodChip, language: AppLanguage) {
  const labels: Record<MoodChip, Record<AppLanguage, string>> = {
    Focus: { en: 'Great', ru: 'Отлично' },
    Energy: { en: 'Great', ru: 'Отлично' },
    Calm: { en: 'Good', ru: 'Хорошо' },
    Breath: { en: 'Meh', ru: 'Норм' },
    Anxiety: { en: 'Anxious', ru: 'Тревожно' },
    Sleep: { en: 'Tired', ru: 'Устал' }
  };
  return labels[mood][language];
}

function homeEnergyTone(mood: MoodChip): 'high' | 'medium' | 'low' {
  if (mood === 'Focus' || mood === 'Energy' || mood === 'Calm') return 'high';
  if (mood === 'Breath') return 'medium';
  return 'low';
}

function homeEnergyLabel(mood: MoodChip, language: AppLanguage) {
  const tone = homeEnergyTone(mood);
  if (tone === 'high') return copy[language].energyHigh;
  if (tone === 'medium') return copy[language].energyMedium;
  return copy[language].energyLow;
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

function launchSearchParams() {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;

  if (hash.includes('=')) {
    const hashParams = new URLSearchParams(hash.startsWith('?') ? hash.slice(1) : hash);
    hashParams.forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });
  }

  return params;
}

function miniAppStartParam() {
  const search = launchSearchParams();
  // BotFather Main Mini App should point to the deployed frontend URL. Telegram
  // then delivers startapp payloads through initDataUnsafe.start_param or query params.
  return (
    window.Telegram?.WebApp?.initDataUnsafe?.start_param ||
    search.get('tgWebAppStartParam') ||
    search.get('startapp') ||
    ''
  );
}

function pageFromStartParam(startParam: string): Page {
  const normalized = startParam.trim().toLowerCase();
  if (normalized === 'luna') return 'luna';
  if (normalized === 'library') return 'library';
  if (normalized === 'saved') return 'library';
  if (normalized === 'progress') return 'progress';
  if (normalized === 'premium') return 'pricing';
  if (normalized === 'profile') return 'profile';
  if (normalized === 'moon-garden') return 'moonGarden';
  return 'home';
}

function initialPageFromLaunch(startParam: string): Page {
  if (window.location.pathname === '/admin' || window.location.hash === '#admin') return 'admin';
  return pageFromStartParam(startParam);
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
  const launchStartParam = miniAppStartParam();
  const sceneAudioRef = useRef<HTMLAudioElement | null>(null);
  const moonGardenAudioRef = useRef<HTMLAudioElement | null>(null);
  const sceneListenSecondsRef = useRef(0);
  const sceneMoonSeedAwardedRef = useRef(false);
  const [initialLibraryCache] = useState(() => readLibraryCache());
  const [language, setLanguage] = useState<AppLanguage>(() => initialLanguage(user));
  const [page, setPage] = useState<Page>(() => initialPageFromLaunch(launchStartParam));
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
  const [profileNestedActive, setProfileNestedActive] = useState(false);
  const [selectedMeditation, setSelectedMeditation] = useState<Meditation | null>(null);
  const [selectedScene, setSelectedScene] = useState<SceneDefinition | null>(null);
  const [selectedMantra, setSelectedMantra] = useState<MantraDefinition | null>(null);
  const [scenePlaying, setScenePlaying] = useState(false);
  const [sceneVolume, setSceneVolume] = useState(0.35);
  const [sceneAudioUrl, setSceneAudioUrl] = useState('');
  const [homeScreenMessage, setHomeScreenMessage] = useState('');
  const [homeScreenStatus, setHomeScreenStatus] = useState<'idle' | 'added' | 'unsupported'>('idle');
  const [assistantMessage, setAssistantMessage] = useState('');
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
  const [pendingMeditationId, setPendingMeditationId] = useState(() => meditationIdFromStartParam(launchStartParam));
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
    try {
      telegram?.checkHomeScreenStatus?.((status) => {
        if (status === 'added') {
          setHomeScreenStatus('added');
          setHomeScreenMessage(copy[language].addHomeDone);
        } else if (status === 'unsupported') {
          setHomeScreenStatus('unsupported');
        }
      });
    } catch {
      setHomeScreenStatus('unsupported');
    }
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
      const matchesCategory = category === 'all' ||
        (category === 'saved' ? Boolean(meditation.favorite) : category === 'short' ? meditation.duration <= 600 : meditation.category === category);
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
    if (page !== 'profile') setProfileNestedActive(false);
  }, [page]);

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

  const selectHomeSoundscape = (scene: SceneDefinition) => {
    telegram?.HapticFeedback?.impactOccurred('light');
    if (scene.access === 'premium' && !access.hasPremium) {
      setPaymentMessage(copy[language].scenePremiumLocked);
      setPage('pricing');
      return;
    }

    const nextUrl = createSceneAudioUrl(scene.sound);
    const audio = sceneAudioRef.current;
    if (selectedScene?.id !== scene.id) {
      audio?.pause();
      setScenePlaying(false);
      sceneListenSecondsRef.current = 0;
      sceneMoonSeedAwardedRef.current = false;
      setSceneAudioUrl(nextUrl);
      if (audio) {
        audio.src = nextUrl;
        audio.loop = true;
        audio.volume = sceneVolume;
      }
    }
    setSelectedScene(scene);
  };

  const toggleScenePlayback = async () => {
    const audio = sceneAudioRef.current;
    const activeScene = selectedScene ?? scenes[0];
    if (!audio || !activeScene) return;

    if (!selectedScene) {
      setSelectedScene(activeScene);
    }

    if (!sceneAudioUrl) {
      const nextUrl = createSceneAudioUrl(activeScene.sound);
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
    setPage('home');
  };

  const stopSoundscape = () => {
    sceneAudioRef.current?.pause();
    if (sceneAudioRef.current) {
      sceneAudioRef.current.removeAttribute('src');
      sceneAudioRef.current.load();
    }
    setScenePlaying(false);
    setSelectedScene(null);
    setSceneAudioUrl('');
    sceneListenSecondsRef.current = 0;
    sceneMoonSeedAwardedRef.current = false;
  };

  const openMantra = (mantra: MantraDefinition) => {
    telegram?.HapticFeedback?.impactOccurred('light');
    if (mantra.access === 'premium' && !access.hasPremium) {
      setPaymentMessage(copy[language].lockedPremium.replace('{title}', mantra.title[language]));
      setPage('pricing');
      return;
    }
    sceneAudioRef.current?.pause();
    setScenePlaying(false);
    moonGardenAudioRef.current?.pause();
    setMoonGardenAmbiencePlaying(false);
    setSelectedMantra(mantra);
    setPage('mantraPlayer');
  };

  const addLunaToHomeScreen = () => {
    const storageKey = 'luna.addHome.prompted.v1';
    window.localStorage.setItem(storageKey, new Date().toISOString());

    if (homeScreenStatus === 'added') {
      setHomeScreenMessage(copy[language].addHomeDone);
      return;
    }

    if (telegram?.checkHomeScreenStatus) {
      try {
        telegram.checkHomeScreenStatus((status) => {
          if (status === 'added') {
            setHomeScreenStatus('added');
            setHomeScreenMessage(copy[language].addHomeDone);
            return;
          }
          if (status === 'unsupported' || !telegram.addToHomeScreen) {
            setHomeScreenStatus('unsupported');
            setHomeScreenMessage(copy[language].addHomeUnsupported);
            return;
          }
          telegram.addToHomeScreen();
          setHomeScreenStatus('added');
          setHomeScreenMessage(copy[language].addHomeDone);
        });
      } catch {
        setHomeScreenStatus('unsupported');
        setHomeScreenMessage(copy[language].addHomeUnsupported);
      }
      return;
    }

    if (telegram?.addToHomeScreen) {
      telegram.addToHomeScreen();
      setHomeScreenStatus('added');
      setHomeScreenMessage(copy[language].addHomeDone);
      return;
    }

    setHomeScreenStatus('unsupported');
    setHomeScreenMessage(copy[language].addHomeUnsupported);
  };

  const openLunaAssistant = () => {
    setAssistantMessage('');
    setPage('luna');
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
    await refreshAccount();
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
    <main className={`min-h-screen overflow-hidden bg-night text-cream ${page === 'home' ? 'home-v2-shell' : ''}`}>
      <div className="fixed inset-0 luna-bg" />
      <section className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-[calc(112px+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top,0px)+14px)]">
        {page !== 'luna' && <Header plan={access.plan} streak={profile?.currentStreak ?? 0} language={language} onLanguageChange={changeLanguage} compact={page === 'home'} />}

        {page === 'home' && (
          <HomeV2
            firstName={user.first_name ?? 'friend'}
            greeting={dayGreeting(language)}
            mood={mood}
            moods={moods}
            setMood={selectMood}
            checkinLine={wellness?.todayCheckin ? copy[language].checkinSaved : moodMessage(mood, wellness, language)}
            checkinMeta={wellness?.weeklyCheckinCount ? `${translateMoodLabel(wellness.mostCommonMoodLabel, language)} · ${wellness.weeklyCheckinCount}/7 ${copy[language].checkins}` : undefined}
            daily={dailyMeditation}
            heroLabel={copy[language][heroLabelKey]}
            continueListening={homeSections.continueListening}
            recentlyPlayed={homeSections.recentlyPlayed}
            explore={homeSections.explore}
            loading={libraryLoading}
            onOpen={openMeditation}
            onLibrary={() => setPage('library')}
            scenes={scenes}
            selectedScene={selectedScene}
            scenePlaying={scenePlaying}
            hasPremium={access.hasPremium}
            onSoundToggle={() => void toggleScenePlayback()}
            onSoundSelect={selectHomeSoundscape}
            onSoundOpen={() => selectedScene ? setPage('scenePlayer') : selectHomeSoundscape(scenes[0])}
            onBreath={openBreathCircle}
            onAskLuna={openLunaAssistant}
            onAddHome={addLunaToHomeScreen}
            homeScreenMessage={homeScreenMessage}
            homeScreenStatus={homeScreenStatus}
            assistantMessage={assistantMessage}
            stats={[
              { label: copy[language].statStreak, value: profile ? String(profile.currentStreak ?? 0) : '—', secondary: profile ? ((profile.currentStreak ?? 0) === 1 ? copy[language].statDay : copy[language].statDays) : undefined, kind: 'streak' },
              { label: copy[language].statCheckins, value: wellness ? `${wellness.weeklyCheckinCount ?? 0}/7` : '—/7', kind: 'checkins' },
              { label: copy[language].statMood, value: homeMoodLabel(mood, language), kind: 'mood' },
              { label: copy[language].statEnergy, value: homeEnergyLabel(mood, language), kind: 'energy', tone: homeEnergyTone(mood) }
            ]}
            labels={{
              brandMeta: copy[language].tagline,
              feeling: copy[language].feeling,
              todayRecommendation: copy[language].todayRecommendation,
              checkinSaved: copy[language].checkinSaved,
              checkins: copy[language].checkins,
              moreToExplore: copy[language].moreToExplore,
              viewAll: copy[language].viewAll,
              continueListening: copy[language].continueListening,
              openLibrary: copy[language].openLibrary,
              soundTitle: copy[language].scenesHomeTitle,
              soundActive: copy[language].soundscapeActive,
              soundSelect: copy[language].soundscapeSelect,
              breathKicker: copy[language].categoryBreath,
              breathTitle: copy[language].breathCircle,
              breathBody: copy[language].breathCircleSubtitle,
              askLunaTitle: copy[language].askLunaTitle,
              askLunaBody: copy[language].askLunaBody,
              askLunaAction: copy[language].askLunaAction,
              addHomeTitle: copy[language].addHomeTitle,
              addHomeBody: copy[language].addHomeBody,
              addHomeAction: copy[language].addHomeAction,
              preparingCalm: copy[language].preparingCalm,
              firstPracticeTitle: copy[language].firstPracticeTitle,
              firstPracticeBody: copy[language].firstPracticeBody,
              premium: copy[language].premium,
              free: copy[language].free,
              begin: copy[language].begin,
              resume: copy[language].resume
            }}
            language={language}
            meditationView={(meditation) => getLocalizedMeditation(meditation, language)}
            categoryLabel={(value) => translateCategory(value, language)}
            moodLabel={(value) => translateCategory(value, language)}
            durationLabel={formatTime}
          />
        )}

        {page === 'luna' && (
          <LunaPage
            firstName={user.first_name ?? 'friend'}
            language={language}
            meditations={decoratedMeditations}
            hasPremium={access.hasPremium}
            initData={initData}
            onOpenMeditation={openMeditation}
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
            mantras={mantras}
            hasPremium={access.hasPremium}
            loading={libraryLoading}
            onOpen={openMeditation}
            onBreath={openBreathCircle}
            onOpenMantra={openMantra}
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

        {page === 'progress' && (
          <ProgressPage
            profile={profile}
            wellness={wellness}
            history={history}
            hasPremium={access.hasPremium}
            language={language}
            onMoonGarden={() => setPage('moonGarden')}
          />
        )}

        {page === 'profile' && (
          <ProfilePage
            profile={profile}
            access={access}
            firstName={user.first_name ?? 'Luna'}
            username={user.username}
            showAdminButton={adminStatus === 'allowed'}
            onLuna={() => setPage('luna')}
            onSubscription={() => setPage('pricing')}
            onAdmin={() => {
              window.history.pushState({}, '', '/admin');
              setPage('admin');
            }}
            onRestore={refreshAccount}
            onAddHome={addLunaToHomeScreen}
            onLanguageChange={changeLanguage}
            onProfileUpdate={setProfile}
            onNestedChange={setProfileNestedActive}
            homeScreenMessage={homeScreenMessage}
            initData={initData}
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
            onProgress={() => setPage('progress')}
            onPlaybackStart={pauseMoonGardenAmbience}
            onContinue={() => {
              if (nextMeditation && nextMeditation.id !== selectedMeditation.id) openMeditation(nextMeditation);
              else setPage('library');
            }}
            language={language}
          />
        )}

        {page === 'mantraPlayer' && selectedMantra && (
          <MantraPlayerPage
            mantra={selectedMantra}
            onClose={() => setPage('library')}
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
        {selectedScene && page !== 'home' && page !== 'scenePlayer' && page !== 'admin' && (
          <SceneMiniPlayer
            scene={selectedScene}
            playing={scenePlaying}
            volume={sceneVolume}
            onToggle={() => void toggleScenePlayback()}
            onOpen={() => setPage('scenePlayer')}
            onClose={stopSoundscape}
            onVolume={setSceneVolume}
            language={language}
          />
        )}
        {page !== 'admin' && !(page === 'profile' && profileNestedActive) && (
          <V2BottomNav
            active={page}
            onChange={setPage}
            labels={{
              home: copy[language].navHome,
              luna: copy[language].navLuna,
              library: copy[language].navLibrary,
              progress: copy[language].navProgress,
              profile: copy[language].navProfile
            }}
          />
        )}
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
  compact?: boolean;
}) {
  return (
    <div className="mb-2 flex items-center justify-between px-1 pt-0.5">
      <div className="flex items-center gap-2">
        <MoonMark className="h-6 w-6 shrink-0 opacity-70" />
        <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cream/48">Luna Meditation</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="max-w-[112px] truncate rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] text-cream/70 backdrop-blur-md">
          {streak > 0 ? streakLabel(streak, language) : planLabel(plan, language)}
        </div>
        <div className="flex rounded-full border border-white/10 bg-white/[0.06] p-0.5 text-[9px] font-semibold text-lavender backdrop-blur-md" aria-label={copy[language].language}>
          {(['en', 'ru'] as const).map((item) => (
            <button
              key={item}
              onClick={() => onLanguageChange(item)}
              className={`rounded-full px-1.5 py-0.5 transition ${language === item ? 'luna-chip-active' : 'text-lavender/75'}`}
            >
              {item.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
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
  mantras: MantraDefinition[];
  hasPremium: boolean;
  loading: boolean;
  onOpen: (meditation: Meditation) => void;
  onBreath: () => void;
  onOpenMantra: (mantra: MantraDefinition) => void;
  onFavorite: (meditation: Meditation) => void;
  onUnlock: () => void;
  language: AppLanguage;
}) {
  const t = copy[props.language];
  const filteredMantras = props.mantras.filter((mantra) =>
    [mantra.title[props.language], mantra.subtitle[props.language], mantra.category, ...mantra.tags].join(' ').toLowerCase().includes(props.query.toLowerCase())
  );
  return (
    <div className="luna-page space-y-3 pb-6">
      <div className="flex items-end justify-between gap-4">
        <PageTitle title={t.libraryTitle} />
        <span className="rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[10px] text-lavender">{props.meditations.length}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 backdrop-blur-md">
        <button onClick={() => props.setMode('meditations')} className={`rounded-full px-2.5 py-2 text-xs font-semibold transition ${props.mode === 'meditations' ? 'border border-gold/25 bg-cream/12 text-cream shadow-glow' : 'text-lavender/80'}`}>
          {t.meditationsTab}
        </button>
        <button onClick={() => props.setMode('breathing')} className={`rounded-full px-2.5 py-2 text-xs font-semibold transition ${props.mode === 'breathing' ? 'border border-gold/25 bg-cream/12 text-cream shadow-glow' : 'text-lavender/80'}`}>
          {t.breathingTab}
        </button>
        <button onClick={() => props.setMode('mantras')} className={`rounded-full px-2.5 py-2 text-xs font-semibold transition ${props.mode === 'mantras' ? 'border border-gold/25 bg-cream/12 text-cream shadow-glow' : 'text-lavender/80'}`}>
          {t.mantrasTab}
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.04] px-3.5 py-2.5 backdrop-blur-md">
        <Search size={16} className="text-lavender/80" />
        <input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder={t.searchByTitle} className="w-full bg-transparent text-sm outline-none placeholder:text-cream/45" />
      </div>
      {props.mode === 'meditations' ? (
        <>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 luna-scrollbar-none">
            <FilterPill active={props.category === 'all'} onClick={() => props.setCategory('all')} label={t.all} />
            <FilterPill active={props.category === 'saved'} onClick={() => props.setCategory('saved')} label={t.navSaved} />
            <FilterPill active={props.category === 'short'} onClick={() => props.setCategory('short')} label={t.short} />
            {props.categories.map((item) => (
              <FilterPill key={item.slug} active={props.category === item.slug} onClick={() => props.setCategory(item.slug)} label={translateCategory(item.slug || item.name, props.language)} />
            ))}
          </div>
          {props.loading && !props.meditations.length ? (
            <div className="space-y-1">
              {[0, 1, 2].map((item) => <MeditationCardSkeleton key={item} />)}
            </div>
          ) : props.meditations.length ? (
            <section className="space-y-0.5">
              {props.meditations.map((meditation, index) => (
                <MeditationCard
                  key={meditation.id}
                  meditation={meditation}
                  locked={meditation.premium && !props.hasPremium}
                  showPopular={index < 2 && meditation.play_count >= 20}
                  onOpen={props.onOpen}
                  onFavorite={props.onFavorite}
                  onUnlock={props.onUnlock}
                  language={props.language}
                />
              ))}
            </section>
          ) : (
            <EmptyState title={t.noMeditations} body={t.noMeditationsBody} />
          )}
        </>
      ) : props.mode === 'breathing' ? (
        <section className="space-y-3">
          <button onClick={props.onBreath} className="relative w-full overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_88%_12%,rgba(212,175,55,.16),transparent_32%),linear-gradient(145deg,rgba(26,36,78,.44),rgba(7,12,30,.62))] p-4 text-left shadow-glow">
            <div className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-gold/25 bg-gold/10 text-gold">
              <Sparkles size={19} />
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold">{t.breathingTab}</p>
            <h3 className="mt-1 font-serif text-[24px] leading-tight">{t.breathCircle}</h3>
            <p className="mt-2 max-w-[250px] text-sm leading-5 text-cream/75">{t.breathCircleSubtitle}</p>
            <p className="mt-3 text-[11px] text-lavender">1 / 3 / 5 min</p>
          </button>
        </section>
      ) : filteredMantras.length ? (
        <section className="space-y-0.5">
          {filteredMantras.map((mantra) => (
            <MantraCard key={mantra.id} mantra={mantra} locked={mantra.access === 'premium' && !props.hasPremium} onOpen={props.onOpenMantra} language={props.language} />
          ))}
        </section>
      ) : (
        <EmptyState title={t.mantrasEmpty} body={t.moonMantraBody} />
      )}
    </div>
  );
}

function MeditationCardSkeleton() {
  return (
    <article className="animate-pulse border-b border-white/10 py-1.5">
      <div className="grid grid-cols-[80px_minmax(0,1fr)_38px] items-center gap-3">
        <div className="h-20 w-20 rounded-[17px] bg-cream/10" />
        <div className="min-w-0 flex-1">
          <div className="h-4 w-36 rounded-full bg-cream/15" />
          <div className="mt-2 h-3 w-24 rounded-full bg-cream/10" />
          <div className="mt-2 h-3 w-full rounded-full bg-cream/10" />
        </div>
        <div className="h-[38px] w-[38px] rounded-full bg-cream/10" />
      </div>
    </article>
  );
}

function FilterPill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${active ? 'border-gold/30 bg-gold/12 text-cream shadow-glow' : 'border-white/10 bg-white/[0.035] text-lavender/82'}`}>
      {label}
    </button>
  );
}

function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="luna-page-title">
      <h2 className="luna-editorial-title text-[34px] leading-none">{title}</h2>
      {subtitle ? <p className="mt-2 max-w-[310px] text-sm leading-5 text-lavender">{subtitle}</p> : null}
    </div>
  );
}

function LunaPage({
  firstName,
  language,
  meditations,
  hasPremium,
  initData,
  onOpenMeditation
}: {
  firstName: string;
  language: AppLanguage;
  meditations: Meditation[];
  hasPremium: boolean;
  initData?: string;
  onOpenMeditation: (meditation: Meditation) => void;
}) {
  return (
    <LunaChat
      firstName={firstName}
      language={language}
      meditations={meditations}
      hasPremium={hasPremium}
      initData={initData}
      onOpenMeditation={onOpenMeditation}
    />
  );
}
function ProgressPage({
  profile,
  wellness,
  history,
  hasPremium,
  language,
  onMoonGarden
}: {
  profile: ProfileStats | null;
  wellness: WellnessSummary | null;
  history: PlaybackHistory[];
  hasPremium: boolean;
  language: AppLanguage;
  onMoonGarden: () => void;
}) {
  const currentMood = wellness?.mostCommonMoodLabel ? translateMoodLabel(wellness.mostCommonMoodLabel, language) : copy[language].notEnoughData;
  const planted = plantedGardenElements(profile);
  const plantedCount = planted.length;
  const seeds = availableMoonSeeds(profile);
  const stage = getCurrentGardenStage(plantedCount);
  const streak = profile?.currentStreak ?? 0;
  const weeklyInsightLines = thisWeekWithLunaInsight(profile, wellness, history, language);
  const weeklyProgress = buildWeeklyProgress(history, profile, hasPremium, language);
  const weeklyStats = profile?.weeklyStats;
  const lifetimeStats = profile?.lifetimeStats;
  const quickStats = [
    {
      label: language === 'en' ? 'This Week' : 'Эта неделя',
      value: minutesCountLabel(weeklyStats?.listeningMinutes ?? profile?.weeklyPracticeMinutes ?? 0, language),
      body: language === 'en' ? 'Listening' : 'Практика',
      tone: 'strong'
    },
    {
      label: language === 'en' ? 'Sessions' : 'Сессии',
      value: String(weeklyStats?.completedSessions ?? 0),
      body: language === 'en' ? 'Completed this week' : 'На этой неделе',
      tone: 'gold'
    },
    {
      label: language === 'en' ? 'Practice Days' : 'Дни практики',
      value: String(lifetimeStats?.practiceDays ?? 0),
      body: language === 'en' ? 'Lifetime' : 'За всё время',
      tone: 'soft'
    },
    {
      label: language === 'en' ? 'Longest Rhythm' : 'Лучший ритм',
      value: String(lifetimeStats?.longestStreak ?? profile?.longestStreak ?? 0),
      body: language === 'en' ? 'Days' : 'Дней',
      tone: 'soft'
    }
  ];

  return (
    <div className="luna-page luna-child-page space-y-4 pb-[calc(104px+env(safe-area-inset-bottom))]">
      <div>
        <h2 className="max-w-[280px] text-[28px] font-semibold tracking-[-0.04em] text-cream">{copy[language].progressTitle}</h2>
        <p className="mt-1 max-w-[310px] text-sm leading-5 text-lavender/78">{language === 'en' ? 'Your practice story, one quiet return at a time.' : 'История твоей практики — одно мягкое возвращение за раз.'}</p>
      </div>

      <HeroProgressCard streak={streak} weeklyProgress={weeklyProgress} language={language} />

      <section className="grid grid-cols-2 gap-3">
        {quickStats.map((item) => (
          <ProgressMetricCard key={item.label} {...item} />
        ))}
      </section>

      <MoodTrendCard trend={profile?.moodTrend ?? []} currentMood={currentMood} language={language} />

      <WeeklySummaryCard lines={weeklyInsightLines} stats={weeklyStats} language={language} />

      <GardenRewardCard stage={stage} plantedCount={plantedCount} seeds={seeds} language={language} onOpen={onMoonGarden} />

      <AchievementsSection profile={profile} language={language} />
    </div>
  );
}

function ProgressMetricCard({
  label,
  value,
  body,
  tone
}: {
  label: string;
  value: string;
  body: string;
  tone: string;
}) {
  const accent = tone === 'gold'
    ? 'from-gold/18 via-white/[0.045] to-white/[0.025]'
    : tone === 'strong'
      ? 'from-lavender/18 via-white/[0.05] to-white/[0.025]'
      : 'from-white/[0.07] via-white/[0.04] to-white/[0.02]';

  return (
    <article className={`luna-progress-enter relative overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br ${accent} p-3.5 shadow-glow backdrop-blur`}>
      <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-gold/10 blur-2xl" />
      <p className="relative text-[11px] leading-4 text-lavender">{label}</p>
      <p className="relative mt-2.5 truncate text-2xl font-semibold tracking-[-0.04em] text-cream">{value}</p>
      <p className="relative mt-1 text-[11px] leading-4 text-cream/58">{body}</p>
    </article>
  );
}

type WeeklyDayState = 'completed' | 'current' | 'missed' | 'future' | 'freeze_used' | 'premium_freeze';
type WeeklyProgressDay = {
  key: string;
  label: string;
  shortLabel: string;
  state: WeeklyDayState;
  minutes: number;
};
type WeeklyProgressModel = {
  days: WeeklyProgressDay[];
  freezeCount: number;
  maxFreezes: number;
  freezeUsedThisWeek: boolean;
  cleanWeek: boolean;
};

function buildWeeklyProgress(history: PlaybackHistory[], profile: ProfileStats | null, hasPremium: boolean, language: AppLanguage): WeeklyProgressModel {
  const maxFreezes = Math.max(1, Number(profile?.freezeMax ?? (hasPremium ? 3 : 1)));
  if (profile?.currentWeek?.days?.length === 7) {
    const days = profile.currentWeek.days.map((day) => {
      const date = new Date(`${day.key}T12:00:00`);
      return {
        key: day.key,
        label: date.toLocaleDateString(language === 'en' ? 'en-US' : 'ru-RU', { weekday: 'long' }),
        shortLabel: date.toLocaleDateString(language === 'en' ? 'en-US' : 'ru-RU', { weekday: 'short' }).slice(0, 3),
        state: day.state,
        minutes: day.minutes
      };
    });
    return {
      days,
      freezeCount: Math.min(maxFreezes, Math.max(0, Number(profile.freezeCount ?? maxFreezes))),
      maxFreezes,
      freezeUsedThisWeek: days.some((day) => day.state === 'freeze_used' || day.state === 'premium_freeze'),
      cleanWeek: profile.currentWeek.completedDays >= 7
    };
  }

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const monday = new Date(today);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - ((day + 6) % 7));
  const activityByDate = history.reduce<Record<string, number>>((map, item) => {
    const played = new Date(item.last_played);
    if (Number.isNaN(played.getTime())) return map;
    const key = played.toISOString().slice(0, 10);
    map[key] = (map[key] ?? 0) + Math.max(1, Math.round(Number(item.last_position ?? 0) / 60));
    return map;
  }, {});
  if (profile?.lastPracticeDate && !activityByDate[profile.lastPracticeDate]) {
    activityByDate[profile.lastPracticeDate] = 1;
  }

  const rawDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    const minutes = activityByDate[key] ?? 0;
    const isFuture = key > todayKey;
    const isToday = key === todayKey;
    return {
      key,
      label: date.toLocaleDateString(language === 'en' ? 'en-US' : 'ru-RU', { weekday: 'long' }),
      shortLabel: date.toLocaleDateString(language === 'en' ? 'en-US' : 'ru-RU', { weekday: 'short' }).slice(0, 3),
      state: minutes > 0 ? 'completed' as WeeklyDayState : isFuture ? 'future' as WeeklyDayState : isToday ? 'current' as WeeklyDayState : 'missed' as WeeklyDayState,
      minutes
    };
  });

  const freezeCount = Math.min(maxFreezes, Math.max(0, Number(profile?.freezeCount ?? maxFreezes)));
  const days = rawDays;
  const cleanWeek = rawDays.filter((item) => item.key <= todayKey).every((item) => item.minutes > 0);
  return { days, freezeCount, maxFreezes, freezeUsedThisWeek: false, cleanWeek };
}

function HeroProgressCard({ streak, weeklyProgress, language }: { streak: number; weeklyProgress: WeeklyProgressModel; language: AppLanguage }) {
  return (
    <section className="hero-progress-card luna-progress-enter">
      <img src="/images/progress/progress-bg-01.webp" alt="" className="hero-progress-bg" loading="lazy" />
      <div className="hero-progress-overlay" />
      <div className="relative z-10 flex min-h-[260px] flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="hero-rhythm-lockup">
            <p className="text-xs uppercase tracking-[0.18em] text-gold/92">{language === 'en' ? 'Current Rhythm' : 'Текущий ритм'}</p>
            <div className="mt-3 flex items-end gap-3">
              <strong>{streak}</strong>
              <span>{language === 'en' ? 'Day Streak' : streak === 1 ? 'день подряд' : 'дней подряд'}</span>
            </div>
            <p className="mt-2 text-sm text-cream/76">{language === 'en' ? 'Keep your rhythm alive.' : 'Сохраняй свой мягкий ритм.'}</p>
          </div>
          <div className="hero-moon-halo" aria-hidden="true" />
        </div>

        <div>
          <FreezeIndicator model={weeklyProgress} language={language} />
          <WeeklyTracker days={weeklyProgress.days} language={language} />
        </div>
      </div>
    </section>
  );
}

function FreezeIndicator({ model, language }: { model: WeeklyProgressModel; language: AppLanguage }) {
  return (
    <div className="freeze-indicator">
      <span aria-hidden="true">❄</span>
      <span>{language === 'en' ? 'Freeze' : 'Заморозка'}</span>
      <strong>{model.freezeCount} / {model.maxFreezes}</strong>
      <em>{model.freezeUsedThisWeek ? (language === 'en' ? 'Rhythm Protected' : 'Ритм защищён') : (language === 'en' ? 'Ready' : 'Готово')}</em>
    </div>
  );
}

function WeeklyTracker({ days, language }: { days: WeeklyProgressDay[]; language: AppLanguage }) {
  return (
    <div className="weekly-tracker" aria-label={language === 'en' ? 'Weekly tracker' : 'Недельный трекер'}>
      {days.map((day) => (
        <div key={day.key} className="weekly-day">
          <span className="weekly-day-label">{day.shortLabel}</span>
          <span className={`weekly-day-mark weekly-day-${day.state}`} title={`${day.label}: ${day.state}`}>
            {day.state === 'completed' ? '✓' : day.state === 'current' ? '•' : day.state === 'freeze_used' || day.state === 'premium_freeze' ? '❄' : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

function MoodJourneyEmpty({ language }: { language: AppLanguage }) {
  return (
    <section className="mood-journey-card luna-progress-enter">
      <p className="text-xs uppercase tracking-[0.16em] text-gold">{language === 'en' ? 'Mood Journey' : 'Путь настроения'}</p>
      <p className="mt-2 text-sm leading-5 text-lavender">
        {language === 'en' ? 'Complete more check-ins to see how your state changes over time.' : 'Сделай ещё несколько чек-инов, чтобы увидеть изменения состояния.'}
      </p>
    </section>
  );
}

function moodTrendIcon(mood: DailyCheckin['mood'] | null | undefined) {
  switch (mood) {
    case 'calm':
      return '😌';
    case 'focused':
      return '😊';
    case 'tired':
      return '😴';
    case 'anxious':
      return '😰';
    case 'stressed':
      return '😔';
    case 'low_energy':
      return '😐';
    default:
      return '·';
  }
}

function MoodTrendCard({ trend, currentMood, language }: { trend: ProfileStats['moodTrend']; currentMood: string; language: AppLanguage }) {
  const items = trend?.length ? trend : [];
  if (!items.some((item) => item.mood)) return <MoodJourneyEmpty language={language} />;

  return (
    <section className="mood-journey-card luna-progress-enter">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.16em] text-gold">{language === 'en' ? 'Mood Journey' : 'Путь настроения'}</p>
        <span className="text-[11px] text-lavender/64">{currentMood}</span>
      </div>
      <div className="mood-trend-row">
        {items.map((item) => {
          const date = new Date(`${item.key}T12:00:00`);
          const label = date.toLocaleDateString(language === 'en' ? 'en-US' : 'ru-RU', { weekday: 'short' }).slice(0, 3);
          return (
            <div key={item.key} className={`mood-trend-day ${item.mood ? 'mood-trend-active' : ''}`}>
              <span>{label}</span>
              <b aria-label={item.mood ? translateMoodLabel(item.mood, language) : undefined}>{moodTrendIcon(item.mood)}</b>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-sm leading-5 text-lavender">
        {language === 'en' ? 'Your check-ins make the week easier to understand.' : 'Чек-ины помогают увидеть неделю яснее.'}
      </p>
    </section>
  );
}

function WeeklySummaryCard({ lines, stats, language }: { lines: string[]; stats?: ProfileStats['weeklyStats']; language: AppLanguage }) {
  const minutesMatch = lines[0]?.match(/(\d+)/);
  const dayMatch = lines[0]?.match(/across\s+(\d+)\s+day|за\s+(\d+)\s+д/iu);
  const minutes = String(stats?.listeningMinutes ?? minutesMatch?.[1] ?? '0');
  const days = String(stats?.completedDays ?? dayMatch?.[1] ?? dayMatch?.[2] ?? '0');
  const supporting = lines.slice(1, 3);

  return (
    <section className="weekly-summary-card luna-progress-enter">
      <p className="text-xs uppercase tracking-[0.16em] text-gold">{copy[language].weeklyTitle}</p>
      <div className="weekly-summary-meter">
        <strong>{minutes} {language === 'en' ? 'min' : 'мин'}</strong>
        <span>{language === 'en' ? 'across' : 'за'}</span>
        <strong>{days} {language === 'en' ? (days === '1' ? 'day' : 'days') : 'дн.'}</strong>
      </div>
      <div className="mt-4 space-y-3">
        {supporting.map((line) => (
          <p key={line} className="text-sm leading-5 text-lavender">{line}</p>
        ))}
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold/80">{language === 'en' ? 'Next gentle step' : 'Мягкий следующий шаг'}</p>
      </div>
    </section>
  );
}

function GardenRewardCard({
  stage,
  plantedCount,
  seeds,
  language,
  onOpen
}: {
  stage: GardenStage;
  plantedCount: number;
  seeds: number;
  language: AppLanguage;
  onOpen: () => void;
}) {
  return (
    <button onClick={onOpen} className="garden-reward-card luna-progress-enter">
      <div className="garden-reward-image">
        <img src={stage.path} alt="" className="luna-garden-thumb h-full w-full object-cover" loading="lazy" />
        <span className="luna-garden-firefly left-[24%] top-[28%]" />
        <span className="luna-garden-firefly left-[66%] top-[42%]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-[0.16em] text-gold">{copy[language].moonGarden}</p>
        <h3 className="mt-1 text-lg font-semibold tracking-[-0.035em] text-cream">{stage.title[language]}</h3>
        <p className="mt-1.5 text-sm leading-5 text-lavender">
          {language === 'en' ? 'Your reward for returning to calm.' : 'Твоя награда за возвращение к спокойствию.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-cream/70">
          <span className="garden-reward-pill">{language === 'en' ? 'Level' : 'Уровень'} {stage.level}</span>
          <span className="garden-reward-pill">{seeds} {copy[language].moonSeeds}</span>
          <span className="garden-reward-pill">{plantedCount} {language === 'en' ? 'planted' : 'посажено'}</span>
        </div>
        <p className="mt-3 text-xs font-semibold text-gold">{copy[language].openMoonGarden} →</p>
      </div>
    </button>
  );
}

function AchievementsSection({ profile, language }: { profile: ProfileStats | null; language: AppLanguage }) {
  const fallbackItems = [
    { id: 'first_meditation', title: language === 'en' ? 'First Meditation' : 'Первая медитация', description: language === 'en' ? 'Complete your first session.' : 'Заверши первую практику.', unlocked: (profile?.completedMeditations ?? 0) >= 1 },
    { id: 'first_week', title: language === 'en' ? 'First Week' : 'Первая неделя', description: language === 'en' ? 'Build a seven-day rhythm.' : 'Создай ритм на семь дней.', unlocked: (profile?.longestStreak ?? 0) >= 7 },
    { id: 'hundred_minutes', title: language === 'en' ? '100 Listening Minutes' : '100 минут практики', description: language === 'en' ? 'Spend 100 minutes with Luna.' : 'Проведи 100 минут с Luna.', unlocked: (profile?.minutesListened ?? 0) >= 100 },
    { id: 'calm_explorer', title: language === 'en' ? 'Calm Explorer' : 'Исследователь спокойствия', description: language === 'en' ? 'Complete five practices.' : 'Заверши пять практик.', unlocked: (profile?.completed ?? 0) >= 5 }
  ];
  const sourceItems = profile?.achievements?.items?.length ? profile.achievements.items : fallbackItems;
  const items = sourceItems;
  const unlocked = profile?.achievements?.unlocked ?? sourceItems.filter((item) => item.unlocked).length;
  const total = profile?.achievements?.total ?? 42;
  const icons = ['🏅', '🌙', '🔥', '⭐', '🌸', '❄', '☾', '✦'];

  return (
    <section className="achievements-section luna-progress-enter">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-gold">{language === 'en' ? 'Your Achievements' : 'Твои достижения'}</p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.04em] text-cream">{unlocked} / {total}</h3>
        </div>
        <p className="max-w-[140px] text-right text-[11px] leading-4 text-lavender">
          {language === 'en' ? 'Unlocked badges glow as your rhythm grows.' : 'Открытые значки светятся по мере роста ритма.'}
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {items.map((item, index) => (
          <article key={item.id} className={`achievement-badge ${item.unlocked ? 'achievement-unlocked' : 'achievement-locked'}`}>
            <span aria-hidden="true">{icons[index % icons.length]}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-cream">{item.title}</p>
              <p className="line-clamp-1 text-[11px] leading-4 text-lavender">{item.description}</p>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-cream/52">
        {language === 'en' ? `${unlocked} / ${total} achievements unlocked` : `${unlocked} / ${total} достижений открыто`}
      </p>
    </section>
  );
}

function MeditationCard({ meditation, locked, showPopular, onOpen, onFavorite, onUnlock, language }: {
  meditation: Meditation;
  locked: boolean;
  showPopular?: boolean;
  onOpen: (meditation: Meditation) => void;
  onFavorite: (meditation: Meditation) => void;
  onUnlock: () => void;
  language: AppLanguage;
}) {
  const localized = getLocalizedMeditation(meditation, language);
  const hasProgress = (meditation.history?.last_position ?? 0) > 0;
  const hasDescription = localized.description.trim().length > 0;
  const hasBadges = meditation.premium || showPopular || hasProgress;
  return (
    <article className="luna-editorial-row">
      <div className="grid grid-cols-[80px_minmax(0,1fr)_38px] items-center gap-3">
        <button onClick={() => (locked ? onUnlock() : onOpen(meditation))} className="relative shrink-0 text-left">
          <img src={meditation.cover_image} alt="" className={`h-20 w-20 rounded-[17px] object-cover shadow-glow ${locked ? 'blur-sm' : ''}`} loading="lazy" />
          {locked && <Lock className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-gold" />}
        </button>
        <div className="grid min-h-20 min-w-0 content-center">
          <button onClick={() => (locked ? onUnlock() : onOpen(meditation))} className="w-full text-left">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[15px] font-semibold leading-tight text-cream">{localized.title}</h3>
              {meditation.premium && <Crown size={13} className="text-gold" />}
            </div>
            <p className="mt-0.5 text-[11px] capitalize text-lavender">{translateCategory(meditation.category, language)} · {formatTime(meditation.duration)}</p>
            {hasDescription && <p className="mt-0.5 line-clamp-1 text-[11px] leading-[15px] text-cream/55">{localized.description}</p>}
          </button>
          {!localized.hasSelectedLanguageAudio && <p className="mt-1 text-[11px] text-gold">{copy[language].availableInEnglish}</p>}
          {hasBadges && (
            <div className="mt-1 flex flex-wrap gap-1 text-[9px] leading-none">
              {meditation.premium && <span className="whitespace-nowrap rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-gold">{copy[language].premium}</span>}
              {showPopular && <span className="whitespace-nowrap rounded-full border border-lavender/15 bg-lavender/10 px-2 py-0.5 text-lavender">{copy[language].popularToday}</span>}
              {hasProgress ? <span className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.045] px-2 py-0.5 text-cream/70">{copy[language].resume}</span> : null}
            </div>
          )}
        </div>
        <button onClick={() => onFavorite(meditation)} className="grid min-h-[38px] min-w-[38px] place-items-center rounded-full border border-white/10 bg-white/[0.045] text-cream transition hover:bg-white/[0.075]" aria-label="Favorite meditation">
          <Heart size={16} className={meditation.favorite ? 'fill-gold text-gold' : 'text-cream/72'} />
        </button>
      </div>
    </article>
  );
}

function MantraCard({ mantra, locked, onOpen, language }: {
  mantra: MantraDefinition;
  locked: boolean;
  onOpen: (mantra: MantraDefinition) => void;
  language: AppLanguage;
}) {
  const hasDescription = mantra.description[language].trim().length > 0;
  return (
    <button onClick={() => onOpen(mantra)} className="luna-editorial-row group w-full text-left transition">
      <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3">
        <div className="relative shrink-0">
          <img src={mantra.cover} alt="" className={`h-[88px] w-[88px] rounded-[18px] object-cover shadow-glow ${locked ? 'blur-[2px]' : ''}`} loading="lazy" />
          {locked && <Lock className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-gold" />}
        </div>
        <div className="min-w-0 self-center">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold leading-tight text-cream">{mantra.title[language]}</h3>
            {mantra.access === 'premium' && <Crown size={13} className="text-gold" />}
          </div>
          <p className="mt-0.5 text-[11px] text-lavender">{mantra.subtitle[language]} · {formatTime(mantra.duration)}</p>
          {hasDescription && <p className="mt-0.5 line-clamp-2 text-[11px] leading-[15px] text-cream/55">{mantra.description[language]}</p>}
          <div className="mt-1 flex flex-wrap gap-1 text-[9px] leading-none">
            {mantra.access === 'premium' && <span className="rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-gold">{copy[language].premium}</span>}
            <span className="rounded-full border border-lavender/15 bg-lavender/10 px-2 py-0.5 text-lavender">{copy[language].mantrasTab}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function MantraPlayerPage({ mantra, onClose, language }: { mantra: MantraDefinition; onClose: () => void; language: AppLanguage }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.55);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = createMantraAudioUrl(mantra.id);
    audio.loop = true;
    audio.volume = volume;
    const syncPause = () => setPlaying(false);
    const syncPlay = () => setPlaying(true);
    audio.addEventListener('pause', syncPause);
    audio.addEventListener('play', syncPlay);
    return () => {
      audio.pause();
      audio.removeEventListener('pause', syncPause);
      audio.removeEventListener('play', syncPlay);
    };
  }, [mantra.id]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play();
      setPlaying(true);
      return;
    }
    audio.pause();
    setPlaying(false);
  };

  return (
    <div className="luna-page relative space-y-4">
      <img src={mantra.cover} alt="" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] w-full scale-110 rounded-[34px] object-cover opacity-25 blur-3xl" />
      <section className="luna-surface-strong rounded-[28px] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold">{copy[language].mantrasTab}</p>
            <h2 className="mt-1 font-serif text-3xl">{mantra.title[language]}</h2>
          </div>
          <button onClick={onClose} aria-label={copy[language].close} className="luna-icon-button">
            <X size={18} />
          </button>
        </div>
        <img src={mantra.cover} alt="" className="mt-4 aspect-square w-full rounded-[26px] object-cover shadow-glow" />
        <p className="mt-4 text-center text-sm text-lavender">{mantra.subtitle[language]}</p>
        <p className="mx-auto mt-2 max-w-xs text-center text-sm leading-6 text-cream/75">{mantra.description[language]}</p>
        <button onClick={toggle} className="mx-auto mt-5 grid h-16 w-16 place-items-center rounded-full bg-gold text-night shadow-glow">
          {playing ? <Pause /> : <Play />}
        </button>
        <div className="mt-5 rounded-[20px] border border-white/10 bg-white/10 p-4 backdrop-blur">
          <div className="mb-2 flex items-center justify-between text-sm text-lavender">
            <span className="inline-flex items-center gap-2"><Volume2 size={16} />{copy[language].sceneVolume}</span>
            <span>{Math.round(volume * 100)}%</span>
          </div>
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="h-8 w-full accent-gold" />
        </div>
      </section>
      <audio ref={audioRef} preload="none" loop />
    </div>
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
    <div className="luna-page relative space-y-4">
      <img src={scene.cover} alt="" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] w-full scale-110 rounded-[34px] object-cover opacity-25 blur-3xl" />
      <div className="luna-surface-strong rounded-[28px] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold">{copy[language].scenesTitle}</p>
            <h2 className="mt-1 font-serif text-3xl">{scene.title[language]}</h2>
          </div>
          <button onClick={onClose} aria-label={copy[language].closeScene} className="luna-icon-button">
            <X size={18} />
          </button>
        </div>

        <img src={scene.cover} alt="" className="mt-4 aspect-square w-full rounded-[26px] object-cover shadow-glow" />
        <p className="mt-4 text-center text-sm text-lavender">{scene.subtitle[language]}</p>
        <p className="mt-2 text-center text-xs uppercase tracking-[0.18em] text-gold">{copy[language].sceneLoop}</p>

        <button onClick={onToggle} className="mx-auto mt-5 grid h-16 w-16 place-items-center rounded-full bg-gold text-night shadow-glow">
          {playing ? <Pause /> : <Play />}
        </button>

        <div className="mt-5 rounded-[20px] border border-white/10 bg-white/10 p-4 backdrop-blur">
          <div className="mb-2 flex items-center justify-between text-sm text-lavender">
            <span className="inline-flex items-center gap-2"><Volume2 size={16} />{copy[language].sceneVolume}</span>
            <span>{Math.round(volume * 100)}%</span>
          </div>
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => onVolume(Number(event.target.value))} className="h-8 w-full accent-gold" />
        </div>
      </div>

      <section>
        <h3 className="luna-section-title mb-3">{copy[language].changeScene}</h3>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 luna-scrollbar-none">
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

function SceneMiniPlayer({ scene, playing, volume, onToggle, onOpen, onClose, onVolume, language }: {
  scene: SceneDefinition;
  playing: boolean;
  volume: number;
  onToggle: () => void;
  onOpen: () => void;
  onClose: () => void;
  onVolume: (volume: number) => void;
  language: AppLanguage;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="fixed inset-x-3 bottom-[calc(82px+env(safe-area-inset-bottom))] z-20 mx-auto max-w-md overflow-hidden rounded-[20px] border border-white/10 bg-night/80 shadow-glow backdrop-blur-2xl">
      <div className="flex min-h-[60px] items-center gap-2 px-3 py-2">
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <img src={scene.cover} alt="" className="h-10 w-10 shrink-0 rounded-[14px] object-cover" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{scene.title[language]}</p>
            <p className="truncate text-[11px] text-lavender">{playing ? copy[language].soundscapeActive : scene.subtitle[language]}</p>
          </div>
        </button>
        <button onClick={() => setExpanded((value) => !value)} aria-label={copy[language].sceneVolume} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream/10 text-gold">
          <Volume2 size={16} />
        </button>
        <button onClick={onToggle} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold text-night">
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button onClick={onClose} aria-label={copy[language].closeScene} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream/10 text-cream">
          <X size={16} />
        </button>
      </div>
      {expanded && (
        <div className="border-t border-white/10 px-3 pb-3 pt-2">
          <div className="mb-1 flex items-center justify-between text-[11px] text-lavender">
            <span>{copy[language].sceneVolume}</span>
            <span>{Math.round(volume * 100)}%</span>
          </div>
          <input aria-label={copy[language].sceneVolume} type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => onVolume(Number(event.target.value))} className="h-6 w-full accent-gold" />
        </div>
      )}
    </div>
  );
}

function FavoritesPage({ meditations, onOpen, onFavorite, language }: { meditations: Meditation[]; onOpen: (meditation: Meditation) => void; onFavorite: (meditation: Meditation) => void; language: AppLanguage }) {
  return (
    <div className="luna-page space-y-4">
      <div>
        <p className="luna-section-kicker">LUNA</p>
        <h2 className="text-3xl font-semibold tracking-[-0.03em]">{copy[language].savedTitle}</h2>
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
  const t = copy[language];

  return (
    <div className="luna-page space-y-5">
      <section className="relative overflow-hidden rounded-[34px] border border-gold/20 bg-[radial-gradient(circle_at_76%_18%,rgba(212,175,55,.2),transparent_26%),linear-gradient(160deg,rgba(43,26,58,.72),rgba(10,6,16,.9))] p-5 shadow-glow">
        <div className="absolute right-5 top-5 opacity-80">
          <MoonMark className="h-12 w-12 shrink-0" />
        </div>
        <p className="luna-section-kicker">{t.premiumTitle}</p>
        <h2 className="luna-editorial-title mt-8 max-w-[260px] text-[38px] leading-[0.96]">{t.premiumHeadline}</h2>
        <p className="mt-4 max-w-[300px] text-sm leading-6 text-beige">
          {t.premiumBody}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <PremiumBadge label={t.premiumLibrary} />
          <PremiumBadge label={t.weeklyContent} />
          <PremiumBadge label={t.dailyStreak} />
        </div>
      </section>
      {locked && <p className="luna-card p-4 text-sm text-cream/80">{text(language, 'lockedPremium', { title: getLocalizedMeditation(locked, language).title })}</p>}
      <PlanCard title={t.monthlyPremium} price={`${premiumPrices.monthly} ⭐`} features={[t.unlimitedMeditations, t.premiumBreathing, t.sleepAnxietyFocus, t.dailyStreaks]} action={t.unlockMonthly} loading={openingPlan === 'monthly'} disabled={Boolean(openingPlan)} onClick={() => onBuy('monthly')} language={language} featured />
      <PlanCard title={t.lifetimePremium} price={`${premiumPrices.lifetime} ⭐`} features={[t.premiumForever, t.allFuturePractices, t.bestValue, t.instantTelegramUnlock]} action={t.getLifetime} loading={openingPlan === 'lifetime'} disabled={Boolean(openingPlan)} onClick={() => onBuy('lifetime')} language={language} />
      <div className="grid grid-cols-2 gap-2">
        <PremiumValue title={t.sleepDeeper} body={t.sleepDeeperBody} />
        <PremiumValue title={t.calmFaster} body={t.calmFasterBody} />
        <PremiumValue title={t.buildRhythm} body={t.buildRhythmBody} />
        <PremiumValue title={t.growGently} body={t.growGentlyBody} />
      </div>
      {message && <p className="rounded-2xl bg-lavender/15 p-4 text-sm text-cream/80">{message}</p>}
      {openingPlan && <div className="h-1 overflow-hidden rounded-full bg-cream/10"><div className="h-full w-1/2 animate-pulse rounded-full bg-gold" /></div>}
      {message === t.paymentSuccessful && <button onClick={onLibrary} className="w-full rounded-2xl bg-cream px-5 py-4 font-semibold text-night">{t.openPremiumLibrary}</button>}
    </div>
  );
}

function PremiumBadge({ label }: { label: string }) {
  return <span className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1.5 text-[11px] font-medium text-gold">{label}</span>;
}

function PremiumValue({ title, body }: { title: string; body: string }) {
  return (
    <article className="min-h-[104px] border-t border-white/10 py-3">
      <div className="flex items-center gap-2">
        <Sparkles size={15} className="shrink-0 text-gold" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-cream/70">{body}</p>
    </article>
  );
}

function PlanCard(props: { title: string; price: string; features: string[]; action?: string; loading?: boolean; disabled?: boolean; featured?: boolean; onClick?: () => void; language: AppLanguage }) {
  return (
    <article className={`rounded-[26px] border p-4 backdrop-blur ${props.featured ? 'border-gold/35 bg-gold/10 shadow-gold' : 'border-white/10 bg-white/5'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold">{props.title}</h3>
          <p className="mt-1 text-gold">{props.price}</p>
        </div>
        <Crown className="text-gold" />
      </div>
      <ul className="mt-3 grid gap-1.5 text-xs text-cream/75">
        {props.features.map((feature) => <li key={feature}>• {feature}</li>)}
      </ul>
      {props.action && (
        <button
          onClick={props.onClick}
          disabled={props.disabled}
          className={`${props.featured ? 'luna-button-primary' : 'rounded-full border border-gold/25 text-gold'} mt-4 flex w-full items-center justify-center gap-2 px-4 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-70`}
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
    if (import.meta.env.DEV) {
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
    }
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
    if (import.meta.env.DEV) {
      console.log('[PLAYER_PAUSE_CLICK]', {
        beforeAudioTime: t,
        beforeStateTime: position,
        savedProgress,
        livePosition: livePositionRef.current,
        meditationId: meditation.id,
        version: playerFixVersion
      });
    }

    audio.pause();
    setPlaying(false);
    setLiveTime('pausePlayback:isolation-no-save', t, audio);
    setAudioTime(audio.currentTime);

    if (import.meta.env.DEV) {
      console.log('[PLAYER_AFTER_PAUSE]', {
        afterAudioTime: audio.currentTime,
        afterStateTime: t,
        savedProgress,
        livePosition: livePositionRef.current,
        meditationId: meditation.id,
        version: playerFixVersion
      });
    }
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
    if (import.meta.env.DEV) {
      console.log('[PLAYER_ISOLATION_LOAD]', {
        initialPosition,
        savedProgress,
        meditationId: meditation.id,
        version: playerFixVersion
      });
    }
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
        if (import.meta.env.DEV) {
          console.log('[PLAYER_METADATA_INIT]', {
            initialPosition,
            savedProgress,
            meditationId: meditation.id,
            version: playerFixVersion
          });
        }
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
      if (import.meta.env.DEV) {
        console.log('[PLAYER_NATIVE_PAUSE_ISOLATED]', {
          audioTime: audio.currentTime,
          stateTime: position,
          livePosition: livePositionRef.current,
          savedProgress,
          meditationId: meditation.id,
          version: playerFixVersion
        });
      }
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
    <div className="luna-page relative space-y-5 pt-1">
      <img src={meditation.cover_image} alt="" className="pointer-events-none absolute inset-x-[-20px] top-[-20px] -z-10 h-[520px] w-[calc(100%+40px)] scale-105 rounded-[38px] object-cover opacity-20 blur-3xl" />
      <div className="flex items-center justify-between">
        <button onClick={onHome} className="rounded-full border border-white/10 bg-night/45 px-4 py-2 text-sm text-cream backdrop-blur">
          ←
        </button>
        <p className="luna-section-kicker">{translateCategory(meditation.category, language)}</p>
        <span className="h-9 w-9" />
      </div>
      <div>
        <div className="relative mx-auto aspect-square w-full max-w-[336px] overflow-hidden rounded-[34px] border border-white/10 bg-night/80 shadow-glow">
          <img src={meditation.cover_image} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-xl" />
          <img src={meditation.cover_image} alt="" className="relative h-full w-full object-contain p-3" />
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

        <div className="mt-5 text-center">
          <h2 className="luna-editorial-title mt-1 text-[36px] leading-[0.98]">{localized.title}</h2>
          <p className="mt-1 text-sm text-cream/70">{localized.subtitle}</p>
          {!localized.hasSelectedLanguageAudio && <p className="mt-2 text-xs text-gold">{copy[language].availableInEnglish}</p>}
          <p className="mt-2 text-sm text-lavender">{text(language, 'elapsedRemaining', { elapsed: formatTime(position), remaining: formatTime(Math.max(0, duration - position)) })}</p>
        </div>

        <input className="mt-4 h-8 w-full accent-gold" type="range" min={0} max={duration || 1} value={position} onChange={(event) => {
          const next = Number(event.target.value);
          seekTo(next);
        }} />
        <div className="mt-1 flex justify-between text-xs text-lavender">
          <span>{formatTime(position)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        <div className="mt-4 flex items-center justify-center gap-6">
          <IconButton label={copy[language].rewind15} onClick={() => {
            seekTo((audioRef.current?.currentTime ?? position) - 15);
          }}><SkipBack /></IconButton>
          <button onClick={() => {
            if (!audioRef.current) return;
            if (audioRef.current.paused) void audioRef.current.play();
            else pausePlayback();
          }} className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-lightgold to-gold text-night shadow-gold hover:brightness-110">
            {playing ? <Pause /> : <Play />}
          </button>
          <IconButton label={copy[language].forward15} onClick={() => {
            seekTo((audioRef.current?.currentTime ?? position) + 15);
          }}><SkipForward /></IconButton>
        </div>

        {import.meta.env.DEV && (
          <div className="mt-4 rounded-[18px] border border-gold/20 bg-night/70 p-3 text-left text-[11px] leading-5 text-lavender">
            <p className="font-semibold text-gold">Player isolation debug</p>
            <p>version: {playerFixVersion}</p>
            <p>currentTime state: {position.toFixed(2)}</p>
            <p>audio.currentTime: {audioTime.toFixed(2)}</p>
            <p>savedProgress: {Number(savedProgress).toFixed(2)}</p>
            <p>livePositionRef: {livePositionRef.current.toFixed(2)}</p>
          </div>
        )}

        <div className="mt-5 flex items-center justify-center gap-3">
          <button onClick={onFavorite} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 text-xs backdrop-blur"><Heart className={favorite ? 'fill-gold text-gold' : ''} size={16} />{copy[language].favorite}</button>
          <button onClick={() => void shareMeditation()} disabled={meditation.premium} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 text-xs text-lavender backdrop-blur disabled:cursor-not-allowed disabled:opacity-50"><Share2 size={16} />{copy[language].share}</button>
          <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 text-xs text-lavender backdrop-blur"><Timer size={16} />{formatTime(Math.max(0, duration - position))}</div>
        </div>
        {shareMessage && <p className="mt-2 rounded-2xl bg-gold/10 px-3 py-2 text-center text-xs text-cream/80">{shareMessage}</p>}

        <div className="mt-3 flex items-center justify-between border-t border-white/10 px-1 py-3">
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
  return <button aria-label={label} onClick={onClick} className="luna-icon-button">{children}</button>;
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

function MoonGardenScene({
  profile,
  language,
  expanded = false,
  ambiencePlaying = false,
  ambienceVolume,
  ambienceError = false,
  onToggleAmbience,
  onAmbienceVolume
}: {
  profile: ProfileStats | null;
  language: AppLanguage;
  appearedElementId?: string | null;
  expanded?: boolean;
  ambiencePlaying?: boolean;
  ambienceVolume: number;
  ambienceError?: boolean;
  onToggleAmbience: () => Promise<void>;
  onAmbienceVolume: (volume: number) => void;
}) {
  const plantedCount = plantedGardenElements(profile).length;
  const stage = getCurrentGardenStage(plantedCount);
  const levelText = language === 'en' ? `Level ${stage.level}` : `Уровень ${stage.level}`;

  return (
    <AnimatedMoonGardenScene
      stage={{
        level: stage.level,
        path: stage.path,
        videoPath: stage.videoPath,
        title: stage.title[language],
        subtitle: stage.subtitle[language]
      }}
      statusLabel={`${levelText} · ${stage.title[language]}`}
      compact={!expanded}
      soundPlaying={ambiencePlaying}
      soundVolume={ambienceVolume}
      soundError={ambienceError}
      soundLabel={language === 'en' ? 'Sound' : 'Звук'}
      soundVolumeLabel={language === 'en' ? 'Volume' : 'Громкость'}
      soundUnavailableLabel={copy[language].gardenAmbienceUnavailable}
      onToggleSound={() => void onToggleAmbience()}
      onSoundVolumeChange={onAmbienceVolume}
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
    <div className="luna-page space-y-5 pb-[calc(120px+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top,0px)+24px)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="luna-editorial-title text-[34px] leading-none">{copy[language].moonGarden}</h2>
          <p className="mt-1 text-sm text-lavender">{copy[language].moonGardenBody}</p>
        </div>
        <button onClick={onBack} className="luna-icon-button" aria-label={copy[language].close}>
          <X size={18} />
        </button>
      </div>

      <MoonGardenScene
        profile={activeProfile}
        language={language}
        appearedElementId={appearedElementId}
        expanded
        ambiencePlaying={ambiencePlaying}
        ambienceVolume={ambienceVolume}
        ambienceError={ambienceError}
        onToggleAmbience={onToggleAmbience}
        onAmbienceVolume={onAmbienceVolume}
      />

      <section className="border-y border-white/10 py-4">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Stat label={copy[language].availableMoonSeeds} value={String(seeds)} />
          <Stat label={copy[language].gardenLevel} value={`${stage.level} · ${stage.title[language]}`} />
          <Stat label={copy[language].plantedElements} value={String(plantedCount)} />
        </div>
        {message && <p className="mt-3 rounded-2xl bg-night/70 px-3 py-2 text-sm text-gold">{message}</p>}
      </section>

      <section className="rounded-[26px] border border-gold/20 bg-gold/10 p-4">
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
              className={`mt-4 w-full rounded-full px-4 py-3 text-sm font-semibold ${
                canPlantNextUpgrade ? 'luna-button-primary' : 'border border-white/10 bg-white/10 text-lavender'
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
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold">
            {language === 'en' ? 'Garden Collection' : 'Коллекция сада'}
          </p>
          <h3 className="font-serif text-2xl">
            {language === 'en' ? 'Seasons · Phase 1' : 'Сезоны · Phase 1'}
          </h3>
        </div>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 luna-scrollbar-none">
          {gardenCollections.map((collection, index) => (
            <article key={collection.id} className="w-48 shrink-0 overflow-hidden rounded-[24px] border border-white/10 bg-white/5 p-3 backdrop-blur">
              <div className={`h-24 rounded-[20px] border border-gold/20 ${
                index === 0
                  ? 'bg-[radial-gradient(circle_at_50%_20%,rgba(212,175,55,.32),transparent_32%),linear-gradient(180deg,#2b1746,#0c0814)]'
                  : index === 1
                    ? 'bg-[radial-gradient(circle_at_50%_25%,rgba(245,241,233,.24),transparent_30%),linear-gradient(180deg,#263050,#0c0814)]'
                    : 'bg-[radial-gradient(circle_at_50%_25%,rgba(142,95,214,.3),transparent_30%),linear-gradient(180deg,#2e1f45,#101624)]'
              }`} />
              <p className="mt-3 text-xs uppercase tracking-[0.14em] text-gold">{collection.status[language]}</p>
              <h4 className="mt-1 font-serif text-lg">{collection.title[language]}</h4>
              <p className="mt-1 text-xs leading-5 text-lavender">{collection.body[language]}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-serif text-2xl">{copy[language].gardenElements}</h3>
        {gardenElements.map((element) => {
          const isPlanted = planted.has(element.id);
          const needed = Math.max(0, element.cost - seeds);
          const canPlant = !isPlanted && needed === 0;
          const status = isPlanted ? copy[language].planted : canPlant ? copy[language].availableToPlant : copy[language].locked;
          return (
            <article key={element.id} className="luna-editorial-row">
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
                  className={`mt-3 w-full rounded-full px-4 py-3 text-sm font-semibold ${
                    canPlant ? 'luna-button-primary' : 'border border-white/10 bg-white/10 text-lavender'
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

function resizeAvatarImage(file: File) {
  return new Promise<Blob>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const size = Math.min(image.width, image.height);
      const sourceX = (image.width - size) / 2;
      const sourceY = (image.height - size) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error('Could not prepare avatar image.'));
        return;
      }
      context.drawImage(image, sourceX, sourceY, size, size, 0, 0, 512, 512);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (!blob) {
          reject(new Error('Could not prepare avatar image.'));
          return;
        }
        resolve(blob);
      }, 'image/webp', 0.86);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read avatar image.'));
    };
    image.src = url;
  });
}

type ProfileSettingsView = 'main' | 'goals' | 'notifications' | 'language' | 'subscription' | 'memory' | 'more' | 'privacy' | 'terms' | 'disclaimer';
type RestoreState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '0.1.0';
const profileGoalOptions = [
  { id: 'sleep', en: 'Sleep better', ru: 'Лучше спать' },
  { id: 'anxiety', en: 'Reduce anxiety', ru: 'Снизить тревогу' },
  { id: 'focus', en: 'Improve focus', ru: 'Улучшить фокус' },
  { id: 'routine', en: 'Build a calm routine', ru: 'Создать спокойный ритм' },
  { id: 'stress', en: 'Manage stress', ru: 'Управлять стрессом' }
];

function defaultNotificationPreferences(preferences?: Partial<NotificationPreferences> | null): NotificationPreferences {
  let timezone = 'UTC';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    timezone = 'UTC';
  }

  return {
    dailyReminder: Boolean(preferences?.dailyReminder),
    newContent: false,
    reminderTime: preferences?.reminderTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(preferences.reminderTime) ? preferences.reminderTime : '21:00',
    timezone: preferences?.timezone || timezone
  };
}

function goalsCountLabel(count: number, language: AppLanguage) {
  if (language === 'en') return count === 1 ? '1 goal' : `${count} goals`;
  return count === 1 ? '1 цель' : `${count} целей`;
}

function notificationStatusLabel(preferences: NotificationPreferences, language: AppLanguage) {
  if (preferences.dailyReminder) return `${language === 'en' ? 'Daily' : 'Ежедневно'} ${preferences.reminderTime}`;
  return language === 'en' ? 'Off' : 'Выкл';
}

function ProfilePage({
  profile,
  access,
  firstName,
  username,
  showAdminButton,
  onLuna,
  onSubscription,
  onAdmin,
  onRestore,
  onAddHome,
  onLanguageChange,
  onProfileUpdate,
  onNestedChange,
  homeScreenMessage,
  initData,
  language
}: {
  profile: ProfileStats | null;
  access: AccessState;
  firstName: string;
  username?: string;
  showAdminButton: boolean;
  onLuna: () => void;
  onSubscription: () => void;
  onAdmin: () => void;
  onRestore: () => void | Promise<void>;
  onAddHome: () => void;
  onLanguageChange: (language: AppLanguage) => void;
  onProfileUpdate: (profile: ProfileStats | null | ((current: ProfileStats | null) => ProfileStats | null)) => void;
  onNestedChange: (nested: boolean) => void;
  homeScreenMessage: string;
  initData?: string;
  language: AppLanguage;
}) {
  const [view, setView] = useState<ProfileSettingsView>('main');
  const [avatarActionsOpen, setAvatarActionsOpen] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [avatarMessage, setAvatarMessage] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [savingSettings, setSavingSettings] = useState<string | null>(null);
  const [restoreState, setRestoreState] = useState<RestoreState>('idle');
  const [logoutOpen, setLogoutOpen] = useState(false);
  const chooseInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [goals, setGoals] = useState<string[]>(profile?.user?.profile_goals ?? []);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(() => defaultNotificationPreferences(profile?.user?.notification_preferences));
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memories, setMemories] = useState<LunaMemory[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);

  useEffect(() => {
    onNestedChange(view !== 'main');
    return () => onNestedChange(false);
  }, [onNestedChange, view]);

  useEffect(() => {
    setGoals(profile?.user?.profile_goals ?? []);
    setNotificationPrefs(defaultNotificationPreferences(profile?.user?.notification_preferences));
  }, [profile?.user?.profile_goals, profile?.user?.notification_preferences]);

  useEffect(() => {
    if (view !== 'memory') return;
    setMemoryLoading(true);
    setSettingsMessage('');
    getLunaMemory(initData)
      .then((result) => {
        setMemoryEnabled(result.enabled);
        setMemories(result.memories);
      })
      .catch(() => setSettingsMessage(language === 'en' ? 'Could not load Luna Memory.' : 'Не удалось загрузить память Luna.'))
      .finally(() => setMemoryLoading(false));
  }, [initData, language, view]);

  const avatarUrl = profile?.user?.avatar_url ?? null;
  const planStatus = access.hasPremium
    ? access.plan.toLowerCase().includes('lifetime') ? 'Lifetime Premium' : access.plan.toLowerCase().includes('monthly') ? 'Monthly Premium' : copy[language].premium
    : copy[language].premiumFree;
  const localizedPlanStatus = language === 'ru' && planStatus === copy.en.premiumFree ? copy.ru.premiumFree : planStatus;
  const goalsLabel = goalsCountLabel(goals.length, language);
  const notificationLabel = notificationStatusLabel(notificationPrefs, language);
  const companionStatus = language === 'en' ? 'Ready' : 'Готова';
  const languageLabel = language === 'en' ? 'English' : 'Русский';
  const isLifetime = access.hasPremium && access.plan.toLowerCase().includes('lifetime');
  const isMonthly = access.hasPremium && access.plan.toLowerCase().includes('monthly');

  const updateAvatarInProfile = (avatar_url: string | null) => {
    onProfileUpdate((current) => current ? { ...current, user: { ...current.user, avatar_url } } : current);
  };

  const updateGoalsInProfile = (profile_goals: string[]) => {
    onProfileUpdate((current) => current ? { ...current, user: { ...current.user, profile_goals } } : current);
  };

  const updateNotificationsInProfile = (notification_preferences: NotificationPreferences) => {
    onProfileUpdate((current) => current ? { ...current, user: { ...current.user, notification_preferences } } : current);
  };

  const saveGoals = async (nextGoals: string[]) => {
    const previousGoals = goals;
    setGoals(nextGoals);
    updateGoalsInProfile(nextGoals);
    setSettingsMessage('');
    try {
      setSavingSettings('goals');
      const result = await updateProfileGoals(nextGoals, initData);
      setGoals(result.user.profile_goals);
      updateGoalsInProfile(result.user.profile_goals);
    } catch {
      setGoals(previousGoals);
      updateGoalsInProfile(previousGoals);
      setSettingsMessage(language === 'en' ? 'Could not save goals. Please try again.' : 'Не удалось сохранить цели. Попробуй ещё раз.');
    } finally {
      setSavingSettings(null);
    }
  };

  const saveNotificationPrefs = async (nextPreferences: NotificationPreferences) => {
    const previousPreferences = notificationPrefs;
    setNotificationPrefs(nextPreferences);
    updateNotificationsInProfile(nextPreferences);
    setSettingsMessage('');
    try {
      setSavingSettings('notifications');
      const result = await updateNotificationPreferences(nextPreferences, initData);
      setNotificationPrefs(result.user.notification_preferences);
      updateNotificationsInProfile(result.user.notification_preferences);
    } catch {
      setNotificationPrefs(previousPreferences);
      updateNotificationsInProfile(previousPreferences);
      setSettingsMessage(language === 'en' ? 'Could not save notification preferences.' : 'Не удалось сохранить настройки уведомлений.');
    } finally {
      setSavingSettings(null);
    }
  };

  const restorePurchases = async () => {
    if (restoreState === 'loading') return;
    try {
      setRestoreState('loading');
      await onRestore();
      setRestoreState(access.hasPremium ? 'success' : 'empty');
    } catch {
      setRestoreState('error');
    }
  };

  const closeLocalSession = () => {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('luna.'))
      .forEach((key) => window.localStorage.removeItem(key));
    setLogoutOpen(false);
    window.location.reload();
  };

  const handleAvatarFile = async (file?: File | null) => {
    if (!file) return;
    setAvatarMessage('');
    setAvatarProgress(0);

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarMessage(language === 'en' ? 'Please choose a JPEG, PNG, or WebP image.' : 'Выбери JPEG, PNG или WebP изображение.');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setAvatarMessage(language === 'en' ? 'Please choose an image under 8 MB.' : 'Выбери изображение меньше 8 МБ.');
      return;
    }

    try {
      setAvatarBusy(true);
      const resized = await resizeAvatarImage(file);
      const result = await uploadProfileAvatar(resized, initData, setAvatarProgress);
      updateAvatarInProfile(result.avatarUrl);
      setAvatarMessage(language === 'en' ? 'Avatar updated.' : 'Аватар обновлён.');
      setAvatarActionsOpen(false);
    } catch (error) {
      setAvatarMessage(error instanceof Error ? error.message : (language === 'en' ? 'Upload failed.' : 'Не удалось загрузить.'));
    } finally {
      setAvatarBusy(false);
      setAvatarProgress(0);
      if (chooseInputRef.current) chooseInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const removeAvatar = async () => {
    try {
      setAvatarBusy(true);
      await removeProfileAvatar(initData);
      updateAvatarInProfile(null);
      setAvatarMessage(language === 'en' ? 'Avatar removed.' : 'Аватар удалён.');
      setAvatarActionsOpen(false);
    } catch (error) {
      setAvatarMessage(error instanceof Error ? error.message : (language === 'en' ? 'Could not remove avatar.' : 'Не удалось удалить аватар.'));
    } finally {
      setAvatarBusy(false);
    }
  };

  if (view === 'goals') {
    return (
      <ProfileChildScreen title={language === 'en' ? 'Goals' : 'Цели'} onBack={() => setView('main')} language={language}>
        <p className="text-sm leading-6 text-lavender">{language === 'en' ? 'Choose what you want Luna to support.' : 'Выбери, в чём Luna может тебя поддержать.'}</p>
        <div className="space-y-2">
          {profileGoalOptions.map((goal) => {
            const selected = goals.includes(goal.id);
            const nextGoals = selected ? goals.filter((id) => id !== goal.id) : [...goals, goal.id];
            return (
              <button
                key={goal.id}
                onClick={() => void saveGoals(nextGoals)}
                disabled={savingSettings === 'goals'}
                className={`flex min-h-[50px] w-full items-center justify-between rounded-[16px] border px-4 text-left text-sm transition ${selected ? 'border-gold/45 bg-gold/10 text-cream' : 'border-white/10 bg-white/[0.04] text-lavender'} disabled:opacity-70`}
              >
                <span>{language === 'en' ? goal.en : goal.ru}</span>
                {selected && <CheckCircle size={16} className="text-gold" />}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-lavender">{goalsLabel}</p>
        {settingsMessage && <p className="rounded-2xl border border-gold/15 bg-gold/10 px-3 py-2 text-xs text-gold">{settingsMessage}</p>}
      </ProfileChildScreen>
    );
  }

  if (view === 'notifications') {
    return (
      <ProfileChildScreen title={language === 'en' ? 'Notifications' : 'Уведомления'} onBack={() => setView('main')} language={language}>
        <section className="luna-surface rounded-[24px] p-2">
          <ProfileToggleRow
            title={language === 'en' ? 'Daily reminder' : 'Ежедневное напоминание'}
            checked={notificationPrefs.dailyReminder}
            disabled={savingSettings === 'notifications'}
            onChange={(checked) => void saveNotificationPrefs({ ...notificationPrefs, dailyReminder: checked })}
          />
          {notificationPrefs.dailyReminder && (
            <label className="flex min-h-[54px] w-full items-center justify-between rounded-[18px] px-4 text-sm text-cream">
              <span>{language === 'en' ? 'Reminder time' : 'Время напоминания'}</span>
              <input
                type="time"
                value={notificationPrefs.reminderTime}
                disabled={savingSettings === 'notifications'}
                onChange={(event) => void saveNotificationPrefs({ ...notificationPrefs, reminderTime: event.currentTarget.value })}
                className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2 text-sm text-gold outline-none disabled:opacity-60"
              />
            </label>
          )}
          <ProfileSettingsRow icon={Bell} title={language === 'en' ? 'New content' : 'Новый контент'} value={copy[language].comingSoon} />
        </section>
        <p className="mt-3 text-xs leading-5 text-lavender">
          {notificationPrefs.dailyReminder
            ? (language === 'en' ? `Preference saved for ${notificationPrefs.reminderTime}. Telegram delivery will be enabled when reminders launch.` : `Предпочтение сохранено на ${notificationPrefs.reminderTime}. Доставка через Telegram будет включена, когда напоминания запустятся.`)
            : (language === 'en' ? 'Luna can send gentle reminders through Telegram.' : 'Luna сможет отправлять мягкие напоминания через Telegram.')}
        </p>
        {settingsMessage && <p className="rounded-2xl border border-gold/15 bg-gold/10 px-3 py-2 text-xs text-gold">{settingsMessage}</p>}
      </ProfileChildScreen>
    );
  }

  if (view === 'language') {
    return (
      <ProfileChildScreen title={copy[language].language} onBack={() => setView('main')} language={language}>
        <section className="luna-surface rounded-[24px] p-2">
          {(['en', 'ru'] as const).map((item) => (
            <button key={item} onClick={() => onLanguageChange(item)} className="flex min-h-[50px] w-full items-center justify-between rounded-[16px] px-4 text-left text-sm text-cream">
              <span>{item === 'en' ? 'English' : 'Русский'}</span>
              {language === item && <CheckCircle size={16} className="text-gold" />}
            </button>
          ))}
        </section>
      </ProfileChildScreen>
    );
  }

  if (view === 'subscription') {
    return (
      <ProfileChildScreen title={language === 'en' ? 'Subscription' : 'Подписка'} onBack={() => setView('main')} language={language}>
        <section className="luna-surface rounded-[24px] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-gold">{language === 'en' ? 'Current plan' : 'Текущий план'}</p>
          <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-cream">{localizedPlanStatus}</h3>
          <p className="mt-1 text-sm leading-6 text-lavender">
            {isLifetime
              ? (language === 'en' ? 'Active forever. You have permanent access to Luna Premium.' : 'Активно навсегда. У тебя постоянный доступ к Luna Premium.')
              : isMonthly
                ? (language === 'en' ? 'Monthly Premium is active through Telegram Stars.' : 'Месячный Premium активен через Telegram Stars.')
                : (language === 'en' ? 'Unlock the full Luna experience when you are ready.' : 'Открой полный опыт Luna, когда будешь готов.')}
          </p>
          <div className="mt-4 space-y-2 text-sm text-lavender">
            {(language === 'en'
              ? ['Full meditation library', 'Premium breathing practices', 'Mantras and soundscapes', 'Future premium content']
              : ['Полная библиотека медитаций', 'Премиум дыхательные практики', 'Мантры и саундскейпы', 'Будущий премиум-контент']
            ).map((item) => <p key={item}>• {item}</p>)}
          </div>
          <button onClick={onSubscription} className={`mt-4 w-full rounded-[18px] px-4 py-3 text-sm font-semibold ${isLifetime ? 'border border-gold/20 bg-gold/10 text-gold' : 'bg-gold text-night'}`}>
            {access.hasPremium ? (language === 'en' ? 'View Premium benefits' : 'Посмотреть Premium') : (language === 'en' ? 'Upgrade to Premium' : 'Перейти на Premium')}
          </button>
          <button disabled={restoreState === 'loading'} onClick={() => void restorePurchases()} className="mt-2 w-full rounded-[18px] border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-semibold text-gold disabled:opacity-60">
            {restoreState === 'loading' ? (language === 'en' ? 'Restoring...' : 'Восстановление...') : copy[language].restore}
          </button>
          {restoreState !== 'idle' && restoreState !== 'loading' && (
            <p className="mt-3 text-xs text-lavender">
              {restoreState === 'success'
                ? (language === 'en' ? 'Purchases restored.' : 'Покупки восстановлены.')
                : restoreState === 'empty'
                  ? (language === 'en' ? 'No purchases found for this account.' : 'Покупки для этого аккаунта не найдены.')
                  : (language === 'en' ? 'Could not restore purchases. Please try again.' : 'Не удалось восстановить покупки. Попробуй ещё раз.')}
            </p>
          )}
        </section>
      </ProfileChildScreen>
    );
  }

  if (view === 'memory') {
    const toggleMemory = async (enabled: boolean) => {
      const previous = memoryEnabled;
      setMemoryEnabled(enabled);
      setSettingsMessage('');
      try {
        await setLunaMemoryEnabled(enabled, initData);
      } catch {
        setMemoryEnabled(previous);
        setSettingsMessage(language === 'en' ? 'Could not update Luna Memory.' : 'Не удалось изменить память Luna.');
      }
    };
    const removeMemory = async (memoryId: string) => {
      try {
        await deleteLunaMemory(memoryId, initData);
        setMemories((current) => current.filter((memory) => memory.id !== memoryId));
      } catch {
        setSettingsMessage(language === 'en' ? 'Could not remove this memory.' : 'Не удалось удалить это воспоминание.');
      }
    };
    const removeAllMemory = async () => {
      if (!window.confirm(language === 'en' ? 'Clear everything Luna remembers?' : 'Удалить всё, что помнит Luna?')) return;
      try {
        await clearLunaMemory(initData);
        setMemories([]);
      } catch {
        setSettingsMessage(language === 'en' ? 'Could not clear Luna Memory.' : 'Не удалось очистить память Luna.');
      }
    };
    const removeHistory = async () => {
      if (!window.confirm(language === 'en' ? 'Delete all Luna conversations?' : 'Удалить все разговоры с Luna?')) return;
      try {
        await clearLunaConversations(initData);
        window.localStorage.removeItem('luna.ai.activeConversation.v1');
        setSettingsMessage(language === 'en' ? 'Conversation history deleted.' : 'История разговоров удалена.');
      } catch {
        setSettingsMessage(language === 'en' ? 'Could not delete conversation history.' : 'Не удалось удалить историю разговоров.');
      }
    };
    return (
      <ProfileChildScreen title={language === 'en' ? 'Luna Memory' : 'Память Luna'} onBack={() => setView('more')} language={language}>
        <p className="text-sm leading-6 text-lavender">
          {language === 'en' ? 'Memory helps Luna continue conversations with useful details you have shared. You stay in control.' : 'Память помогает Luna продолжать разговоры, используя полезные детали, которыми ты поделился или поделилась. Управление всегда у тебя.'}
        </p>
        <section className="luna-surface rounded-[24px] p-2">
          <ProfileToggleRow title={language === 'en' ? 'Allow helpful memory' : 'Разрешить полезную память'} checked={memoryEnabled} disabled={memoryLoading} onChange={(enabled) => void toggleMemory(enabled)} />
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-cream">{language === 'en' ? 'Remembered details' : 'Что помнит Luna'}</h3>
          {memoryLoading ? <p className="text-xs text-lavender">{language === 'en' ? 'Loading...' : 'Загрузка...'}</p> : memories.length ? memories.map((memory) => (
            <div key={memory.id} className="luna-surface flex items-start gap-3 rounded-[20px] p-3">
              <div className="min-w-0 flex-1"><p className="text-[11px] uppercase tracking-[0.12em] text-gold">{memory.category.replace(/_/g, ' ')}</p><p className="mt-1 text-sm leading-5 text-lavender">{memory.memory_value}</p></div>
              <button type="button" onClick={() => void removeMemory(memory.id)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.045] text-lavender" aria-label={language === 'en' ? 'Delete memory' : 'Удалить воспоминание'}><X size={15} /></button>
            </div>
          )) : <p className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-lavender">{language === 'en' ? 'Luna has not saved any helpful details yet.' : 'Luna пока не сохранила полезных деталей.'}</p>}
        </section>
        <button type="button" onClick={() => void removeAllMemory()} disabled={!memories.length} className="w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-lavender disabled:opacity-40">{language === 'en' ? 'Clear Luna Memory' : 'Очистить память Luna'}</button>
        <button type="button" onClick={() => void removeHistory()} className="w-full rounded-[18px] border border-gold/15 bg-gold/[0.06] px-4 py-3 text-sm font-semibold text-gold">{language === 'en' ? 'Delete conversation history' : 'Удалить историю разговоров'}</button>
        {settingsMessage ? <p className="rounded-2xl border border-gold/15 bg-gold/10 px-3 py-2 text-xs text-gold">{settingsMessage}</p> : null}
      </ProfileChildScreen>
    );
  }

  if (view === 'more') {
    return (
      <ProfileChildScreen title={language === 'en' ? 'More Settings' : 'Ещё настройки'} onBack={() => setView('main')} language={language}>
        <section className="luna-surface rounded-[24px] p-2">
          <ProfileSettingsRow icon={Upload} title={copy[language].addHomeTitle} value={homeScreenMessage || ''} onClick={onAddHome} />
          <ProfileSettingsRow icon={Heart} title={language === 'en' ? 'Support' : 'Поддержка'} value={language === 'en' ? 'Contact' : 'Связь'} onClick={onLuna} />
          <ProfileSettingsRow icon={Bot} title={language === 'en' ? 'Luna Memory' : 'Память Luna'} value={language === 'en' ? 'Privacy' : 'Приватность'} onClick={() => setView('memory')} />
          <ProfileSettingsRow icon={Lock} title={language === 'en' ? 'Privacy Policy' : 'Политика приватности'} value="" onClick={() => setView('privacy')} />
          <ProfileSettingsRow icon={CheckCircle} title={language === 'en' ? 'Terms of Use' : 'Условия использования'} value="" onClick={() => setView('terms')} />
          <ProfileSettingsRow icon={Heart} title={language === 'en' ? 'Meditation Disclaimer' : 'Дисклеймер медитаций'} value="" onClick={() => setView('disclaimer')} />
          {showAdminButton && <ProfileSettingsRow icon={Settings} title="Admin" value={language === 'en' ? 'Developer' : 'Разработка'} onClick={onAdmin} />}
        </section>
        <button onClick={() => setLogoutOpen(true)} className="mt-4 w-full rounded-[20px] border border-white/10 bg-white/[0.035] px-4 py-3 text-left text-sm text-lavender">
          {copy[language].logout}
        </button>
        <p className="mt-3 text-center text-[11px] text-cream/38">Luna Meditation · Version {APP_VERSION}</p>
        {logoutOpen && (
          <div className="fixed inset-0 z-40 grid place-items-end bg-night/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#111936] p-4 shadow-glow">
              <h3 className="text-lg font-semibold text-cream">{language === 'en' ? 'Log out of Luna?' : 'Выйти из Luna?'}</h3>
              <p className="mt-2 text-sm leading-6 text-lavender">
                {language === 'en' ? 'This clears local app data on this device. Your Luna account and purchases stay safe.' : 'Это очистит локальные данные приложения на этом устройстве. Аккаунт Luna и покупки сохранятся.'}
              </p>
              <button onClick={closeLocalSession} className="mt-4 w-full rounded-[18px] border border-gold/20 bg-gold/10 px-4 py-3 text-sm font-semibold text-gold">
                {language === 'en' ? 'Log out' : 'Выйти'}
              </button>
              <button onClick={() => setLogoutOpen(false)} className="mt-2 w-full rounded-[18px] bg-white/[0.055] px-4 py-3 text-sm font-semibold text-lavender">
                {language === 'en' ? 'Cancel' : 'Отмена'}
              </button>
            </div>
          </div>
        )}
      </ProfileChildScreen>
    );
  }

  if (view === 'privacy' || view === 'terms' || view === 'disclaimer') {
    const title = view === 'privacy'
      ? (language === 'en' ? 'Privacy Policy' : 'Политика приватности')
      : view === 'terms'
        ? (language === 'en' ? 'Terms of Use' : 'Условия использования')
        : (language === 'en' ? 'Meditation Disclaimer' : 'Дисклеймер медитаций');
    const body = view === 'disclaimer'
      ? (language === 'en'
        ? ['Luna provides wellness and relaxation content.', 'It is not medical or mental-health treatment and does not replace professional care.', 'If you feel urgent or serious symptoms, please seek qualified local support or emergency help.']
        : ['Luna предлагает контент для расслабления и заботы о себе.', 'Это не медицинское или психотерапевтическое лечение и не замена профессиональной помощи.', 'При срочных или серьёзных симптомах обратись за квалифицированной местной помощью или в экстренные службы.'])
      : view === 'privacy'
        ? (language === 'en'
          ? ['Luna uses your Telegram Mini App session to keep your profile, progress, purchases, favorites, and preferences connected to your account.', 'Your wellness settings are used to personalize Luna inside the app. Contact support if you want help with account or data questions.']
          : ['Luna использует сессию Telegram Mini App, чтобы связать профиль, прогресс, покупки, избранное и настройки с твоим аккаунтом.', 'Твои wellness-настройки используются для персонализации Luna внутри приложения. По вопросам аккаунта или данных обратись в поддержку.'])
        : (language === 'en'
          ? ['By using Luna, you agree to use the app for personal wellness and relaxation.', 'Premium access, payments, and availability are handled through Telegram Stars and the Luna bot experience.']
          : ['Используя Luna, ты соглашаешься применять приложение для личного wellness и расслабления.', 'Premium-доступ, платежи и доступность обрабатываются через Telegram Stars и опыт Luna bot.']);
    return (
      <ProfileChildScreen title={title} onBack={() => setView('more')} language={language}>
        <section className="luna-surface space-y-3 rounded-[24px] p-4">
          {body.map((line) => <p key={line} className="text-sm leading-6 text-lavender">{line}</p>)}
        </section>
      </ProfileChildScreen>
    );
  }

  return (
    <div className="luna-page space-y-4 pb-[calc(98px+env(safe-area-inset-bottom))]">
      <div>
        <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-cream">{copy[language].profile}</h2>
      </div>

      <section className="flex items-center gap-4 px-1">
        <button
          onClick={() => setAvatarActionsOpen(true)}
          className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-gold/30 bg-white/[0.045] shadow-glow focus:outline-none focus:ring-2 focus:ring-gold/35"
          aria-label={language === 'en' ? 'Change profile photo' : 'Изменить фото профиля'}
        >
          {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <MoonMark className="h-full w-full border-0" />}
          <span className="absolute -bottom-1 -right-1 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-night/90 text-gold shadow-glow backdrop-blur">
            <Camera size={17} />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[25px] font-semibold leading-tight tracking-[-0.04em] text-cream">{firstName}</h3>
          <p className="mt-1 text-sm font-semibold text-gold">{access.hasPremium ? `◆ ${localizedPlanStatus}` : localizedPlanStatus}</p>
          <p className="mt-0.5 truncate text-xs text-lavender">{username ? `@${username}` : copy[language].member}</p>
        </div>
      </section>

      {avatarMessage && <p className="rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 text-xs text-lavender" role="status">{avatarMessage}</p>}
      {avatarBusy && <div className="h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${Math.max(8, avatarProgress)}%` }} /></div>}

      <section className="luna-surface rounded-[26px] p-2">
        <ProfileSettingsRow icon={Target} title={language === 'en' ? 'Goals' : 'Цели'} value={goalsLabel} onClick={() => setView('goals')} />
        <ProfileSettingsRow icon={Bell} title={language === 'en' ? 'Notifications' : 'Уведомления'} value={notificationLabel} onClick={() => setView('notifications')} />
        <ProfileSettingsRow icon={Bot} title={language === 'en' ? 'AI Companion' : 'AI-компаньон'} value={companionStatus} onClick={onLuna} />
        <ProfileSettingsRow icon={CreditCard} title={language === 'en' ? 'Subscription' : 'Подписка'} value={localizedPlanStatus} onClick={() => setView('subscription')} />
        <ProfileSettingsRow icon={Globe2} title={copy[language].language} value={languageLabel} onClick={() => setView('language')} />
        <ProfileSettingsRow icon={Settings} title={language === 'en' ? 'More Settings' : 'Ещё настройки'} value="" onClick={() => setView('more')} />
      </section>

      {avatarActionsOpen && (
        <div className="fixed inset-0 z-40 grid place-items-end bg-night/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#111936] p-3 shadow-glow">
            <button disabled={avatarBusy} onClick={() => chooseInputRef.current?.click()} className="w-full rounded-[18px] px-4 py-3 text-left text-sm font-semibold text-cream">{language === 'en' ? 'Choose photo' : 'Выбрать фото'}</button>
            <button disabled={avatarBusy} onClick={() => cameraInputRef.current?.click()} className="w-full rounded-[18px] px-4 py-3 text-left text-sm font-semibold text-cream">{language === 'en' ? 'Take photo' : 'Сделать фото'}</button>
            {avatarUrl && <button disabled={avatarBusy} onClick={() => void removeAvatar()} className="w-full rounded-[18px] px-4 py-3 text-left text-sm font-semibold text-gold">{language === 'en' ? 'Remove photo' : 'Удалить фото'}</button>}
            <button disabled={avatarBusy} onClick={() => setAvatarActionsOpen(false)} className="mt-2 w-full rounded-[18px] bg-white/[0.055] px-4 py-3 text-center text-sm font-semibold text-lavender">{language === 'en' ? 'Cancel' : 'Отмена'}</button>
          </div>
        </div>
      )}
      <input ref={chooseInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void handleAvatarFile(event.currentTarget.files?.[0])} />
      <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="user" className="hidden" onChange={(event) => void handleAvatarFile(event.currentTarget.files?.[0])} />
    </div>
  );
}

function ProfileChildScreen({ title, onBack, language, children }: {
  title: string;
  onBack: () => void;
  language: AppLanguage;
  children: React.ReactNode;
}) {
  return (
    <div className="luna-page space-y-3 pb-[calc(34px+env(safe-area-inset-bottom))]">
      <button onClick={onBack} className="luna-icon-button transition active:scale-95" aria-label={language === 'en' ? 'Back' : 'Назад'}>
        ←
      </button>
      <h2 className="text-[24px] font-semibold tracking-[-0.04em] text-cream">{title}</h2>
      {children}
    </div>
  );
}

function ProfileSettingsRow({ icon: Icon, title, value, onClick }: {
  icon: typeof Target;
  title: string;
  value: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[14px] border border-white/10 bg-white/[0.045] text-lavender">
        <Icon size={17} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium text-cream">{title}</span>
      {value && <span className="max-w-[132px] truncate text-right text-xs text-lavender">{value}</span>}
      {onClick && <ChevronRight size={16} className="shrink-0 text-lavender/55" />}
    </>
  );

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex min-h-[52px] w-full items-center gap-3 rounded-[17px] px-3 text-left transition hover:bg-white/[0.035] active:scale-[0.99] disabled:cursor-default disabled:hover:bg-transparent"
    >
      {content}
    </button>
  );
}

function ProfileToggleRow({ title, checked, disabled = false, onChange }: {
  title: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button disabled={disabled} onClick={() => onChange(!checked)} className="flex min-h-[54px] w-full items-center justify-between rounded-[18px] px-4 text-left text-sm text-cream disabled:opacity-60">
      <span>{title}</span>
      <span className={`relative h-7 w-12 rounded-full transition ${checked ? 'bg-gold' : 'bg-white/12'}`} aria-hidden="true">
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-cream transition ${checked ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
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
    <div className="luna-card flex min-h-[78px] flex-col justify-between rounded-[20px] p-3">
      <p className="text-xs leading-4 text-lavender">{label}</p>
      <p className="mt-1 break-words font-semibold leading-5">{value}</p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="luna-surface rounded-[24px] p-4 text-center"><Sparkles className="mx-auto text-gold" /><h3 className="mt-3 font-serif text-xl font-semibold">{title}</h3><p className="mt-1 text-sm text-lavender">{body}</p></div>;
}

export default App;
