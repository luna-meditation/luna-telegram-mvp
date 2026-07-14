const configuredApiUrl = (import.meta.env.VITE_API_URL?.trim() ?? '').replace(/\/+$/, '');
const API_URL = configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:4000' : '');

export const apiDebugConfig = {
  apiBaseUrl: API_URL || window.location.origin,
  configuredApiUrl: configuredApiUrl || null,
  isUsingDevFallback: !configuredApiUrl && import.meta.env.DEV,
  isMissingProductionApiUrl: !configuredApiUrl && !import.meta.env.DEV
};

export class ApiRequestError extends Error {
  status: number | null;
  responseBody: string | null;
  requestUrl: string;

  constructor(message: string, requestUrl: string, status: number | null = null, responseBody: string | null = null) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.responseBody = responseBody;
    this.requestUrl = requestUrl;
  }
}

const inFlightRequests = new Map<string, Promise<unknown>>();

export type AccessState = {
  hasPremium: boolean;
  plan: string;
  user?: {
    language_code?: string | null;
    active_until?: string | null;
    lifetime_access?: boolean;
  };
};

export type AppLanguage = 'en' | 'ru';

export type MeditationTranslation = {
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  audioUrl?: string | null;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
};

export type Meditation = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  duration: number;
  cover_image: string;
  audio_file: string;
  premium: boolean;
  published: boolean;
  mood: 'Calm' | 'Stressed' | 'Focused' | 'Tired' | 'Anxious';
  play_count: number;
  created_at: string;
  translations?: Partial<Record<AppLanguage, MeditationTranslation>>;
  favorite?: boolean;
  history?: PlaybackHistory | null;
};

export type PlaybackHistory = {
  id: string;
  meditation_id: string;
  last_played: string;
  play_count: number;
  completion_percent: number;
  last_position: number;
  completed: boolean;
  meditation?: Meditation;
};

export type ProfileStats = {
  user?: {
    first_name?: string;
    username?: string;
    language_code?: string | null;
    active_until?: string | null;
    lifetime_access?: boolean;
    avatar_url?: string | null;
    profile_goals?: string[] | null;
    notification_preferences?: NotificationPreferences | null;
  };
  completed: number;
  completedMeditations?: number;
  completedBreathSessions?: number;
  dayStreak: number;
  currentStreak: number;
  longestStreak: number;
  freezeCount?: number;
  freezeMax?: number;
  lastFreezeUsed?: string | null;
  lastCleanWeekAwarded?: string | null;
  minutesListened: number;
  weeklyPracticeMinutes?: number;
  weeklyStats?: {
    listeningMinutes: number;
    completedSessions: number;
    checkins: number;
    completedDays: number;
  };
  lifetimeStats?: {
    totalListeningMinutes: number;
    totalSessions: number;
    longestStreak: number;
    practiceDays: number;
    completedWeeks: number;
  };
  currentWeek?: {
    weekStart: string;
    completedDays: number;
    completedSessions: number;
    listeningMinutes: number;
    days: Array<{
      key: string;
      label: string;
      state: 'completed' | 'current' | 'missed' | 'future' | 'freeze_used' | 'premium_freeze';
      minutes: number;
      sessions: number;
    }>;
  };
  moodTrend?: Array<{
    key: string;
    mood: DailyCheckin['mood'] | null;
  }>;
  totalPracticeMinutes?: number;
  calmPoints?: number;
  moonSeeds?: number;
  moonSeedsAvailable?: number;
  moonSeedsEarnedTotal?: number;
  plantedGardenElements?: string[];
  plantedElementsCount?: number;
  lastMoonSeedEarnedAt?: string | null;
  gardenLevel?: number;
  streakDays?: number;
  lastPracticeDate?: string | null;
  purchasedPlan: string;
  calmScore: number;
  rewards: Record<7 | 14 | 30 | 100, boolean>;
  achievements?: {
    unlocked: number;
    total: number;
    items: Array<{
      id: string;
      title: string;
      description: string;
      category: string;
      unlocked: boolean;
      unlockedAt?: string | null;
      progress?: number;
    }>;
  };
};

