import { useEffect } from 'react';

export function useChatViewport(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const viewport = window.visualViewport;

    const update = () => {
      root.style.setProperty('--luna-visual-height', `${Math.round(viewport?.height ?? window.innerHeight)}px`);
      root.style.setProperty('--luna-visual-offset-top', `${Math.round(viewport?.offsetTop ?? 0)}px`);
    };

    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('orientationchange', update);
      root.style.removeProperty('--luna-visual-height');
      root.style.removeProperty('--luna-visual-offset-top');
    };
  }, [active]);
}
