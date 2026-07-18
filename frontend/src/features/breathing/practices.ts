import type { AppLanguage } from '../../api';

export type BreathPracticeId = 'calm' | 'box' | '478' | 'coherent' | 'triangle' | 'sigh' | 'anxiety_reset' | 'sleep' | 'morning_energy';
export type BreathPhaseKind = 'inhale' | 'inhale_top' | 'hold' | 'exhale' | 'pause';

export type BreathPractice = {
  id: BreathPracticeId;
  name: Record<AppLanguage, string>;
  description: Record<AppLanguage, string>;
  timing: Record<AppLanguage, string>;
  phases: Array<{ kind: BreathPhaseKind; seconds: number }>;
};

export const breathPractices: BreathPractice[] = [
  { id: 'calm', name: { en: 'Calm Breath', ru: 'Спокойное дыхание' }, description: { en: 'A gentle longer exhale.', ru: 'Мягкий удлинённый выдох.' }, timing: { en: 'Inhale 4 · Exhale 6', ru: 'Вдох 4 · Выдох 6' }, phases: [{ kind: 'inhale', seconds: 4 }, { kind: 'exhale', seconds: 6 }] },
  { id: 'box', name: { en: 'Box Breathing', ru: 'Квадратное дыхание' }, description: { en: 'An even four-part rhythm.', ru: 'Ровный ритм из четырёх частей.' }, timing: { en: '4 · 4 · 4 · 4', ru: '4 · 4 · 4 · 4' }, phases: [{ kind: 'inhale', seconds: 4 }, { kind: 'hold', seconds: 4 }, { kind: 'exhale', seconds: 4 }, { kind: 'pause', seconds: 4 }] },
  { id: '478', name: { en: '4-7-8 Breathing', ru: 'Дыхание 4-7-8' }, description: { en: 'A slow settling rhythm.', ru: 'Медленный успокаивающий ритм.' }, timing: { en: 'Inhale 4 · Hold 7 · Exhale 8', ru: 'Вдох 4 · Пауза 7 · Выдох 8' }, phases: [{ kind: 'inhale', seconds: 4 }, { kind: 'hold', seconds: 7 }, { kind: 'exhale', seconds: 8 }] },
  { id: 'coherent', name: { en: 'Coherent Breathing', ru: 'Когерентное дыхание' }, description: { en: 'A balanced, steady cadence.', ru: 'Ровный сбалансированный темп.' }, timing: { en: 'Inhale 5 · Exhale 5', ru: 'Вдох 5 · Выдох 5' }, phases: [{ kind: 'inhale', seconds: 5 }, { kind: 'exhale', seconds: 5 }] },
  { id: 'triangle', name: { en: 'Triangle Breathing', ru: 'Треугольное дыхание' }, description: { en: 'Three equal, grounded phases.', ru: 'Три равные устойчивые фазы.' }, timing: { en: 'Inhale 4 · Hold 4 · Exhale 4', ru: 'Вдох 4 · Пауза 4 · Выдох 4' }, phases: [{ kind: 'inhale', seconds: 4 }, { kind: 'hold', seconds: 4 }, { kind: 'exhale', seconds: 4 }] },
  { id: 'sigh', name: { en: 'Physiological Sigh', ru: 'Физиологический вздох' }, description: { en: 'Two-stage inhale, then a long exhale.', ru: 'Двойной вдох и длинный выдох.' }, timing: { en: 'Inhale 2 + 2 · Exhale 6', ru: 'Вдох 2 + 2 · Выдох 6' }, phases: [{ kind: 'inhale', seconds: 2 }, { kind: 'inhale_top', seconds: 2 }, { kind: 'exhale', seconds: 6 }] },
  { id: 'anxiety_reset', name: { en: 'Anxiety Reset', ru: 'Перезагрузка при тревоге' }, description: { en: 'A soft exhale-led reset.', ru: 'Мягкая практика с акцентом на выдох.' }, timing: { en: 'Inhale 4 · Exhale 6 · Pause 2', ru: 'Вдох 4 · Выдох 6 · Пауза 2' }, phases: [{ kind: 'inhale', seconds: 4 }, { kind: 'exhale', seconds: 6 }, { kind: 'pause', seconds: 2 }] },
  { id: 'sleep', name: { en: 'Sleep Wind-down', ru: 'Настрой на сон' }, description: { en: 'Slow and low-stimulation.', ru: 'Медленный ритм без лишней стимуляции.' }, timing: { en: 'Inhale 4 · Exhale 8 · Pause 2', ru: 'Вдох 4 · Выдох 8 · Пауза 2' }, phases: [{ kind: 'inhale', seconds: 4 }, { kind: 'exhale', seconds: 8 }, { kind: 'pause', seconds: 2 }] },
  { id: 'morning_energy', name: { en: 'Morning Energy', ru: 'Утренняя энергия' }, description: { en: 'A clear, balanced morning rhythm.', ru: 'Ясный сбалансированный утренний ритм.' }, timing: { en: 'Inhale 4 · Hold 2 · Exhale 4 · Pause 2', ru: 'Вдох 4 · Пауза 2 · Выдох 4 · Пауза 2' }, phases: [{ kind: 'inhale', seconds: 4 }, { kind: 'hold', seconds: 2 }, { kind: 'exhale', seconds: 4 }, { kind: 'pause', seconds: 2 }] }
];

export function breathCycleSeconds(practice: BreathPractice) {
  return practice.phases.reduce((sum, phase) => sum + phase.seconds, 0);
}

export function breathPhaseAt(practice: BreathPractice, elapsedSeconds: number) {
  const cycle = breathCycleSeconds(practice);
  const offset = ((elapsedSeconds % cycle) + cycle) % cycle;
  let cursor = 0;
  for (const phase of practice.phases) {
    const end = cursor + phase.seconds;
    if (offset < end) {
      const progress = Math.min(1, Math.max(0, (offset - cursor) / phase.seconds));
      const scale = phase.kind === 'inhale' || phase.kind === 'inhale_top'
        ? 0.86 + progress * 0.18
        : phase.kind === 'exhale'
          ? 1.04 - progress * 0.18
          : phase.kind === 'hold'
            ? 1.04
            : 0.86;
      return { ...phase, progress, remaining: Math.max(1, Math.ceil(end - offset)), scale };
    }
    cursor = end;
  }
  return { ...practice.phases[0], progress: 0, remaining: practice.phases[0]?.seconds ?? 1, scale: 0.86 };
}

export function breathPhaseLabel(kind: BreathPhaseKind, language: AppLanguage) {
  const labels: Record<BreathPhaseKind, Record<AppLanguage, string>> = {
    inhale: { en: 'Inhale', ru: 'Вдох' },
    inhale_top: { en: 'Inhale again', ru: 'Ещё вдох' },
    hold: { en: 'Hold', ru: 'Пауза' },
    exhale: { en: 'Exhale', ru: 'Выдох' },
    pause: { en: 'Pause', ru: 'Пауза' }
  };
  return labels[kind][language];
}
