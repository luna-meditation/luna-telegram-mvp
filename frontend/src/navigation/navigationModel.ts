import {parseLaunchDestination} from './launchDestination';
export type AppPage =
  | 'home'
  | 'luna'
  | 'library'
  | 'explore'
  | 'tarot'
  | 'astrology'
  | 'wallet'
  | 'activity'
  | 'achievements'
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
  page: Extract<AppPage, 'home' | 'library' | 'explore' | 'luna' | 'progress' | 'profile'>;
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
  if (newNavigation && (page === 'explore' || page === 'library' || page === 'tarot' || page === 'astrology')) return 'home';
  if (page === 'wallet' || page === 'activity' || page === 'achievements') return 'profile';
  if (page === 'favorites' || page === 'player' || page === 'scenePlayer' || page === 'mantraPlayer' || page === 'breathCircle') {
    return newNavigation ? 'home' : 'library';
  }
  if (page === 'progress' || page === 'moonGarden') return newNavigation ? 'profile' : 'progress';
  if (page === 'pricing') return 'profile';
  return 'home';
}

export function pageFromStartParam(startParam: string, newNavigation = false): AppPage {
  const launch=parseLaunchDestination(startParam);
  const destinations:Record<string,AppPage>={daily:'tarot',natal:'astrology',compatibility:'astrology',membership:'pricing',seeds:'wallet',invite:'profile'};
  if(newNavigation&&destinations[launch.destination])return destinations[launch.destination];
  if(launch.referral)return pageFromStartParam(launch.destination,newNavigation);
  const normalized = startParam.trim().toLowerCase();
  if (normalized === 'luna' || normalized === 'luna-ai' || normalized === 'ai') return 'luna';
  if (normalized === 'library' || normalized === 'saved' || normalized === 'meditations') return 'library';
  if (normalized === 'explore') return newNavigation ? 'home' : 'library';
  if (newNavigation && (normalized === 'tarot' || normalized === 'astrology')) return normalized;
  if (newNavigation && (normalized === 'wallet' || normalized === 'activity' || normalized === 'achievements')) return normalized;
  if (normalized === 'breathwork' || normalized === 'breathing') return 'breathCircle';
  if (normalized === 'progress' || normalized === 'journey') return 'progress';
  if (normalized === 'premium') return 'pricing';
  if (normalized === 'profile') return 'profile';
  if (normalized === 'moon-garden' || normalized === 'garden') return 'moonGarden';
  return 'home';
}

export function initialPageFromLaunch(pathname: string, hash: string, startParam: string, newNavigation = false): AppPage {
  if (pathname === '/admin' || hash === '#admin') return 'admin';
  if (newNavigation && (pathname.replace(/\/$/, '') === '/explore' || hash === '#explore') && !startParam) return 'home';
  return pageFromStartParam(startParam, newNavigation);
}

export function primaryParent(page: AppPage, newNavigation: boolean): AppPage {
  if (isPrimaryPage(page, newNavigation)) return page;
  return fallbackPage(page, newNavigation);
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
  if (newNavigation && initialPage === 'explore') return { current: 'home', trail: [] };
  if (isPrimaryPage(initialPage, newNavigation)) return { current: initialPage, trail: [] };
  return { current: initialPage, trail: [fallbackPage(initialPage, newNavigation)] };
}

export function reduceRouteState(state: RouteState, action: RouteAction, newNavigation: boolean): RouteState {
  if (action.type === 'back') {
    const previous = state.trail[state.trail.length - 1];
    if (!previous) return state;
    return { current: previous, trail: state.trail.slice(0, -1) };
  }

  if (newNavigation && action.page === 'explore') action = { ...action, page: 'home' };
  if (action.page === state.current) return state;
  if (action.type === 'primary' || isPrimaryPage(action.page, newNavigation)) {
    return { current: action.page, trail: [] };
  }

  return { current: action.page, trail: [...state.trail, state.current] };
}
