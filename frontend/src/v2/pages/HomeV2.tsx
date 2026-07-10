import { Pause, Play, Sparkles, Waves } from 'lucide-react';
import { useState } from 'react';
import type { AppLanguage, Meditation } from '../../api';
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

  return (
    <div className="home-v2">
      <V2AppHeader quietLabel={props.heroLabel} brandMeta={props.labels.brandMeta} />

      <section className="home-v2-greeting">
        <p className="home-v2-kicker">{props.greeting}, {props.firstName}</p>
        <h1 className="home-v2-title">{props.labels.feeling}</h1>
        <div className="home-v2-mood-row" aria-label={props.labels.feeling}>
          {props.moods.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => props.setMood(item)}
              className={`home-v2-mood ${props.mood === item ? 'home-v2-mood-active' : ''}`}
            >
              {props.moodLabel(item)}
            </button>
          ))}
        </div>
        <div className="home-v2-checkin-line">
          {props.checkinLine}
          {props.checkinMeta ? <p className="home-v2-checkin-meta">{props.checkinMeta}</p> : null}
        </div>
      </section>

      {props.daily ? (
        <V2MeditationHero
          meditation={props.daily}
          label={props.heroLabel}
          labels={props.labels}
          view={props.meditationView(props.daily)}
          categoryLabel={props.categoryLabel(props.daily.category)}
          durationLabel={props.durationLabel(props.daily.duration)}
          onOpen={() => props.onOpen(props.daily!)}
        />
      ) : props.loading ? (
        <V2HeroSkeleton title={props.labels.preparingCalm} />
      ) : (
        <V2EmptyState title={props.labels.firstPracticeTitle} body={props.labels.firstPracticeBody} />
      )}

      <V2EditorialShelf
        title={props.labels.moreToExplore}
        meditations={props.explore}
        onOpen={props.onOpen}
        meditationView={props.meditationView}
        categoryLabel={props.categoryLabel}
        durationLabel={props.durationLabel}
      />

      <V2ContinueListening
        title={props.labels.continueListening}
        meditations={props.continueListening}
        onOpen={props.onOpen}
        meditationView={props.meditationView}
        categoryLabel={props.categoryLabel}
        durationLabel={props.durationLabel}
      />

      {activeScene ? (
        <>
          <V2CompactSoundControl
            scene={activeScene}
            playing={props.scenePlaying}
            labels={props.labels}
            language={props.language}
            onOpen={props.onSoundOpen}
            onToggle={props.onSoundToggle}
            onExpand={() => setSoundExpanded((value) => !value)}
          />
          {soundExpanded ? (
            <div className="home-v2-sound-options">
              {props.scenes.map((scene) => {
                const locked = scene.access === 'premium' && !props.hasPremium;
                return (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => props.onSoundSelect(scene)}
                    className={`home-v2-mood ${props.selectedScene?.id === scene.id ? 'home-v2-mood-active' : ''}`}
                  >
                    {scene.title[props.language]} {locked ? '⭐' : ''}
                  </button>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}

      <button type="button" onClick={props.onBreath} className="home-v2-discovery">
        <p className="home-v2-kicker">{props.labels.breathKicker}</p>
        <h2 className="home-v2-discovery-title">{props.labels.breathTitle}</h2>
        <p className="home-v2-hero-subtitle">{props.labels.breathBody}</p>
        <Sparkles className="absolute right-5 top-5 text-gold" size={22} />
      </button>

      {props.weeklyInsight ? (
        <section className="home-v2-insight">
          <p className="home-v2-kicker">{props.labels.weeklyTitle}</p>
          <p className="home-v2-insight-body">{props.weeklyInsight.body}</p>
          <p className="home-v2-insight-meta">{props.weeklyInsight.meta}</p>
        </section>
      ) : null}

      <button type="button" onClick={props.onLibrary} className="home-v2-subtle-action">
        <strong>{props.labels.openLibrary}</strong>
      </button>

      <button type="button" onClick={props.onAddHome} className="home-v2-subtle-action">
        <strong>{props.labels.addHomeTitle}</strong>
        <span className="mt-1 block text-xs text-lavender">{props.homeScreenMessage || props.labels.addHomeBody}</span>
      </button>

      <V2EditorialShelf
        title=""
        meditations={props.recentlyPlayed}
        onOpen={props.onOpen}
        meditationView={props.meditationView}
        categoryLabel={props.categoryLabel}
        durationLabel={props.durationLabel}
      />
    </div>
  );
}

function V2AppHeader({ quietLabel, brandMeta }: { quietLabel: string; brandMeta: string }) {
  return (
    <header className="home-v2-header">
      <div className="home-v2-brand">
        <span className="home-v2-mark" aria-hidden="true" />
        <div className="min-w-0">
          <p className="home-v2-wordmark">LUNA</p>
          <p className="home-v2-meta">{brandMeta}</p>
        </div>
      </div>
      <div className="home-v2-header-pill">{quietLabel}</div>
    </header>
  );
}

function V2MeditationHero({
  meditation,
  label,
  labels,
  view,
  categoryLabel,
  durationLabel,
  onOpen
}: {
  meditation: Meditation;
  label: string;
  labels: HomeV2Labels;
  view: MeditationView;
  categoryLabel: string;
  durationLabel: string;
  onOpen: () => void;
}) {
  const cta = meditation.history?.last_position ? labels.resume : labels.begin;
  return (
    <button type="button" onClick={onOpen} className="home-v2-hero">
      <img src={meditation.cover_image} alt="" loading="eager" />
      <span className="home-v2-hero-badge">{label}</span>
      <span className="home-v2-hero-lock">{meditation.premium ? labels.premium : labels.free}</span>
      <div className="home-v2-hero-copy">
        <h2 className="home-v2-hero-title">{view.title}</h2>
        <p className="home-v2-hero-subtitle">{view.subtitle || view.description}</p>
        <div className="home-v2-hero-footer">
          <span className="home-v2-hero-meta">{categoryLabel} · {durationLabel}</span>
          <span className="home-v2-play" aria-label={cta}><Play size={20} fill="currentColor" /></span>
        </div>
      </div>
    </button>
  );
}

function V2HeroSkeleton({ title }: { title: string }) {
  return (
    <div className="home-v2-hero">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/10 via-purple-900/20 to-gold/10" />
      <div className="home-v2-hero-copy">
        <h2 className="home-v2-hero-title">{title}</h2>
      </div>
    </div>
  );
}

function V2EditorialShelf({
  title,
  meditations,
  onOpen,
  meditationView,
  categoryLabel,
  durationLabel
}: {
  title: string;
  meditations: Meditation[];
  onOpen: (meditation: Meditation) => void;
  meditationView: (meditation: Meditation) => MeditationView;
  categoryLabel: (category: string) => string;
  durationLabel: (seconds: number) => string;
}) {
  if (!meditations.length) return null;
  return (
    <section className="home-v2-section">
      {title ? (
        <div className="home-v2-section-head">
          <h2 className="home-v2-section-title">{title}</h2>
        </div>
      ) : null}
      <div className="home-v2-shelf">
        {meditations.map((meditation) => {
          const view = meditationView(meditation);
          return (
            <button key={meditation.id} type="button" onClick={() => onOpen(meditation)} className="home-v2-shelf-card">
              <img src={meditation.cover_image} alt="" loading="lazy" />
              <p className="home-v2-shelf-title">{view.title}</p>
              <p className="home-v2-shelf-meta">{categoryLabel(meditation.category)} · {durationLabel(meditation.duration)}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function V2ContinueListening({
  title,
  meditations,
  onOpen,
  meditationView,
  categoryLabel,
  durationLabel
}: {
  title: string;
  meditations: Meditation[];
  onOpen: (meditation: Meditation) => void;
  meditationView: (meditation: Meditation) => MeditationView;
  categoryLabel: (category: string) => string;
  durationLabel: (seconds: number) => string;
}) {
  if (!meditations.length) return null;
  if (meditations.length > 1) {
    return (
      <V2EditorialShelf
        title={title}
        meditations={meditations}
        onOpen={onOpen}
        meditationView={meditationView}
        categoryLabel={categoryLabel}
        durationLabel={durationLabel}
      />
    );
  }

  const meditation = meditations[0];
  const view = meditationView(meditation);
  const progress = Math.max(0, Math.min(100, Number(meditation.history?.completion_percent ?? 0)));
  return (
    <section className="home-v2-section">
      <h2 className="home-v2-section-title">{title}</h2>
      <button type="button" onClick={() => onOpen(meditation)} className="home-v2-continue">
        <img src={meditation.cover_image} alt="" loading="lazy" />
        <div className="home-v2-continue-copy">
          <h3 className="home-v2-continue-title">{view.title}</h3>
          <p className="home-v2-shelf-meta">{categoryLabel(meditation.category)} · {durationLabel(meditation.duration)}</p>
          <div className="home-v2-progress"><span style={{ width: `${progress}%` }} /></div>
        </div>
      </button>
    </section>
  );
}

function V2CompactSoundControl({
  scene,
  playing,
  labels,
  language,
  onOpen,
  onToggle,
  onExpand
}: {
  scene: SceneDefinition;
  playing: boolean;
  labels: HomeV2Labels;
  language: AppLanguage;
  onOpen: () => void;
  onToggle: () => void;
  onExpand: () => void;
}) {
  return (
    <section className="home-v2-sound">
      <button type="button" onClick={onOpen} className="home-v2-sound-main">
        <span className="home-v2-sound-icon"><Waves size={20} /></span>
        <span className="min-w-0">
          <p className="home-v2-sound-title">{scene.title[language]}</p>
          <p className="home-v2-sound-subtitle">{playing ? labels.soundActive : scene.subtitle[language]}</p>
        </span>
      </button>
      <button type="button" onClick={onToggle} className="home-v2-sound-play" aria-label={labels.soundTitle}>
        {playing ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}
      </button>
      <button type="button" onClick={onExpand} className="home-v2-sound-select">
        {labels.soundSelect}
      </button>
    </section>
  );
}

function V2EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="home-v2-empty">
      <p className="home-v2-section-title">{title}</p>
      <p className="home-v2-hero-subtitle">{body}</p>
    </section>
  );
}