export type NotificationPreferences = {
  dailyReminder: boolean;
  newContent: boolean;
  reminderTime: string;
  timezone: string;
};

export type DailyCheckin = {
  id?: string;
  telegram_id?: number;
  sleep_range: 'less_than_4' | '4_6' | '6_8' | '8_plus' | null;
  mood: 'calm' | 'stressed' | 'tired' | 'anxious' | 'focused' | 'low_energy';
  available_minutes: '3' | '5' | '10' | '15_plus' | null;
  local_date: string;
  created_at?: string;
};

export type DailyCheckinPayload = Pick<DailyCheckin, 'mood'> & Partial<Pick<DailyCheckin, 'sleep_range' | 'available_minutes'>> & {
  local_date?: string;
  telegram_id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

export type WellnessSummary = {
  todayCheckin: DailyCheckin | null;
  weeklyCheckins: DailyCheckin[];
  weeklyCheckinCount: number;
  averageSleepHours: number;
  averageSleepLabel: string;
  mostCommonMood: DailyCheckin['mood'] | null;
  mostCommonMoodLabel: string;
  weeklyInsight: string;
  recommendedFocus: string;
  level: {
    title: string;
    current: number;
    progress: number;
    next: string;
  };
  achievements: Array<{
    id: string;
    title: string;
    description: string;
    unlocked: boolean;
  }>;
};

export type MeditationPayload = {
  title: string;
  subtitle: string;
  description: string;
  category: string;
  duration: number;
  cover_image: string;
  audio_file: string;
  premium: boolean;
  published: boolean;
  mood: Meditation['mood'];
  translations?: Partial<Record<AppLanguage, MeditationTranslation>>;
};

export type LunaConversationSummary = {
  id: string;
  title: string;
  language: AppLanguage;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
  last_message_at: string;
  latestMessage: string;
};

export type LunaMessage = {
  id: string;
  request_id?: string | null;
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    recommendedMeditationId?: string | null;
    meditationAction?: {
      type: 'meditation_card';
      meditationId: string;
    } | null;
    recommendedMeditation?: Meditation | null;
    safetyState?: string;
  };
  created_at: string;
};

export type LunaMemory = {
  id: string;
  category: string;
  memory_key: string;
  memory_value: string;
  created_at: string;
  updated_at: string;
};

function telegramHeaders(initData?: string) {
  const headers: Record<string, string> = {};

  if (initData) {
    headers['x-telegram-init-data'] = initData;
  }

  return headers;
}

async function request<T>(path: string, options?: RequestInit, initData?: string): Promise<T> {
  const requestUrl = `${API_URL}${path}`;
  const method = options?.method ?? 'GET';
  const dedupeKey = `${method}:${requestUrl}:${initData ?? ''}`;

  if (method === 'GET' && inFlightRequests.has(dedupeKey)) {
    return inFlightRequests.get(dedupeKey) as Promise<T>;
  }

  const promise = executeRequest<T>(requestUrl, options, initData);

  if (method === 'GET') {
    inFlightRequests.set(dedupeKey, promise);
    promise.then(
      () => inFlightRequests.delete(dedupeKey),
      () => inFlightRequests.delete(dedupeKey)
    );
  }

  return promise;
}

async function executeRequest<T>(requestUrl: string, options?: RequestInit, initData?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(requestUrl, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...telegramHeaders(initData), ...options?.headers }
    });
  } catch (error) {
    throw new ApiRequestError(error instanceof Error ? error.message : 'Network request failed.', requestUrl);
  }

  const responseBody = await response.text();
  if (!response.ok) {
    throw new ApiRequestError(`Request failed: ${response.status}`, requestUrl, response.status, responseBody);
  }

  try {
    return JSON.parse(responseBody) as T;
  } catch {
    throw new ApiRequestError('API response was not valid JSON.', requestUrl, response.status, responseBody);
  }
}

