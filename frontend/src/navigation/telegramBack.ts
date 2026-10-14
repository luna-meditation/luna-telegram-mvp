export function supportsNativeBack(telegram: Pick<TelegramWebApp, 'initData' | 'version' | 'BackButton'> | undefined) {
  if (!telegram?.initData || !telegram.BackButton) return false;
  if (!telegram.version) return true; // Compatible clients can omit version.
  const [major, minor] = telegram.version.split('.').map(Number);
  return major > 6 || (major === 6 && minor >= 1);
}
