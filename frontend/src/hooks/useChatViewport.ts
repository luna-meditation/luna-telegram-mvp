import { useEffect } from 'react';

type TelegramViewport = {
  viewportHeight?: number;
  viewportStableHeight?: number;
  safeAreaInset?: Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;
  contentSafeAreaInset?: Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;
  onEvent?: (event: string, handler: () => void) => void;
  offEvent?: (event: string, handler: () => void) => void;
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
      const viewportHeight = Math.min(visualViewport?.height ?? window.innerHeight, telegram?.viewportHeight || window.innerHeight);
      const stableHeight = telegram?.viewportStableHeight ?? window.innerHeight;
      const offsetTop = visualViewport?.offsetTop ?? 0;
      const keyboardInset = Math.max(0, stableHeight - viewportHeight - offsetTop);

      root.style.setProperty('--app-viewport-height', `${Math.round(viewportHeight)}px`);
      root.style.setProperty('--app-viewport-offset-top', `${Math.round(offsetTop)}px`);
      root.style.setProperty('--app-keyboard-inset', `${Math.round(keyboardInset)}px`);
      root.dataset.keyboardOpen = keyboardInset > 120 ? 'true' : 'false';
      for (const edge of ['top', 'right', 'bottom', 'left'] as const) {
        const inset = Math.max(0, telegram?.safeAreaInset?.[edge] ?? 0, telegram?.contentSafeAreaInset?.[edge] ?? 0);
        root.style.setProperty(`--luna-safe-${edge}`, `${inset}px`);
      }
    };

    update();
    visualViewport?.addEventListener('resize', update);
    visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    telegram?.onEvent?.('viewportChanged', update);
    telegram?.onEvent?.('safeAreaChanged', update);
    telegram?.onEvent?.('contentSafeAreaChanged', update);

    return () => {
      visualViewport?.removeEventListener('resize', update);
      visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      telegram?.offEvent?.('viewportChanged', update);
      telegram?.offEvent?.('safeAreaChanged', update);
      telegram?.offEvent?.('contentSafeAreaChanged', update);
      root.style.removeProperty('--app-viewport-height');
      root.style.removeProperty('--app-viewport-offset-top');
      root.style.removeProperty('--app-keyboard-inset');
      delete root.dataset.keyboardOpen;
      for (const edge of ['top', 'right', 'bottom', 'left']) root.style.removeProperty(`--luna-safe-${edge}`);
    };
  }, [active]);
}

export const useChatViewport = useAppViewport;
