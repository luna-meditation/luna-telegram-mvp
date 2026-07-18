import type { LucideIcon } from 'lucide-react';
import { BookOpen, Home, MessageCircle, Route, User } from 'lucide-react';

export type NavigationPage = 'home' | 'luna' | 'library' | 'progress' | 'favorites' | 'profile' | 'pricing' | 'player' | 'scenePlayer' | 'mantraPlayer' | 'breathCircle' | 'moonGarden' | 'admin';

type BottomNavigationProps = {
  active: NavigationPage;
  onChange: (page: NavigationPage) => void;
  labels: { home: string; luna: string; library: string; progress: string; profile: string };
};

const navigationItems: Array<{ page: NavigationPage; key: keyof BottomNavigationProps['labels']; icon: LucideIcon }> = [
  { page: 'home', key: 'home', icon: Home },
  { page: 'library', key: 'library', icon: BookOpen },
  { page: 'luna', key: 'luna', icon: MessageCircle },
  { page: 'progress', key: 'progress', icon: Route },
  { page: 'profile', key: 'profile', icon: User }
];

export function BottomNavigation({ active, onChange, labels }: BottomNavigationProps) {
  return (
    <nav className="bottom-navigation" aria-label="Primary" data-testid="bottom-navigation">
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const selected = active === item.page || (active === 'moonGarden' && item.page === 'progress');
        return (
          <button
            key={item.page}
            type="button"
            onClick={() => onChange(item.page)}
            className={`bottom-navigation-item type-navigation ${item.page === 'luna' ? 'bottom-navigation-item-luna' : ''}`}
            aria-current={selected ? 'page' : undefined}
            aria-label={labels[item.key]}
          >
            <Icon aria-hidden="true" />
            <span>{labels[item.key]}</span>
          </button>
        );
      })}
    </nav>
  );
}
