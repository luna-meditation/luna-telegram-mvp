import { useCallback, useEffect, useReducer, useRef, type Dispatch, type SetStateAction } from 'react';
import { initialRouteState, reduceRouteState, type AppPage, type RouteState } from './navigationModel';
import { supportsNativeBack } from './telegramBack';

type RouteOptions = {
  newNavigation: boolean;
  nestedBack?: boolean;
  beforeBack?: () => boolean;
};

export function useAppRouteState(initialPage: AppPage, options: RouteOptions) {
  const newNavigationRef = useRef(options.newNavigation);
  const beforeBackRef = useRef(options.beforeBack);
  beforeBackRef.current = options.beforeBack;
  const [state, dispatch] = useReducer(
    (current: RouteState, action: Parameters<typeof reduceRouteState>[1]) => reduceRouteState(current, action, newNavigationRef.current),
    initialPage,
    (page) => initialRouteState(page, newNavigationRef.current)
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  const setPage = useCallback<Dispatch<SetStateAction<AppPage>>>((next) => {
    const page = typeof next === 'function' ? next(stateRef.current.current) : next;
    dispatch({ type: 'navigate', page });
  }, []);

  const navigatePrimary = useCallback((page: AppPage) => {
    dispatch({ type: 'primary', page });
  }, []);

  const goBack = useCallback(() => {
    dispatch({ type: 'back' });
  }, []);

  const canGoBack = state.trail.length > 0 || Boolean(options.nestedBack);

  useEffect(() => {
    const backButton = window.Telegram?.WebApp?.BackButton;
    const native = supportsNativeBack(window.Telegram?.WebApp);
    document.documentElement.dataset.nativeBack = native ? 'true' : 'false';
    if (!backButton || !native) return;

    const handleBack = () => { if (!beforeBackRef.current?.()) goBack(); };
    backButton.onClick(handleBack);
    if (canGoBack) backButton.show();
    else backButton.hide();

    return () => {
      backButton.offClick(handleBack);
    };
  }, [canGoBack, goBack]);

  useEffect(() => {
    if (state.current === 'admin') return;
    if (window.location.pathname !== '/admin' && window.location.hash !== '#admin') return;

    const nextUrl = new URL(window.location.href);
    nextUrl.pathname = '/';
    if (nextUrl.hash === '#admin') nextUrl.hash = '';
    window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  }, [state.current]);

  return {
    page: state.current,
    setPage,
    navigatePrimary,
    goBack,
    canGoBack
  };
}
