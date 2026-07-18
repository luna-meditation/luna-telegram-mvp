import { useEffect, useRef, useState } from 'react';
import { Crown } from 'lucide-react';
import type { AppLanguage, Meditation } from '../../api';
import { BrandLogo } from '../../design-system/components/BrandLogo';
import { V2Continue } from '../components/V2Continue';
import { V2Discovery, V2PracticeTiles } from '../components/V2Discovery';
import { V2Hero, V2HeroFallback } from '../components/V2Hero';
import { V2Recommendation } from '../components/V2Recommendation';
import { V2Sound } from '../components/V2Sound';
import { V2Stats, type V2Stat } from '../components/V2Stats';
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
  todayRecommendation: string;
  checkinSaved: string;
  checkinToast: string;
  checkins: string;
  moreToExplore: string;
  continueListening: string;
  openLibrary: string;
  viewAll: string;
  soundTitle: string;
  soundActive: string;
  soundSelect: string;
  breathKicker: string;
  breathTitle: string;
  breathBody: string;
  askLunaTitle: string;
  askLunaBody: string;
  askLunaAction: string;
  addHomeTitle: string;
  addHomeBody: string;
  addHomeAction: string;
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
  mood?: MoodChip;
  moodSaved: boolean;
  showCheckinToast: boolean;
  moodSaving: boolean;
  onCheckinDetails: () => void;
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
  homeScreenStatus: 'idle' | 'added' | 'unsupported';
  assistantMessage: string;
  stats: V2Stat[];
  labels: HomeV2Labels;
  language: AppLanguage;
  onOpen: (meditation: Meditation) => void;
  onLibrary: () => void;
  onSoundToggle: () => void;
  onSoundSelect: (scene: SceneDefinition) => void;
  onSoundOpen: () => void;
  onBreath: () => void;
  onAskLuna: () => void;
  onAddHome: () => void;
  meditationView: (meditation: Meditation) => MeditationView;
  categoryLabel: (category: string) => string;
  moodLabel: (mood: MoodChip) => string;
  durationLabel: (seconds: number) => string;
};

export function HomeV2(props: HomeV2Props) {
  const [soundExpanded, setSoundExpanded] = useState(false);
  const [soundOverflow, setSoundOverflow] = useState(false);
  const soundChooserRef = useRef<HTMLDivElement | null>(null);
  const activeScene = props.selectedScene ?? props.scenes[0] ?? null;
  const discoveryItems = props.explore.length ? props.explore : props.recentlyPlayed;

  useEffect(() => {
    if (!soundExpanded) {
      setSoundOverflow(false);
      return;
    }

    const chooser = soundChooserRef.current;
    if (!chooser) return;
    const measure = () => setSoundOverflow(chooser.scrollWidth > chooser.clientWidth + 2);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(chooser);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [props.scenes.length, soundExpanded]);

  if (props.loading && !props.daily) {
    return (
      <div className="home-v2-loading" aria-busy="true" aria-label={props.labels.preparingCalm}>
        <div className="home-v2-skeleton home-v2-skeleton-hero" />
        <div className="home-v2-skeleton home-v2-skeleton-row" />
        <div className="home-v2-skeleton home-v2-skeleton-row home-v2-skeleton-row-short" />
      </div>
    );
  }

  return (
    <div className="home-v2">
      {props.daily ? (
        <V2Hero
          greeting={props.greeting}
          firstName={props.firstName}
          headline={props.labels.feeling}
          moods={props.moods}
          activeMood={props.mood}
          moodLabel={props.moodLabel}
          language={props.language}
          checkinLine={props.checkinLine}
          checkinToast={props.labels.checkinToast}
          showCheckinToast={props.showCheckinToast}
          moodSaved={props.moodSaved}
          moodSaving={props.moodSaving}
          changeLabel={props.language === 'ru' ? 'Изменить' : 'Change'}
          onCheckinDetails={props.onCheckinDetails}
          onMood={props.setMood}
        />
      ) : props.loading ? (
        <V2HeroFallback title={props.labels.preparingCalm} body={props.labels.brandMeta} />
      ) : (
        <V2HeroFallback title={props.labels.firstPracticeTitle} body={props.labels.firstPracticeBody} />
      )}

      {props.daily ? (
        <V2Recommendation
          title={props.labels.todayRecommendation}
          meditation={props.daily}
          view={props.meditationView(props.daily)}
          categoryLabel={props.categoryLabel(props.daily.category)}
          durationLabel={props.durationLabel(props.daily.duration)}
          premiumLabel={props.labels.premium}
          freeLabel={props.labels.free}
          checkinLine={props.checkinLine}
          checkinMeta={props.checkinMeta}
          onOpen={() => props.onOpen(props.daily!)}
        />
      ) : null}

      <V2Stats stats={props.stats} />

      <V2Discovery
        title={props.labels.moreToExplore}
        viewAllLabel={props.labels.viewAll}
        meditations={discoveryItems}
        onViewAll={props.onLibrary}
        onOpen={props.onOpen}
        meditationView={props.meditationView}
        categoryLabel={props.categoryLabel}
        durationLabel={props.durationLabel}
        premiumLabel={props.labels.premium}
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
        askTitle={props.labels.askLunaTitle}
        askBody={props.labels.askLunaBody}
        askAction={props.labels.askLunaAction}
        askMessage={props.assistantMessage}
        onBreath={props.onBreath}
        onAsk={props.onAskLuna}
      />

      <section className="home-v2-sound-section">
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
      </section>

      {soundExpanded ? (
        <div ref={soundChooserRef} className={`home-v2-sound-chooser ${soundOverflow ? 'home-v2-sound-chooser-overflow' : ''}`}>
          {props.scenes.map((scene) => {
            const locked = scene.access === 'premium' && !props.hasPremium;
            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => props.onSoundSelect(scene)}
                className={props.selectedScene?.id === scene.id ? 'home-v2-choice home-v2-choice-active' : 'home-v2-choice'}
              >
                {scene.title[props.language]} {locked ? <Crown size={14} aria-label={props.labels.premium} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <button type="button" onClick={props.onAddHome} className="home-v2-home-action">
        <BrandLogo size={42} alt={props.language === 'ru' ? 'Логотип Luna Meditation' : 'Luna Meditation logo'} />
        <span>
          <strong>{props.labels.addHomeTitle}</strong>
          <small>{props.homeScreenMessage || props.labels.addHomeBody}</small>
        </span>
        {props.homeScreenStatus === 'idle' ? <em>{props.labels.addHomeAction} →</em> : null}
      </button>
    </div>
  );
}