export async function syncUser(user: TelegramWebAppUser, initData?: string) {
  return request('/api/users/sync', {
    method: 'POST',
    body: JSON.stringify({
      telegram_id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      language_code: user.language_code
    })
  }, initData);
}

export async function getAccess(initData?: string): Promise<AccessState> {
  return request('/api/access/me', undefined, initData);
}

export async function getCategories(): Promise<Category[]> {
  const response = await request<{ categories: Category[] }>('/api/categories');
  return response.categories;
}

export async function getMeditations(initData?: string): Promise<Meditation[]> {
  const response = await request<{ meditations: Meditation[] }>('/api/meditations', undefined, initData);
  return response.meditations;
}

export async function getFavorites(initData?: string): Promise<Meditation[]> {
  const response = await request<{ favorites: Meditation[] }>('/api/favorites', undefined, initData);
  return response.favorites;
}

export async function setFavorite(meditationId: string, favorite: boolean, initData?: string) {
  return request<{ favorite: boolean }>(`/api/favorites/${meditationId}`, {
    method: 'POST',
    body: JSON.stringify({ favorite })
  }, initData);
}

export async function getHistory(initData?: string): Promise<PlaybackHistory[]> {
  const response = await request<{ history: PlaybackHistory[] }>('/api/history', undefined, initData);
  return response.history;
}

export async function saveHistory(input: {
  meditation_id: string;
  last_position: number;
  duration: number;
  completed?: boolean;
  session_id?: string;
  local_date?: string;
}, initData?: string) {
  return request<{
    completion_percent: number;
    completed: boolean;
    moonSeedsAwarded?: number;
    completionBonusAwarded?: boolean;
  }>('/api/history', {
    method: 'POST',
    body: JSON.stringify(input)
  }, initData);
}

export async function startPlaybackSession(meditationId: string, localDate: string, initData?: string) {
  return request<{ id: string; meditation_id: string; listened_seconds: number }>('/api/history/session', {
    method: 'POST',
    body: JSON.stringify({ meditation_id: meditationId, local_date: localDate })
  }, initData);
}

export async function heartbeatPlaybackSession(sessionId: string, lastPosition: number, initData?: string) {
  return request<{ ok: boolean; listened_seconds: number; intervalAccepted: boolean }>('/api/history/session/heartbeat', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, last_position: lastPosition })
  }, initData);
}

export async function saveBreathSession(input: {
  mode: 'calm' | 'box' | 'reset';
  duration_seconds: number;
  breath_count: number;
  local_date?: string;
}, initData?: string) {
  return request('/api/breath-sessions', {
    method: 'POST',
    body: JSON.stringify(input)
  }, initData);
}

export async function plantMoonGardenElement(elementId: string, initData?: string) {
  return request<{
    planted: boolean;
    elementId: string;
    moonSeedsAvailable: number;
    plantedGardenElements: string[];
    profile: ProfileStats;
  }>('/api/moon-garden/plant', {
    method: 'POST',
    body: JSON.stringify({ elementId })
  }, initData);
}

export type MoonGardenDevAction = 'grant_100' | 'grant_seeds' | 'unlock_full' | 'reset' | 'reset_all' | 'reset_planted' | 'set_balance' | 'set_stage';

export async function updateMoonGardenDevState(input: {
  action: MoonGardenDevAction;
  seedBalance?: number;
  amount?: number;
  stageLevel?: number;
}, initData?: string) {
  return request<{
    ok: boolean;
    moonSeedsAvailable: number;
    moonSeedsEarnedTotal: number;
    plantedGardenElements: string[];
    profile: ProfileStats;
  }>('/api/moon-garden/dev', {
    method: 'POST',
    body: JSON.stringify(input)
  }, initData);
}

export async function recordSceneMoonSeed(input: {
  scene_id: string;
  duration_seconds: number;
  local_date?: string;
}, initData?: string) {
  return request<{ awarded: boolean; moonSeeds: number }>('/api/scene-sessions/moon-seed', {
    method: 'POST',
    body: JSON.stringify(input)
  }, initData);
}

