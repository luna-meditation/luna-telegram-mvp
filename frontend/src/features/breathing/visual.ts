import type { BreathPractice } from './practices';

// Visual-only interpolation. Reward timing and the shared phase clock are unchanged.
export function breathVisualScale(practice: BreathPractice, kind: string, progress: number) {
  const p = Math.min(1, Math.max(0, progress));
  if (kind === 'inhale') return 0.72 + p * (practice.phases.some(phase => phase.kind === 'inhale_top') ? 0.2 : 0.28);
  if (kind === 'inhale_top') return 0.92 + p * 0.08;
  if (kind === 'exhale') return 1 - p * 0.28;
  return kind === 'hold' ? 1 : 0.72;
}
