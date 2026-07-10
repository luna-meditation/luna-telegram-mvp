import { useState } from 'react';
import type { AppLanguage, Meditation } from '../../api';
import { V2Continue } from '../components/V2Continue';
import { V2Discovery, V2PracticeTiles } from '../components/V2Discovery';
import { V2Hero, V2HeroFallback } from '../components/V2Hero';
import { V2Sound } from '../components/V2Sound';
import '../design-system/homeV2.css';

type MoodChip = 'Sleep' | 'Calm' | 'Focus' | 'Anxiety' | 'Breath' | 'Energy';

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

type MeditationView = {
  title: string;
  subtitle: string;
  description: string;
};

type HomeV2Labels = {
  brandMeta: string;
  feeling: string;
  checkinSaved: string;
  checkins: string;
  moreToExplore: string;
  continueListening: string;
  openLibrary: string;
  soundTitle: string;
  soundActive: string;
  soundSelect: string;
  breathKicker: string;
  breathTitle: string;
  breathBody: string;
  weeklyTitle: string;
  addHomeTitle: string;
  addHomeBody: string;
  preparingCalm: string;
  firstPracticeTitle: string;
  firstPracticeBody: string;
  premium: string;
  free: string;
  begin: string;
  resume: string;
};

type HomeV2Props = {
  firstName: string;
  greeting: string;
  mood: MoodChip;
  moods: MoodChip[];
  setMood: (mood: MoodChip) => void;
  checkinLine: string;
  checkinMeta?: string;
  daily?: Meditation;
  heroLabel: string;
  continueListening: Meditation[];
  explore: Meditation[];
  recentlyPlayed: Meditation[];
  loading: boolean;
  scenes: SceneDefinition[];
  selectedScene: SceneDefinition | null;
  scenePlaying: boolean;
  hasPremium: boolean;
  homeScreenMessage: string;
  labels: HomeV2Labels;
  language: AppLanguage;
  onOpen: (meditation: Meditation) => void;
  onLibrary: () => void;
  onSoundToggle: () => void;
  onSoundSelect: (scene: SceneDefinition) => void;
  onSoundOpen: () => void;
  onBreath: () => void;
  onAddHome: () => void;
  meditationView: (meditation: Meditation) => MeditationView;
  categoryLabel: (category: string) => string;
  moodLabel: (mood: MoodChip) => string;
  durationLabel: (seconds: number) => string;
  weeklyInsight?: {
    body: string;
    meta: string;
  };
};

export function HomeV2(props: HomeV2Props) {
  const [soundExpanded, setSoundExpanded] = useState(false);
  const activeScene = props.selectedScene ?? props.scenes[0] ?? null;
  const discoveryItems = props.explore.length ? props.explore : props.recentlyPlayed;

  return (
    <div className="home-v2">
      {props.daily ? (
        <V2Hero
          meditation={props.daily}
          label={props.heroLabel}
          greeting={props.greeting}
          firstName={props.firstName}
          headline={props.labels.feeling}
          view={props.meditationView(props.daily)}
          categoryLabel={props.categoryLabel(props.daily.category)}
          durationLabel={props.durationLabel(props.daily.duration)}
          premiumLabel={props.labels.premium}
          freeLabel={props.labels.free}
          moods={props.moods}
          activeMood={props.mood}
          moodLabel={props.moodLabel}
          checkinLine={props.checkinLine}
          checkinMeta={props.checkinMeta}
          onMood={props.setMood}
          onOpen={() => props.onOpen(props.daily!)}
        />
      ) : props.loading ? (
        <V2HeroFallback title={props.labels.preparingCalm} body={props.labels.brandMeta} />
      ) : (
        <V2HeroFallback title={props.labels.firstPracticeTitle} body={props.labels.firstPracticeBody} />
      )}

      <section className="home-v2-plan-row">
        {activeScene ? (
          <V2Sound
            scene={activeScene}
            playing={props.scenePlaying}
            language={props.language}
            activeLabel={props.labels.soundActive}
            selectLabel={props.labels.soundSelect}
            onOpen={props.onSoundOpen}
            onToggle={props.onSoundToggle}
            onExpand={() => setSoundExpanded((value) => !value)}
          />
        ) : null}
        <button type="button" onClick={props.onLibrary} className="home-v2-library-link">
          {props.labels.openLibrary}
        </button>
      </section>

      {soundExpanded ? (
        <div className="home-v2-sound-chooser">
          {props.scenes.map((scene) => {
            const locked = scene.access === 'premium' && !props.hasPremium;
            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => props.onSoundSelect(scene)}
                className={props.selectedScene?.id === scene.id ? 'home-v2-choice home-v2-choice-active' : 'home-v2-choice'}
              >
                {scene.title[props.language]} {locked ? '⭐' : ''}
              </button>
            );
          })}
        </div>
      ) : null}

      <V2Discovery
        title={props.labels.moreToExplore}
        meditations={discoveryItems}
        onOpen={props.onOpen}
        meditationView={props.meditationView}
        categoryLabel={props.categoryLabel}
        durationLabel={props.durationLabel}
      />

      <V2Continue
        title={props.labels.continueListening}
        meditations={props.continueListening}
        onOpen={props.onOpen}
        meditationView={props.meditationView}
        durationLabel={props.durationLabel}
      />

      <V2PracticeTiles
        breathTitle={props.labels.breathTitle}
        breathBody={props.labels.breathBody}
        insightTitle={props.labels.weeklyTitle}
        insightBody={props.weeklyInsight?.body}
        insightMeta={props.weeklyInsight?.meta}
        onBreath={props.onBreath}
      />

      <button type="button" onClick={props.onAddHome} className="home-v2-home-action">
        <strong>{props.labels.addHomeTitle}</strong>
        <span>{props.homeScreenMessage || props.labels.addHomeBody}</span>
      </button>
    </div>
  );
}
