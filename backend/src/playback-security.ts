export type PlaybackRange = [number, number];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export function normalizePlaybackRanges(value: unknown, duration: number): PlaybackRange[] {
  const safeDuration = Math.max(1, duration);
  if (!Array.isArray(value)) return [];

  const ranges = value
    .filter((item): item is [number, number] => Array.isArray(item) && item.length >= 2)
    .map(([start, end]) => [
      clamp(Number(start), 0, safeDuration),
      clamp(Number(end), 0, safeDuration)
    ] as PlaybackRange)
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
  const duration = Math.max(1, input.duration);
  const previousPosition = clamp(input.previousPosition, 0, duration);
  const currentPosition = clamp(input.currentPosition, 0, duration);
  const elapsedSeconds = clamp(input.elapsedSeconds, 0, 30);
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
