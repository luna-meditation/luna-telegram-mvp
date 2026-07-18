import { useEffect } from 'react';

type TelegramViewport = {
  viewportHeight?: number;
  viewportStableHeight?: number;
  onEvent?: (event: 'viewportChanged', handler: () => void) => void;
  offEvent?: (event: 'viewportChanged', handler: () => void) => void;
};

/**
 * Keeps the application shell aligned with Telegram and the visible keyboard
 * viewport. The CSS variables are shared by every screen, not only chat.
 */
export function useAppViewport(active = true) {
  useEffect(() => {
    if (!active) return;

    const root = document.documentElement;
    const visualViewport = window.visualViewport;
    const telegram = window.Telegram?.WebApp as TelegramViewport | undefined;

    const update = () => {
      const viewportHeight = visualViewport?.height
        ?? telegram?.viewportHeight
        ?? window.innerHeight;
      const stableHeight = telegram?.viewportStableHeight ?? window.innerHeight;
      const offsetTop = visualViewport?.offsetTop ?? 0;
      const keyboardInset = Math.max(0, stableHeight - viewportHeight - offsetTop);

      root.style.setProperty('--app-viewport-height', `${Math.round(viewportHeight)}px`);
      root.style.setProperty('--app-viewport-offset-top', `${Math.round(offsetTop)}px`);
      root.style.setProperty('--app-keyboard-inset', `${Math.round(keyboardInset)}px`);
      root.dataset.keyboardOpen = keyboardInset > 120 ? 'true' : 'false';
    };

    update();
    visualViewport?.addEventListener('resize', update);
    visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    telegram?.onEvent?.('viewportChanged', update);

    return () => {
      visualViewport?.removeEventListener('resize', update);
      visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      telegram?.offEvent?.('viewportChanged', update);
      root.style.removeProperty('--app-viewport-height');
      root.style.removeProperty('--app-viewport-offset-top');
      root.style.removeProperty('--app-keyboard-inset');
      delete root.dataset.keyboardOpen;
    };
  }, [active]);
}

export const useChatViewport = useAppViewport;
