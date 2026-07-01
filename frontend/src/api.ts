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

function telegramHeaders(initData?: string) {
  const headers: Record<string, string> = {};

  if (initData) {
    headers['x-telegram-init-data'] = initData;
  }

  return headers;
}

async function request<T>(path: string, options?: RequestInit, initData?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...telegramHeaders(initData) },
    ...options
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

export async function getPractices(): Promise<Practice[]> {
  try {
    const response = await request<{ practices: Practice[] }>('/api/practices');
    return response.practices.length ? response.practices : samplePractices;
  } catch {
    return samplePractices;
  }
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
