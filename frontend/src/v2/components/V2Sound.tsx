import { Pause, Play, Waves } from 'lucide-react';
import type { AppLanguage } from '../../api';

type SceneDefinition = {
  id: string;
  title: Record<AppLanguage, string>;
  subtitle: Record<AppLanguage, string>;
  description: Record<AppLanguage, string>;
  mood: string;
  category: string;
  access: 'free' | 'premium';
  sortOrder: number;
  cover: string;
  sound: 'water' | 'ocean' | 'mist' | 'forest' | 'rain';
};

export function V2Sound({
  scene,
  playing,
  language,
  activeLabel,
  selectLabel,
  onOpen,
  onToggle,
  onExpand
}: {
  scene: SceneDefinition;
  playing: boolean;
  language: AppLanguage;
  activeLabel: string;
  selectLabel: string;
  onOpen: () => void;
  onToggle: () => void;
  onExpand: () => void;
}) {
  return (
    <section className="home-v2-sound-ribbon">
      <button type="button" onClick={onOpen} className="home-v2-sound-ribbon-main">
        <Waves size={17} />
        <span>
          <strong>{scene.title[language]}</strong>
          <small>{playing ? activeLabel : scene.subtitle[language]}</small>
        </span>
      </button>
      <button type="button" onClick={onToggle} className="home-v2-sound-round">
        {playing ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
      </button>
      <button type="button" onClick={onExpand} className="home-v2-sound-text">
        {selectLabel}
      </button>
    </section>
  );
}
