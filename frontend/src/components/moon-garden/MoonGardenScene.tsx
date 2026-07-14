import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, Settings, Volume2 } from 'lucide-react';
import './moonGardenScene.css';

export type MoonGardenSceneStage = {
  level: number;
  path: string;
  videoPath?: string;
  title: string;
  subtitle?: string;
};

type MoonGardenSceneProps = {
  stage: MoonGardenSceneStage;
  statusLabel: string;
  compact?: boolean;
  soundPlaying?: boolean;
  soundVolume: number;
  soundError?: boolean;
  soundLabel: string;
  soundVolumeLabel: string;
  soundUnavailableLabel: string;
  onToggleSound: () => void;
  onSoundVolumeChange: (volume: number) => void;
};

const stars: Array<[number, number, number, number]> = [
  [10, 14, 1.4, 0.1], [18, 24, 0.9, 1.2], [28, 12, 1.2, 2.1], [39, 21, 0.8, 0.6],
  [52, 10, 1.5, 1.8], [63, 18, 0.9, 0.3], [72, 9, 1.1, 2.6], [84, 23, 1.3, 1.1],
  [91, 14, 0.8, 2.2], [14, 36, 0.8, 2.8], [47, 34, 0.9, 1.5], [79, 38, 0.7, 0.4]
];

const motes: Array<[number, number, number]> = [
  [18, 66, 0.4], [30, 58, 2.2], [43, 72, 1.4], [58, 61, 3.1], [70, 74, 1], [83, 54, 2.5], [91, 68, 1.8]
];

function StarsLayer({ level }: { level: number }) {
  const count = Math.min(stars.length, 5 + level);
  return (
    <div className="moon-garden-stars" aria-hidden="true">
      {stars.slice(0, count).map(([left, top, size, delay]) => (
        <span key={left + '-' + top} className="moon-garden-star" style={{ left: left + '%', top: top + '%', width: size + 'px', height: size + 'px', animationDelay: delay + 's' }} />
      ))}
    </div>
  );
}

function FirefliesLayer({ level }: { level: number }) {
  if (level < 3) return null;
  return (
    <div className="moon-garden-fireflies" aria-hidden="true">
      {motes.slice(0, Math.min(motes.length, level + 1)).map(([left, top, delay]) => (
        <span key={left + '-' + top} className="moon-garden-mote" style={{ left: left + '%', top: top + '%', animationDelay: delay + 's' }} />
      ))}
    </div>
  );
}

export function MoonGardenScene({
  stage,
  statusLabel,
  compact = false,
  soundPlaying = false,
  soundVolume,
  soundError = false,
  soundLabel,
  soundVolumeLabel,
  soundUnavailableLabel,
  onToggleSound,
  onSoundVolumeChange
}: MoonGardenSceneProps) {
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  const level = Math.max(0, Math.min(7, stage.level));
  const intensity = useMemo(() => (level / 7).toFixed(2), [level]);

  useEffect(() => {
    setImageError(false);
    setVideoError(false);
    setVideoReady(false);
    setSoundOpen(false);
  }, [stage.path, stage.videoPath]);

  useEffect(() => {
    if (imageError && import.meta.env.DEV) console.info('[Luna Moon Garden image fallback]', stage.path);
  }, [imageError, stage.path]);

  const useVideo = Boolean(stage.videoPath && !videoError);

  return (
    <section
      className={'moon-garden-scene ' + (compact ? 'moon-garden-scene-compact' : 'moon-garden-scene-immersive') + (soundPlaying ? ' moon-garden-scene-listening' : '')}
      style={{ '--garden-level': String(level), '--garden-intensity': intensity } as React.CSSProperties}
      aria-label={statusLabel}
    >
      {useVideo && (
        <video
          key={stage.videoPath}
          src={stage.videoPath}
          aria-label={statusLabel}
          autoPlay
          muted
          loop
          playsInline
          onCanPlay={() => setVideoReady(true)}
          onError={() => setVideoError(true)}
          className={'moon-garden-scene-image moon-garden-scene-video ' + (videoReady ? 'moon-garden-scene-video-ready' : '')}
        />
      )}
      {imageError && !useVideo ? (
        <div className="moon-garden-scene-fallback" role="img" aria-label={statusLabel} />
      ) : !imageError ? (
        <img src={stage.path} alt={statusLabel} draggable={false} onError={() => setImageError(true)} className="moon-garden-scene-image" />
      ) : null}
      <div className="moon-garden-scene-vignette" aria-hidden="true" />
      <StarsLayer level={level} />
      <div className="moon-garden-water-shimmer" aria-hidden="true" />
      <div className="moon-garden-water-ripples" aria-hidden="true"><span /><span /><span /></div>
      <div className="moon-garden-mist moon-garden-mist-a" aria-hidden="true" />
      <div className="moon-garden-mist moon-garden-mist-b" aria-hidden="true" />
      {level >= 1 && <div className="moon-garden-bloom-glow" aria-hidden="true" />}
      {level >= 2 && <div className="moon-garden-lantern-glow" aria-hidden="true" />}
      {level >= 3 && <div className="moon-garden-path-glow" aria-hidden="true" />}
      {level >= 5 && <div className="moon-garden-bridge-reflection" aria-hidden="true" />}
      {level >= 6 && <div className="moon-garden-deep-atmosphere" aria-hidden="true" />}
      {level >= 7 && <div className="moon-garden-full-moon-aura" aria-hidden="true" />}
      <FirefliesLayer level={level} />
      <div className="moon-garden-scene-chip">{statusLabel}</div>
      <div className="moon-garden-sound-control">
        {soundOpen && (
          <div className="moon-garden-sound-panel">
            <label>
              <span><Volume2 size={13} />{soundVolumeLabel} · {Math.round(soundVolume * 100)}%</span>
              <input aria-label={soundVolumeLabel} type="range" min="0" max="1" step="0.01" value={soundVolume} onChange={(event) => onSoundVolumeChange(Number(event.target.value))} />
            </label>
            {soundError && <p>{soundUnavailableLabel}</p>}
          </div>
        )}
        <div className="moon-garden-sound-row">
          <button type="button" className={'moon-garden-sound-pill ' + (soundPlaying ? 'moon-garden-sound-pill-active' : '')} onClick={() => { onToggleSound(); setSoundOpen(true); }} aria-label={soundLabel}>
            {soundPlaying ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
            <span>{soundLabel}</span>
          </button>
          <button type="button" className="moon-garden-sound-settings" onClick={() => setSoundOpen((value) => !value)} aria-label={soundVolumeLabel}>
            <Settings size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