export async function createInvoiceLink(plan: 'monthly' | 'lifetime', initData?: string) {
  return request<{ invoiceLink: string }>('/api/payments/invoice-link', {
    method: 'POST',
    body: JSON.stringify({ plan })
  }, initData);
}

export async function completePractice(input: {
  practice_id: string;
  mood_before?: string;
  mood_after?: string;
}, initData?: string) {
  return request('/api/progress', {
    method: 'POST',
    body: JSON.stringify(input)
  }, initData);
}

export async function getTodayCheckin(initData?: string, localDate?: string): Promise<DailyCheckin | null> {
  const response = await request<{ checkin: DailyCheckin | null }>(`/api/checkins/today${localDate ? `?local_date=${encodeURIComponent(localDate)}` : ''}`, undefined, initData);
  return response.checkin;
}

export async function saveDailyCheckin(input: DailyCheckinPayload, initData?: string): Promise<DailyCheckin> {
  const response = await request<{ checkin: DailyCheckin }>('/api/checkins', {
    method: 'POST',
    body: JSON.stringify(input)
  }, initData);
  return response.checkin;
}

export async function getWellnessSummary(initData?: string, localDate?: string): Promise<WellnessSummary> {
  return request(`/api/wellness/summary${localDate ? `?local_date=${encodeURIComponent(localDate)}` : ''}`, undefined, initData);
}

export async function getProfile(initData?: string, localDate?: string): Promise<ProfileStats> {
  return request(`/api/profile/me${localDate ? `?local_date=${encodeURIComponent(localDate)}` : ''}`, undefined, initData);
}

export async function getLunaConversations(initData?: string) {
  const response = await request<{ conversations: LunaConversationSummary[] }>('/api/luna/conversations', undefined, initData);
  return response.conversations;
}

export async function getLunaHealth(initData?: string) {
  return request<{ available: boolean; enabled: boolean; model: string; errorClass: string | null }>('/api/luna/health', undefined, initData);
}

export async function getLunaConversation(conversationId: string, initData?: string) {
  return request<{ conversation: LunaConversationSummary; messages: LunaMessage[] }>(`/api/luna/conversations/${conversationId}`, undefined, initData);
}

export async function sendLunaMessage(input: {
  conversationId?: string;
  message: string;
  language: AppLanguage;
  requestId: string;
}, initData?: string) {
  return request<{ conversationId: string; message: LunaMessage; duplicate: boolean; remaining: number; requestState: 'completed' }>('/api/luna/chat', {
    method: 'POST',
    body: JSON.stringify(input)
  }, initData);
}

export async function deleteLunaConversation(conversationId: string, initData?: string) {
  return request<{ ok: true }>(`/api/luna/conversations/${conversationId}`, { method: 'DELETE' }, initData);
}

export async function clearLunaConversations(initData?: string) {
  return request<{ ok: true }>('/api/luna/conversations', { method: 'DELETE' }, initData);
}

export async function getLunaMemory(initData?: string) {
  return request<{ enabled: boolean; available: boolean; memories: LunaMemory[] }>('/api/luna/memory', undefined, initData);
}

export async function setLunaMemoryEnabled(enabled: boolean, initData?: string) {
  return request<{ ok: true; enabled: boolean }>('/api/luna/memory', { method: 'PATCH', body: JSON.stringify({ enabled }) }, initData);
}

export async function deleteLunaMemory(memoryId: string, initData?: string) {
  return request<{ ok: true }>(`/api/luna/memory/${memoryId}`, { method: 'DELETE' }, initData);
}

export async function clearLunaMemory(initData?: string) {
  return request<{ ok: true }>('/api/luna/memory', { method: 'DELETE' }, initData);
}

export async function updateUserLanguage(language: AppLanguage, initData?: string) {
  return request<{ user: unknown }>('/api/profile/language', {
    method: 'POST',
    body: JSON.stringify({ language })
  }, initData);
}

export async function updateProfileGoals(goals: string[], initData?: string) {
  return request<{ user: { profile_goals: string[] } }>('/api/profile/goals', {
    method: 'POST',
    body: JSON.stringify({ goals })
  }, initData);
}

