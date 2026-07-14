export type PlaybackRange = [number, number];

export class PlaybackInputError extends Error {
  readonly code = 'invalid_playback_input';

  constructor(field: string, reason: string) {
    super(`${field} ${reason}`);
    this.name = 'PlaybackInputError';
  }
}

export function normalizePlaybackSeconds(
  value: unknown,
  options: {
    field: string;
    duration?: number;
    fallback?: number;
    required?: boolean;
  }
) {
  let rawValue = value;
  if (rawValue === undefined || rawValue === null) {
    if (options.required) {
      throw new PlaybackInputError(options.field, 'is required.');
    }
    rawValue = options.fallback ?? 0;
  }

  if (typeof rawValue === 'string' && rawValue.trim() === '') {
    throw new PlaybackInputError(options.field, 'must be a finite non-negative number.');
  }

  if (typeof rawValue !== 'number' && typeof rawValue !== 'string') {
    throw new PlaybackInputError(options.field, 'must be a finite non-negative number.');
  }

  const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new PlaybackInputError(options.field, 'must be a finite non-negative number.');
  }

  const normalized = Math.floor(numericValue);
  if (options.duration === undefined) return normalized;

  const numericDuration = Number(options.duration);
  if (!Number.isFinite(numericDuration) || numericDuration < 0) {
    throw new PlaybackInputError('duration', 'must be a finite non-negative number.');
  }

  return Math.min(normalized, Math.floor(numericDuration));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export function normalizePlaybackRanges(value: unknown, duration: number): PlaybackRange[] {
  const safeDuration = Math.max(1, normalizePlaybackSeconds(duration, { field: 'duration' }));
  if (!Array.isArray(value)) return [];

  const ranges = value
    .filter((item): item is [number, number] => Array.isArray(item) && item.length >= 2)
    .map(([start, end]) => {
      try {
        return [
          normalizePlaybackSeconds(start, { field: 'stored range start', duration: safeDuration }),
          normalizePlaybackSeconds(end, { field: 'stored range end', duration: safeDuration })
        ] as PlaybackRange;
      } catch {
        return null;
      }
    })
    .filter((range): range is PlaybackRange => range !== null)
    .filter(([start, end]) => end > start)
    .sort((left, right) => left[0] - right[0]);

  return ranges.reduce<PlaybackRange[]>((merged, current) => {
    const previous = merged.at(-1);
    if (!previous || current[0] > previous[1] + 0.25) {
      merged.push(current);
      return merged;
    }
    previous[1] = Math.max(previous[1], current[1]);
    return merged;
  }, []);
}

export function playbackCoverageSeconds(ranges: PlaybackRange[]) {
  return Math.max(0, Math.floor(ranges.reduce((sum, [start, end]) => sum + Math.max(0, end - start), 0)));
}

export function mergePlaybackRanges(left: unknown, right: unknown, duration: number) {
  return normalizePlaybackRanges([
    ...normalizePlaybackRanges(left, duration),
    ...normalizePlaybackRanges(right, duration)
  ], duration);
}

export function applyPlaybackHeartbeat(input: {
  ranges: unknown;
  previousPosition: number;
  currentPosition: number;
  elapsedSeconds: number;
  duration: number;
  maxPlaybackRate?: number;
}) {
  const duration = Math.max(1, normalizePlaybackSeconds(input.duration, { field: 'duration' }));
  const previousPosition = normalizePlaybackSeconds(input.previousPosition, {
    field: 'previous_position',
    duration
  });
  const currentPosition = normalizePlaybackSeconds(input.currentPosition, {
    field: 'current_position',
    duration
  });
  const elapsedSeconds = normalizePlaybackSeconds(input.elapsedSeconds, {
    field: 'elapsed_seconds',
    duration: 30
  });
  const maxPlaybackRate = clamp(input.maxPlaybackRate ?? 2, 1, 2);
  const forwardDelta = currentPosition - previousPosition;
  const maximumGenuineDelta = elapsedSeconds * maxPlaybackRate + 2;
  const accepted = elapsedSeconds > 0 && forwardDelta > 0 && forwardDelta <= maximumGenuineDelta;
  const ranges = accepted
    ? mergePlaybackRanges(input.ranges, [[previousPosition, currentPosition]], duration)
    : normalizePlaybackRanges(input.ranges, duration);

  return {
    accepted,
    ranges,
    listenedSeconds: playbackCoverageSeconds(ranges),
    currentPosition
  };
}

export function playbackRewardDecision(input: {
  trustedListenedSeconds: number;
  previouslyAwardedPosition: number;
  newlyCompletedSession: boolean;
  completionBonusAlreadyAwarded: boolean;
}) {
  const trustedListenedSeconds = Math.max(0, Math.floor(input.trustedListenedSeconds));
  const previouslyAwardedPosition = Math.max(0, Math.floor(input.previouslyAwardedPosition));
  const nextAwardedPosition = Math.floor(Math.max(previouslyAwardedPosition, trustedListenedSeconds) / 60) * 60;
  const listeningSeedsAwarded = trustedListenedSeconds >= 60
    ? Math.max(0, Math.floor((nextAwardedPosition - previouslyAwardedPosition) / 60))
    : 0;
  const completionBonusAwarded = input.newlyCompletedSession && !input.completionBonusAlreadyAwarded ? 2 : 0;

  return {
    nextAwardedPosition,
    listeningSeedsAwarded,
    completionBonusAwarded,
    moonSeedsAwarded: listeningSeedsAwarded + completionBonusAwarded
  };
}
