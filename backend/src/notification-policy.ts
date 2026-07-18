export const reminderTypes = ['daily', 'morning', 'evening', 'streak_risk', 'inactivity', 'weekly_summary'] as const;
export type ReminderType = typeof reminderTypes[number];

export type NotificationPreferences = {
  remindersEnabled: boolean;
  reminderTypes: ReminderType[];
  reminderTime: string;
  timezone: string;
  consentedAt: string | null;
  dailyReminder: boolean;
  newContent: boolean;
};

function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeNotificationPreferences(input: Partial<NotificationPreferences> = {}): NotificationPreferences {
  const reminderTime = typeof input.reminderTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.reminderTime)
    ? input.reminderTime
    : '21:00';
  const timezone = typeof input.timezone === 'string' && input.timezone.length <= 64 && isTimeZone(input.timezone)
    ? input.timezone
    : 'UTC';
  const selectedTypes = Array.isArray(input.reminderTypes)
    ? Array.from(new Set(input.reminderTypes.filter((value): value is ReminderType => reminderTypes.includes(value as ReminderType))))
    : [];
  const legacyEnabled = Boolean(input.dailyReminder);
  const remindersEnabled = Boolean(input.remindersEnabled ?? legacyEnabled);

  return {
    remindersEnabled,
    reminderTypes: selectedTypes.length ? selectedTypes : (remindersEnabled ? ['daily'] : []),
    reminderTime,
    timezone,
    consentedAt: remindersEnabled && typeof input.consentedAt === 'string' && !Number.isNaN(Date.parse(input.consentedAt))
      ? input.consentedAt
      : null,
    dailyReminder: remindersEnabled,
    newContent: false
  };
}

export function localReminderClock(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short'
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    localDate: `${value('year')}-${value('month')}-${value('day')}`,
    localTime: `${value('hour')}:${value('minute')}`,
    weekday: value('weekday')
  };
}

export function dueReminderTypes(input: {
  preferences: Partial<NotificationPreferences>;
  now: Date;
  currentStreak?: number;
  lastPracticeDate?: string | null;
  lastSeenAt?: string | null;
}) {
  const preferences = normalizeNotificationPreferences(input.preferences);
  if (!preferences.remindersEnabled || !preferences.consentedAt) return [];
  const clock = localReminderClock(input.now, preferences.timezone);
  if (clock.localTime !== preferences.reminderTime) return [];

  const inactivityMs = input.lastSeenAt ? input.now.getTime() - new Date(input.lastSeenAt).getTime() : 0;
  return preferences.reminderTypes.filter((type) => {
    if (type === 'weekly_summary') return clock.weekday === 'Sun';
    if (type === 'streak_risk') return Number(input.currentStreak ?? 0) > 0 && input.lastPracticeDate !== clock.localDate;
    if (type === 'inactivity') return inactivityMs >= 72 * 60 * 60 * 1000;
    return true;
  });
}

export function reminderIdempotencyKey(telegramId: number, type: ReminderType, localDate: string) {
  return `${telegramId}:${type}:${localDate}`;
}