export async function updateNotificationPreferences(preferences: NotificationPreferences, initData?: string) {
  return request<{ user: { notification_preferences: NotificationPreferences } }>('/api/profile/notifications', {
    method: 'POST',
    body: JSON.stringify(preferences)
  }, initData);
}

export async function removeProfileAvatar(initData?: string) {
  return request<{ user: { avatar_url?: string | null } }>('/api/profile/avatar', { method: 'DELETE' }, initData);
}

export async function checkAdmin(initData?: string) {
  return request<{ admin: boolean }>('/api/admin/me', undefined, initData);
}

export type AdminDebugInfo = {
  telegramUserId: number | null;
  adminTelegramId: number | null;
  isAdmin: boolean;
  authenticationStatus: string;
  authenticationError: string | null;
  apiBaseUrl?: string;
  configuredApiUrl?: string | null;
  requestUrl?: string | null;
  httpStatus?: number | null;
  responseBody?: string | null;
};

export async function getAdminDebug(initData?: string) {
  return request<AdminDebugInfo>('/api/debug/admin', undefined, initData);
}

export type AdminUser = {
  telegram_id: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  created_at: string;
  last_seen_at: string;
  active_until?: string | null;
  lifetime_access: boolean;
  premiumStatus: 'free' | 'monthly' | 'lifetime' | 'expired';
  totalMinutesListened: number;
  completedMeditations: number;
  currentStreak: number;
  longestStreak: number;
  totalStars: number;
};

export type AdminPayment = {
  telegram_id: number;
  plan: 'monthly' | 'lifetime';
  amount_stars: number;
  status: string;
  created_at: string;
  expiryDate?: string | null;
  user?: {
    username?: string | null;
    first_name?: string | null;
  } | null;
};

export type AdminMeditationStat = {
  id: string;
  title: string;
  category: string;
  premium: boolean;
  published: boolean;
  play_count: number;
  duration: number;
  created_at: string;
  updated_at: string;
  completionRate: number;
  listeningMinutes: number;
};

export type AdminChartPoint = {
  date: string;
  value: number;
};

export type AdminDashboardData = {
  users: {
    totalRegistered: number;
    newToday: number;
    newThisWeek: number;
    activeToday: number;
    activeThisMonth: number;
  };
  subscriptions: {
    freeUsers: number;
    monthlySubscribers: number;
    lifetimeSubscribers: number;
    activePremiumUsers: number;
    expiredPremiumUsers: number;
  };
  revenue: {
    totalStars: number;
    todayStars: number;
    monthStars: number;
    revenueByPlan: { monthly: number; lifetime: number };
    averageRevenuePerPayingUser: number;
    conversionRate: number;
    latestPurchases: AdminPayment[];
  };
  meditations: {
    total: number;
    published: number;
    drafts: number;
    mostPlayed: AdminMeditationStat | null;
    totalListeningMinutes: number;
    averageCompletionRate: number;
    items: AdminMeditationStat[];
  };
  topUsers: {
    topListeners: AdminUser[];
    longestStreaks: AdminUser[];
    mostCompleted: AdminUser[];
  };
  recentActivity: {
    latestRegistrations: AdminUser[];
    latestPurchases: AdminPayment[];
    latestMeditationPlays: Array<{
      telegram_id: number;
      last_played: string;
      play_count: number;
      completion_percent: number;
      user?: { username?: string | null; first_name?: string | null } | null;
      meditation?: { title?: string | null } | null;
    }>;
    latestCheckins: Array<DailyCheckin & {
      user?: { username?: string | null; first_name?: string | null } | null;
    }>;
    latestAdminUploads: AdminMeditationStat[];
  };
  wellness?: {
    totalCheckins: number;
    checkinsToday: number;
    checkinsThisWeek: number;
    mostCommonMood: DailyCheckin['mood'] | null;
    mostCommonMoodLabel: string;
    averageSleepLabel: string;
    mostRequestedDuration: DailyCheckin['available_minutes'] | null;
    latestCheckins: Array<DailyCheckin & {
      user?: { username?: string | null; first_name?: string | null } | null;
    }>;
  };
  charts: {
    registrationsByDay: AdminChartPoint[];
    purchasesByDay: AdminChartPoint[];
    revenueByDay: AdminChartPoint[];
    listeningMinutesByDay: AdminChartPoint[];
    meditationPlaysByDay: AdminChartPoint[];
  };
  usersList: AdminUser[];
  subscriptionsList: AdminUser[];
  purchaseHistory: AdminPayment[];
};

