import { useEffect } from 'react';
import {viewportGeometry} from './viewportPolicy';

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
      const focused=document.activeElement;
      const editable=focused instanceof HTMLElement&&(focused.isContentEditable||focused.matches('textarea:not([readonly]):not([disabled]),input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]):not([type=range]):not([readonly]):not([disabled])'));
      const geometry=viewportGeometry({visualHeight:visualViewport?.height??window.innerHeight,innerHeight:window.innerHeight,telegramHeight:telegram?.viewportHeight,stableHeight:telegram?.viewportStableHeight,offsetTop:visualViewport?.offsetTop??0,scale:visualViewport?.scale??1,editableFocused:editable});

      root.style.setProperty('--app-viewport-height', `${geometry.height}px`);
      root.style.setProperty('--app-viewport-offset-top', `${geometry.offsetTop}px`);
      root.style.setProperty('--app-keyboard-inset', `${geometry.keyboardInset}px`);
      root.dataset.keyboardOpen = geometry.keyboardOpen ? 'true' : 'false';
      for (const edge of ['top', 'right', 'bottom', 'left'] as const) {
        const inset = Math.max(0, telegram?.safeAreaInset?.[edge] ?? 0, telegram?.contentSafeAreaInset?.[edge] ?? 0);
        root.style.setProperty(`--luna-safe-${edge}`, `${inset}px`);
      }
    };

    let focusFrame=0;
    const focusChanged=()=>{update();cancelAnimationFrame(focusFrame);focusFrame=requestAnimationFrame(update);};
    update();
    visualViewport?.addEventListener('resize', update);
    visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    document.addEventListener('focusin', focusChanged);
    document.addEventListener('focusout', focusChanged);
    telegram?.onEvent?.('viewportChanged', update);
    telegram?.onEvent?.('safeAreaChanged', update);
    telegram?.onEvent?.('contentSafeAreaChanged', update);

    return () => {
      cancelAnimationFrame(focusFrame);
      visualViewport?.removeEventListener('resize', update);
      visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      document.removeEventListener('focusin', focusChanged);
      document.removeEventListener('focusout', focusChanged);
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
