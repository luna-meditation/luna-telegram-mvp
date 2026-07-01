const botUsername = import.meta.env.VITE_BOT_USERNAME || 'BOT_USERNAME';
const appShortName = import.meta.env.VITE_TELEGRAM_APP_SHORT_NAME || 'app-short-name';

const appUrl =
  botUsername === 'BOT_USERNAME'
    ? `https://t.me/${botUsername}?start=luna`
    : `https://t.me/${botUsername}/${appShortName}`;
const fallbackUrl = `https://t.me/${botUsername}?start=luna`;

for (const id of ['open-luna', 'try-free', 'unlock-premium']) {
  const link = document.getElementById(id) as HTMLAnchorElement | null;
  if (link) {
    link.href = appUrl || fallbackUrl;
  }
}
