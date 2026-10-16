export function meditationDurationMinutes(seconds: number | null | undefined) {
  return Math.max(1, Math.round(Math.max(0, Number(seconds) || 0) / 60));
}

export function formatMeditationDuration(seconds: number | null | undefined, language: 'en' | 'ru') {
  const minutes = meditationDurationMinutes(seconds);
  return language === 'ru' ? `${minutes} мин` : `${minutes} min`;
}

export function formatMeditationDurationPrecise(seconds:number|null|undefined,language:'en'|'ru'){
 const total=Math.max(0,Math.floor(Number(seconds)||0)),minutes=Math.floor(total/60),rest=total%60;
 return language==='ru'?`${minutes} мин${rest?` ${rest} с`:''}`:`${minutes} min${rest?` ${rest} s`:''}`;
}
