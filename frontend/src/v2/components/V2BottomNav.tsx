import type { LucideIcon } from 'lucide-react';
import { BarChart3, BookOpen, Home, MessageCircle, User } from 'lucide-react';

type Page = 'home' | 'luna' | 'library' | 'progress' | 'weeklyReflection' | 'favorites' | 'profile' | 'pricing' | 'player' | 'scenePlayer' | 'mantraPlayer' | 'breathCircle' | 'moonGarden' | 'admin';

type V2BottomNavProps = {
  active: Page;
  onChange: (page: Page) => void;
  labels: {
    home: string;
    luna: string;
    library: string;
    progress: string;
    profile: string;
  };
};

const items: Array<{ page: Page; key: keyof V2BottomNavProps['labels']; icon: LucideIcon }> = [
  { page: 'home', key: 'home', icon: Home },
  { page: 'luna', key: 'luna', icon: MessageCircle },
  { page: 'library', key: 'library', icon: BookOpen },
  { page: 'progress', key: 'progress', icon: BarChart3 },
  { page: 'profile', key: 'profile', icon: User }
];

export function V2BottomNav({ active, onChange, labels }: V2BottomNavProps) {
  return (
    <nav className="home-v2-bottom-nav">
      {items.map((item) => {
        const Icon = item.icon;
        const selected = active === item.page || ((active === 'weeklyReflection' || active === 'moonGarden') && item.page === 'progress');
        return (
          <button
            key={item.page}
            type="button"
            onClick={() => onChange(item.page)}
            className={selected ? 'home-v2-bottom-item home-v2-bottom-item-active' : 'home-v2-bottom-item'}
          >
            <Icon size={18} />
            <span>{labels[item.key]}</span>
          </button>
        );
      })}
    </nav>
  );
}
