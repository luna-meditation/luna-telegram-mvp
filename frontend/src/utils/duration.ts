export function meditationDurationMinutes(seconds: number | null | undefined) {
  return Math.max(1, Math.round(Math.max(0, Number(seconds) || 0) / 60));
}

export function formatMeditationDuration(seconds: number | null | undefined, language: 'en' | 'ru') {
  const minutes = meditationDurationMinutes(seconds);
  return language === 'ru' ? `${minutes} мин` : `${minutes} min`;
}
