import { samplePractices, type Practice } from './data/practices';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export type AccessState = {
  hasPremium: boolean;
  plan: string;
  user?: {
    active_until?: string | null;
    lifetime_access?: boolean;
  };
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
  calmScore: number;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export async function syncUser(user: TelegramWebAppUser) {
  return request('/api/users/sync', {
    method: 'POST',
    body: JSON.stringify({
      telegram_id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      language_code: user.language_code
    })
  });
}

export async function getAccess(telegramId: number): Promise<AccessState> {
  return request(`/api/access/${telegramId}`);
}

export async function getPractices(): Promise<Practice[]> {
  try {
    const response = await request<{ practices: Practice[] }>('/api/practices');
    return response.practices.length ? response.practices : samplePractices;
  } catch {
    return samplePractices;
  }
}

export async function createInvoice(input: { chatId: number; telegramId: number; plan: 'monthly' | 'lifetime' }) {
  return request('/api/payments/invoice', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function completePractice(input: {
  telegram_id: number;
  practice_id: string;
  mood_before?: string;
  mood_after?: string;
}) {
  return request('/api/progress', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function getProfile(telegramId: number): Promise<ProfileStats> {
  return request(`/api/profile/${telegramId}`);
}
