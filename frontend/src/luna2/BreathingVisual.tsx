import { AudioLines, Mic, VolumeX } from 'lucide-react';
import type { AppLanguage } from '../api';
import type { BreathPhaseKind, BreathPractice } from '../features/breathing/practices';
import { breathPhaseLabel } from '../features/breathing/practices';
import { breathVisualScale } from '../features/breathing/visual';
import { luna2Copy } from './copy';

export function BreathingVisual({ practice, phase, active, done, minutes, language }: {
  practice: BreathPractice; phase: { kind: BreathPhaseKind; progress: number; remaining: number }; active: boolean; done: boolean; minutes: number; language: AppLanguage;
}) {
  const t = luna2Copy[language];
  const scale = active ? breathVisualScale(practice, phase.kind, phase.progress) : 0.86;
  return <div className="luna2-breath-visual" data-testid="luminous-breath-ring" data-phase={active ? phase.kind : done ? 'complete' : 'ready'}>
    <div className="luna2-breath-halo" aria-hidden="true" /><div className="luna2-breath-ring" aria-hidden="true" style={{ transform: `scale(${scale})` }}><span /></div>
    <div className="luna2-breath-readout"><p aria-live="polite">{active ? breathPhaseLabel(phase.kind, language) : done ? t.finished : t.ready}</p><strong aria-live="off">{active ? phase.remaining : `${minutes}`}</strong><span>{active ? t.seconds : language === 'ru' ? 'мин' : 'min'}</span></div>
  </div>;
}

export function BreathAudioModes({ language, featureEnabled }: { language: AppLanguage; featureEnabled: boolean }) {
  const t = luna2Copy[language];
  return <section className="luna2-audio-modes" data-feature-flag="breathwork_audio" data-feature-enabled={featureEnabled} aria-label={t.audioMode}>
    <div role="group" aria-label={t.audioMode}><button type="button" aria-pressed="true"><VolumeX size={18} />{t.silent}</button><button type="button" disabled><AudioLines size={18} />{t.ambient}<small>{t.soon}</small></button><button type="button" disabled><Mic size={18} />{t.guided}<small>{t.soon}</small></button></div><p>{t.audioNote}</p>
  </section>;
}
