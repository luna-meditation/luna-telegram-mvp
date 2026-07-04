import { Pause, Play, SlidersHorizontal, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { FirefliesLayer } from './FirefliesLayer';
import { StarsLayer } from './StarsLayer';
import './moonGardenScene.css';

type MoonGardenStage = {
  level: number;
  path: string;
  title: string;
  subtitle: string;
};

type MoonGardenSceneProps = {
  stage: MoonGardenStage;
  statusLabel: string;
  soundLabel: string;
  soundVolumeLabel: string;
  soundUnavailableLabel: string;
  compact?: boolean;
  soundPlaying?: boolean;
  soundVolume: number;
  soundError?: boolean;
  onToggleSound: () => void;
  onSoundVolumeChange: (volume: number) => void;
};

export function MoonGardenScene({
  stage,
  statusLabel,
  soundLabel,
  soundVolumeLabel,
  soundUnavailableLabel,
  compact = false,
  soundPlaying = false,
  soundVolume,
  soundError = false,
  onToggleSound,
  onSoundVolumeChange
}: MoonGardenSceneProps) {
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const [soundPanelOpen, setSoundPanelOpen] = useState(false);
  const level = Math.max(0, Math.min(7, stage.level));
  const intensity = useMemo(() => (level / 7).toFixed(2), [level]);

  useEffect(() => {
    setFailedPath(null);
  }, [stage.path]);

  const handleImageError = () => {
    setFailedPath(stage.path);
    if (import.meta.env.DEV) {
      console.warn('[MOON_GARDEN_STAGE_IMAGE_MISSING]', stage.path);
    }
  };

  return (
    <section
      className={`moon-garden-scene ${compact ? 'moon-garden-scene-compact' : 'moon-garden-scene-immersive'} ${soundPlaying ? 'moon-garden-scene-listening' : ''}`}
      style={{ '--garden-level': String(level), '--garden-intensity': intensity } as CSSProperties}
    >
      {!failedPath ? (
        <img
          key={stage.path}
          src={stage.path}
          alt={statusLabel}
          onError={handleImageError}
          className="moon-garden-scene-image"
          draggable={false}
        />
      ) : (
        <div className="moon-garden-scene-fallback" />
      )}

      <div className="moon-garden-scene-vignette" aria-hidden="true" />
      <StarsLayer level={level} />
      <div className="moon-garden-water-shimmer" aria-hidden="true" />
      <div className="moon-garden-water-ripples" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
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
        {soundPanelOpen && (
          <div className="moon-garden-sound-panel">
            <label>
              <span>
                <Volume2 size={13} />
                {soundVolumeLabel} · {Math.round(soundVolume * 100)}%
              </span>
              <input
                aria-label={soundVolumeLabel}
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={soundVolume}
                onChange={(event) => onSoundVolumeChange(Number(event.target.value))}
              />
            </label>
            {soundError && <p>{soundUnavailableLabel}</p>}
          </div>
        )}
        <div className="moon-garden-sound-row">
          <button
            type="button"
            className={`moon-garden-sound-pill ${soundPlaying ? 'moon-garden-sound-pill-active' : ''}`}
            onClick={() => {
              onToggleSound();
              setSoundPanelOpen(true);
            }}
            aria-label={soundLabel}
          >
            {soundPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span>{soundLabel}</span>
          </button>
          <button
            type="button"
            className="moon-garden-sound-settings"
            onClick={() => setSoundPanelOpen((value) => !value)}
            aria-label={soundVolumeLabel}
          >
            <SlidersHorizontal size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
