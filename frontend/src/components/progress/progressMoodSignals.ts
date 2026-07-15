import type { DailyCheckin } from '../../api';

export type WellbeingSignal = 'calm' | 'stress' | 'sleep';
export type WellbeingSignals = Record<WellbeingSignal, number | null>;

// This is a deterministic, non-clinical display mapping. Missing check-in values
// stay null and are never interpolated or replaced with an assumed baseline.
const moodSignalMap: Record<DailyCheckin['mood'], Pick<WellbeingSignals, 'calm' | 'stress'>> = {
  calm: { calm: 4, stress: 0 },
  focused: { calm: 3, stress: 1 },
  tired: { calm: 1, stress: 2 },
  low_energy: { calm: 1, stress: 2 },
  stressed: { calm: 0, stress: 4 },
  anxious: { calm: 0, stress: 4 }
};

const sleepSignalMap: Record<NonNullable<DailyCheckin['sleep_range']>, number> = {
  less_than_4: 0,
  '4_6': 1,
  '6_8': 3,
  '8_plus': 4
};

export function wellbeingSignalsForCheckin(mood: DailyCheckin['mood'] | null, sleepRange?: DailyCheckin['sleep_range'] | null): WellbeingSignals {
  return {
    calm: mood ? moodSignalMap[mood].calm : null,
    stress: mood ? moodSignalMap[mood].stress : null,
    sleep: sleepRange ? sleepSignalMap[sleepRange] : null
  };
}

export function wellbeingSignalPoint(index: number, value: number, total: number, width = 320, height = 138) {
  const side = 18;
  const top = 15;
  const bottom = 24;
  const x = total <= 1 ? width / 2 : side + (index / (total - 1)) * (width - side * 2);
  const y = top + ((4 - Math.max(0, Math.min(4, value))) / 4) * (height - top - bottom);
  return { x, y };
}

export function wellbeingSignalPath(values: Array<number | null>, width = 320, height = 138) {
  let openSegment = false;
  return values.map((value, index) => {
    if (value == null) {
      openSegment = false;
      return '';
    }
    const point = wellbeingSignalPoint(index, value, values.length, width, height);
    const command = openSegment ? 'L' : 'M';
    openSegment = true;
    return `${command}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  }).filter(Boolean).join(' ');
}