export async function getAdminDashboard(initData?: string) {
  return request<AdminDashboardData>('/api/admin/dashboard', undefined, initData);
}

export async function updateAdminUserAccess(telegramId: number, action: 'grant_monthly' | 'grant_lifetime' | 'extend_monthly' | 'remove_premium', initData?: string) {
  return request<{ user: unknown }>(`/api/admin/users/${telegramId}/access`, {
    method: 'POST',
    body: JSON.stringify({ action })
  }, initData);
}

export async function getAdminMeditations(initData?: string): Promise<Meditation[]> {
  const response = await request<{ meditations: Meditation[] }>('/api/admin/meditations', undefined, initData);
  return response.meditations;
}

export async function uploadAdminAsset(
  kind: 'audio' | 'cover',
  file: File,
  initData?: string,
  onProgress?: (progress: number) => void
) {
  return new Promise<{ path: string; publicUrl: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${API_URL}/api/admin/storage/${kind}`);
    request.setRequestHeader('content-type', file.type);
    request.setRequestHeader('x-file-name', file.name);

    for (const [key, value] of Object.entries(telegramHeaders(initData))) {
      request.setRequestHeader(key, value);
    }

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve(JSON.parse(request.responseText) as { path: string; publicUrl: string });
        return;
      }

      try {
        const parsed = JSON.parse(request.responseText) as { error?: string };
        reject(new Error(parsed.error || `Upload failed: ${request.status}`));
      } catch {
        reject(new Error(`Upload failed: ${request.status}`));
      }
    };

    request.onerror = () => reject(new Error('Upload failed. Please check your connection and try again.'));
    request.send(file);
  });
}

export async function uploadProfileAvatar(
  file: Blob,
  initData?: string,
  onProgress?: (progress: number) => void
) {
  return new Promise<{ avatarUrl: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${API_URL}/api/profile/avatar`);
    request.setRequestHeader('content-type', file.type || 'image/webp');
    request.setRequestHeader('x-file-name', 'avatar.webp');

    for (const [key, value] of Object.entries(telegramHeaders(initData))) {
      request.setRequestHeader(key, value);
    }

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        const parsed = JSON.parse(request.responseText) as { avatarUrl: string };
        resolve(parsed);
        return;
      }

      try {
        const parsed = JSON.parse(request.responseText) as { error?: string };
        reject(new Error(parsed.error || `Upload failed: ${request.status}`));
      } catch {
        reject(new Error(`Upload failed: ${request.status}`));
      }
    };

    request.onerror = () => reject(new Error('Upload failed. Please check your connection and try again.'));
    request.send(file);
  });
}

export async function createMeditation(input: MeditationPayload, initData?: string) {
  return request<{ meditation: Meditation }>('/api/admin/meditations', {
    method: 'POST',
    body: JSON.stringify(input)
  }, initData);
}

export async function updateMeditation(id: string, input: Partial<MeditationPayload>, initData?: string) {
  return request<{ meditation: Meditation }>(`/api/admin/meditations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  }, initData);
}

export async function deleteMeditation(id: string, initData?: string) {
  return request<{ ok: boolean }>(`/api/admin/meditations/${id}`, { method: 'DELETE' }, initData);
}

export async function saveCategory(input: { name: string; slug: string; sort_order?: number }, initData?: string) {
  return request<{ category: Category }>('/api/admin/categories', {
    method: 'POST',
    body: JSON.stringify(input)
  }, initData);
}
