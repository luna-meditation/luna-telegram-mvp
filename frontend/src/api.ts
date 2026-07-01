const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export type AccessState = {
  hasPremium: boolean;
  plan: string;
  user?: {
    active_until?: string | null;
    lifetime_access?: boolean;
  };
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
    active_until?: string | null;
    lifetime_access?: boolean;
  };
  completed: number;
  dayStreak: number;
  currentStreak: number;
  longestStreak: number;
  minutesListened: number;
  purchasedPlan: string;
  calmScore: number;
  rewards: Record<7 | 14 | 30 | 100, boolean>;
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
};

function telegramHeaders(initData?: string) {
  const headers: Record<string, string> = {};

  if (initData) {
    headers['x-telegram-init-data'] = initData;
  }

  return headers;
}

async function request<T>(path: string, options?: RequestInit, initData?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...telegramHeaders(initData), ...options?.headers }
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
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
}, initData?: string) {
  return request('/api/history', {
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

export async function getProfile(initData?: string): Promise<ProfileStats> {
  return request('/api/profile/me', undefined, initData);
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
};

export async function getAdminDebug(initData?: string) {
  return request<AdminDebugInfo>('/api/debug/admin', undefined, initData);
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
