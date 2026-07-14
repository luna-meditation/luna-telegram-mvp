/// <reference types="vite/client" />

interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramWebApp {
  initData: string;
  platform?: string;
  version?: string;
  initDataUnsafe: {
    user?: TelegramWebAppUser;
    chat?: { id: number };
    start_param?: string;
  };
  ready: () => void;
  expand: () => void;
  openTelegramLink: (url: string) => void;
  addToHomeScreen?: () => void;
  checkHomeScreenStatus?: (callback: (status: 'unsupported' | 'unknown' | 'added' | 'missed' | 'available') => void) => void;
  openInvoice?: (url: string, callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void) => void;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
  };
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
}
