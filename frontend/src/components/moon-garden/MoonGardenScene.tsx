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
  heading: string;
  emptyMessage: string;
  compact?: boolean;
  ambiencePlaying?: boolean;
};

export function MoonGardenScene({
  stage,
  heading,
  emptyMessage,
  compact = false,
  ambiencePlaying = false
}: MoonGardenSceneProps) {
  const [failedPath, setFailedPath] = useState<string | null>(null);
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
      className={`moon-garden-scene ${compact ? 'moon-garden-scene-compact' : 'moon-garden-scene-immersive'} ${ambiencePlaying ? 'moon-garden-scene-listening' : ''}`}
      style={{ '--garden-level': String(level), '--garden-intensity': intensity } as CSSProperties}
    >
      {!failedPath ? (
        <img
          key={stage.path}
          src={stage.path}
          alt={`${heading} level ${stage.level}`}
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
      {level >= 5 && <div className="moon-garden-bridge-reflection" aria-hidden="true" />}
      <FirefliesLayer level={level} />

      <div className="moon-garden-scene-copy">
        <p>{heading}</p>
        <h3>{stage.title}</h3>
        <span>{stage.subtitle}</span>
      </div>

      {level === 0 && (
        <p className="moon-garden-empty-message">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}
