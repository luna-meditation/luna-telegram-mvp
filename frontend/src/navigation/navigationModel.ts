export type AppPage =
  | 'home'
  | 'luna'
  | 'library'
  | 'progress'
  | 'favorites'
  | 'profile'
  | 'pricing'
  | 'player'
  | 'scenePlayer'
  | 'mantraPlayer'
  | 'breathCircle'
  | 'moonGarden'
  | 'admin';

export type PrimaryNavigationItem = {
  page: Extract<AppPage, 'home' | 'library' | 'luna' | 'progress' | 'profile'>;
  labelKey: 'home' | 'explore' | 'lunaAi' | 'journey' | 'profile';
};

export const legacyPrimaryNavigation: readonly PrimaryNavigationItem[] = [
  { page: 'home', labelKey: 'home' },
  { page: 'library', labelKey: 'explore' },
  { page: 'luna', labelKey: 'lunaAi' },
  { page: 'progress', labelKey: 'journey' },
  { page: 'profile', labelKey: 'profile' }
];

export const luna2PrimaryNavigation: readonly PrimaryNavigationItem[] = [
  { page: 'home', labelKey: 'home' },
  { page: 'library', labelKey: 'explore' },
  { page: 'luna', labelKey: 'lunaAi' },
  { page: 'profile', labelKey: 'profile' }
];

export function primaryNavigation(newNavigation: boolean) {
  return newNavigation ? luna2PrimaryNavigation : legacyPrimaryNavigation;
}

export function isPrimaryPage(page: AppPage, newNavigation: boolean) {
  return primaryNavigation(newNavigation).some((item) => item.page === page);
}

export function fallbackPage(page: AppPage, newNavigation: boolean): AppPage {
  if (page === 'favorites' || page === 'player' || page === 'scenePlayer' || page === 'mantraPlayer' || page === 'breathCircle') {
    return 'library';
  }
  if (page === 'progress' || page === 'moonGarden') return newNavigation ? 'profile' : 'progress';
  if (page === 'pricing') return 'profile';
  return 'home';
}

export function pageFromStartParam(startParam: string): AppPage {
  const normalized = startParam.trim().toLowerCase();
  if (normalized === 'luna' || normalized === 'luna-ai' || normalized === 'ai') return 'luna';
  if (normalized === 'library' || normalized === 'saved' || normalized === 'explore') return 'library';
  if (normalized === 'progress' || normalized === 'journey') return 'progress';
  if (normalized === 'premium') return 'pricing';
  if (normalized === 'profile') return 'profile';
  if (normalized === 'moon-garden' || normalized === 'garden') return 'moonGarden';
  return 'home';
}

export function initialPageFromLaunch(pathname: string, hash: string, startParam: string): AppPage {
  if (pathname === '/admin' || hash === '#admin') return 'admin';
  return pageFromStartParam(startParam);
}

export function meditationIdFromStartParam(startParam: string) {
  if (!startParam.startsWith('meditation_')) return null;
  const id = startParam.slice('meditation_'.length);
  if (!id) return null;

  try {
    return decodeURIComponent(id);
  } catch {
    return null;
  }
}

export type RouteState = {
  current: AppPage;
  trail: AppPage[];
};

export type RouteAction =
  | { type: 'navigate'; page: AppPage }
  | { type: 'primary'; page: AppPage }
  | { type: 'back' };

export function initialRouteState(initialPage: AppPage, newNavigation: boolean): RouteState {
  if (isPrimaryPage(initialPage, newNavigation)) return { current: initialPage, trail: [] };
  return { current: initialPage, trail: [fallbackPage(initialPage, newNavigation)] };
}

export function reduceRouteState(state: RouteState, action: RouteAction, newNavigation: boolean): RouteState {
  if (action.type === 'back') {
    const previous = state.trail[state.trail.length - 1];
    if (!previous) return state;
    return { current: previous, trail: state.trail.slice(0, -1) };
  }

  if (action.page === state.current) return state;
  if (action.type === 'primary' || isPrimaryPage(action.page, newNavigation)) {
    return { current: action.page, trail: [] };
  }

  return { current: action.page, trail: [...state.trail, state.current] };
}
