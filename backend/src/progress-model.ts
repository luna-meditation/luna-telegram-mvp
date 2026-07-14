export type PracticeDayRow = {
  local_date?: string | null;
  source?: string | null;
  minutes?: number | null;
  sessions?: number | null;
};

export type VerifiedPlaybackRow = {
  local_date?: string | null;
  listened_seconds?: number | null;
  completed_at?: string | null;
};

function dateFromKey(key: string) {
  return new Date(`${key}T12:00:00Z`);
}

export function mondayForDateKey(localDate: string) {
  const date = dateFromKey(localDate);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function buildCanonicalCurrentWeek(input: {
  localDate: string;
  practiceDays: PracticeDayRow[];
  playbackSessions?: VerifiedPlaybackRow[];
  lastFreezeUsed?: string | null;
}) {
  const weekStart = mondayForDateKey(input.localDate);
  const monday = dateFromKey(weekStart);
  const playbackActivity = (input.playbackSessions ?? []).reduce<Record<string, { listenedSeconds: number; sessions: number }>>((map, item) => {
    if (!item.local_date) return map;
    const previous = map[item.local_date] ?? { listenedSeconds: 0, sessions: 0 };
    map[item.local_date] = {
      listenedSeconds: previous.listenedSeconds + Math.max(0, Number(item.listened_seconds ?? 0)),
      sessions: previous.sessions + (item.completed_at ? 1 : 0)
    };
    return map;
  }, {});

  const activity = input.practiceDays.reduce<Record<string, { minutes: number; sessions: number }>>((map, item) => {
    if (!item.local_date) return map;
    // A verified playback session is authoritative for meditation activity on that day.
    if (item.source === 'meditation' && playbackActivity[item.local_date]) return map;
    const previous = map[item.local_date] ?? { minutes: 0, sessions: 0 };
    map[item.local_date] = {
      minutes: previous.minutes + Math.max(0, Number(item.minutes ?? 0)),
      sessions: previous.sessions + (item.source === 'scene' ? 0 : Math.max(0, Number(item.sessions ?? 0)))
    };
    return map;
  }, {});

  Object.entries(playbackActivity).forEach(([key, item]) => {
    const previous = activity[key] ?? { minutes: 0, sessions: 0 };
    activity[key] = {
      minutes: previous.minutes + Math.floor(item.listenedSeconds / 60),
      sessions: previous.sessions + item.sessions
    };
  });

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    const totals = activity[key] ?? { minutes: 0, sessions: 0 };
    const completed = totals.minutes >= 1 || totals.sessions >= 1;
    return {
      key,
      label: key,
      state: completed
        ? 'completed' as const
        : input.lastFreezeUsed === key
          ? 'freeze_used' as const
          : key > input.localDate
            ? 'future' as const
            : key === input.localDate
              ? 'current' as const
              : 'missed' as const,
      minutes: totals.minutes,
      sessions: totals.sessions
    };
  });

  return {
    weekStart,
    days,
    completedDays: days.filter((item) => item.state === 'completed').length,
    completedSessions: days.reduce((sum, item) => sum + item.sessions, 0),
    listeningMinutes: days.reduce((sum, item) => sum + item.minutes, 0)
  };
}
