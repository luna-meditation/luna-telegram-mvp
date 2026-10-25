import { useState } from 'react';
import type { AppLanguage, Meditation } from '../../api';
import { BrandLogo } from '../../design-system/components/BrandLogo';
import { V2Continue } from '../components/V2Continue';
import { V2Discovery, V2PracticeTiles } from '../components/V2Discovery';
import { V2Hero, V2HeroFallback } from '../components/V2Hero';
import { V2Recommendation } from '../components/V2Recommendation';
import { V2Sound } from '../components/V2Sound';
import {SoundscapeSheet} from '../components/SoundscapeSheet';
import { V2Stats, type V2Stat } from '../components/V2Stats';
import { HomeDiscovery, HomeProgress } from '../../luna2/HomeDiscovery';
import '../design-system/homeV2.css';
import {MeetLunaEntry} from '../../luna2/MeetLunaEntry';
import '../../luna2/meet42.css';

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
  audioSrc: string;
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
  registerBackHandler?:(handler:(()=>void)|null)=>void;
  initData?:string;
  newNavigation?: boolean;
  tarotEnabled?: boolean;
  gardenLevel?: number;
  onTarot: () => void;
  onDaily?:()=>void;
  onAstrology?:()=>void;
  onJourney: () => void;
  onGarden: () => void;
  onPersonalize?: () => void;
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
  const activeScene = props.selectedScene ?? props.scenes[0] ?? null;
  const discoveryItems = props.explore.length ? props.explore : props.recentlyPlayed;

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
    <div className={`home-v2 ${props.newNavigation ? 'luna2-home' : ''}`}>
      {props.daily || props.newNavigation ? (
        <V2Hero
          greeting={props.greeting}
          premiumHome={props.newNavigation}
          onTalk={props.onAskLuna}
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

      {props.newNavigation && <HomeDiscovery initData={props.initData} language={props.language} tarotEnabled={Boolean(props.tarotEnabled)} onTarot={props.onTarot} onDaily={props.onDaily} onAstrology={props.onAstrology} onMeditate={props.onLibrary} onBreathe={props.onBreath} />}
      {props.newNavigation&&<MeetLunaEntry initData={props.initData} language={props.language}/>}

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

      {props.newNavigation ? <HomeProgress language={props.language} streak={props.stats[0]?.value ?? '—'} checkins={props.stats[1]?.value ?? '—/7'} gardenLevel={props.gardenLevel} onJourney={props.onJourney} onGarden={props.onGarden} /> : <V2Stats stats={props.stats} />}

      {!props.newNavigation && <V2Discovery
        title={props.labels.moreToExplore}
        viewAllLabel={props.labels.viewAll}
        meditations={discoveryItems}
        onViewAll={props.onLibrary}
        onOpen={props.onOpen}
        meditationView={props.meditationView}
        categoryLabel={props.categoryLabel}
        durationLabel={props.durationLabel}
        premiumLabel={props.labels.premium}
      />}

      <V2Continue
        title={props.labels.continueListening}
        meditations={props.continueListening}
        onOpen={props.onOpen}
        meditationView={props.meditationView}
        durationLabel={props.durationLabel}
      />

      {!props.newNavigation && <V2PracticeTiles
        breathTitle={props.labels.breathTitle}
        breathBody={props.labels.breathBody}
        breathAction={props.labels.begin}
        askTitle={props.labels.askLunaTitle}
        askBody={props.labels.askLunaBody}
        askAction={props.labels.askLunaAction}
        onBreath={props.onBreath}
        onAsk={props.onAskLuna}
      />}

      <div className="luna30-home-utilities">
      <section className="home-v2-sound-section">
        {activeScene ? (
          <V2Sound
            scene={activeScene}
            playing={props.scenePlaying}
            language={props.language}
            activeLabel={props.labels.soundActive}
            selectLabel={props.labels.soundSelect}
            onOpen={() => setSoundExpanded(true)}
            onToggle={props.onSoundToggle}
            onExpand={() => setSoundExpanded((value) => !value)}
          />
        ) : null}
      {soundExpanded && <SoundscapeSheet scenes={props.scenes} selectedId={props.selectedScene?.id} playing={props.scenePlaying} language={props.language} hasPremium={props.hasPremium} onSelect={id=>{const scene=props.scenes.find(item=>item.id===id);if(scene)props.onSoundSelect(scene);}} onToggle={props.onSoundToggle} onClose={()=>setSoundExpanded(false)} registerBackHandler={props.registerBackHandler}/>}
      </section>


      </div>


      {!props.newNavigation && <button type="button" onClick={props.onAddHome} className="home-v2-home-action">
        <BrandLogo size={42} alt={props.language === 'ru' ? 'Логотип Luna Meditation' : 'Luna Meditation logo'} />
        <span>
          <strong>{props.labels.addHomeTitle}</strong>
          <small>{props.homeScreenMessage || props.labels.addHomeBody}</small>
        </span>
        {props.homeScreenStatus === 'idle' ? <em>{props.labels.addHomeAction} →</em> : null}
      </button>}
    </div>
  );
}
