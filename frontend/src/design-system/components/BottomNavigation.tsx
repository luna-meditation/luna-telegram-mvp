import type { LucideIcon } from 'lucide-react';
import { BookOpen, Home, MessageCircle, Route, User } from 'lucide-react';
import { primaryNavigation, type AppPage } from '../../navigation/navigationModel';

export type NavigationPage = AppPage;

type BottomNavigationProps = {
  active: NavigationPage;
  onChange: (page: NavigationPage) => void;
  labels: { home: string; luna: string; library: string; progress: string; profile: string; explore: string; lunaAi: string; journey: string };
  newNavigation?: boolean;
};

const icons: Record<'home' | 'library' | 'luna' | 'progress' | 'profile', LucideIcon> = {
  home: Home,
  library: BookOpen,
  luna: MessageCircle,
  progress: Route,
  profile: User
};

export function BottomNavigation({ active, onChange, labels, newNavigation = false }: BottomNavigationProps) {
  const navigationItems = primaryNavigation(newNavigation);

  return (
    <nav className="bottom-navigation" aria-label="Primary" data-testid="bottom-navigation" style={{ gridTemplateColumns: `repeat(${navigationItems.length}, minmax(0, 1fr))` }}>
      {navigationItems.map((item) => {
        const Icon = icons[item.page];
        const label = newNavigation
          ? labels[item.labelKey]
          : labels[item.page];
        const selected = active === item.page
          || (!newNavigation && active === 'moonGarden' && item.page === 'progress')
          || (newNavigation && (active === 'progress' || active === 'moonGarden') && item.page === 'profile');
        return (
          <button
            key={item.page}
            type="button"
            onClick={() => onChange(item.page)}
            className="bottom-navigation-item type-navigation"
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
