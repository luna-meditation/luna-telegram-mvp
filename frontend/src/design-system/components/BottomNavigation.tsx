import type { LucideIcon } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { BookOpen, Compass, Home, MessageCircle, Route, Sparkles, User } from 'lucide-react';
import { primaryNavigation, primaryParent, type AppPage } from '../../navigation/navigationModel';

export type NavigationPage = AppPage;

type BottomNavigationProps = {
  active: NavigationPage;
  onChange: (page: NavigationPage) => void;
  labels: { home: string; luna: string; library: string; progress: string; profile: string; explore: string; lunaAi: string; journey: string };
  newNavigation?: boolean;
};

const icons: Record<'home' | 'library' | 'explore' | 'luna' | 'progress' | 'profile', LucideIcon> = {
  home: Home,
  library: BookOpen,
  explore: Compass,
  luna: MessageCircle,
  progress: Route,
  profile: User
};

export function BottomNavigation({ active, onChange, labels, newNavigation = false }: BottomNavigationProps) {
  const navigationItems = primaryNavigation(newNavigation);
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const height = ref.current?.getBoundingClientRect().height;
      if (height) document.documentElement.style.setProperty('--measured-navigation-height', `${height}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (ref.current) observer.observe(ref.current);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--measured-navigation-height'); };
  }, [newNavigation]);

  return (
    <nav ref={ref} className={`bottom-navigation ${newNavigation ? 'bottom-navigation-luna2' : ''}`} aria-label="Primary" data-testid="bottom-navigation" style={{ gridTemplateColumns: `repeat(${navigationItems.length}, minmax(0, 1fr))` }}>
      {navigationItems.map((item) => {
        const Icon = newNavigation && item.page === 'luna' ? Sparkles : icons[item.page];
        const label = newNavigation
          ? labels[item.labelKey]
          : labels[item.page];
        const selected = active === item.page
          || (!newNavigation && active === 'moonGarden' && item.page === 'progress')
          || (newNavigation && primaryParent(active, true) === item.page);
        return (
          <button
            key={item.page}
            type="button"
            onClick={() => onChange(item.page)}
            className={`bottom-navigation-item type-navigation ${newNavigation && item.page === 'luna' ? 'luna2-nav-ai' : ''}`}
            aria-current={selected ? 'page' : undefined}
            aria-label={label}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
