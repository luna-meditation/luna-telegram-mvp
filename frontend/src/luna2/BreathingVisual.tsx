import { AudioLines, Mic, VolumeX } from 'lucide-react';
import type { AppLanguage } from '../api';
import type { BreathPhaseKind, BreathPractice } from '../features/breathing/practices';
import { breathPhaseLabel } from '../features/breathing/practices';
import { breathVisualScale } from '../features/breathing/visual';
import { luna2Copy } from './copy';
import type {BreathAudioMode} from '../features/breathing/useBreathAudio';

export function BreathingVisual({ practice, phase, active, done, minutes, language, running=false, onToggle }: {
  practice: BreathPractice; phase: { kind: BreathPhaseKind; progress: number; remaining: number }; active: boolean; done: boolean; minutes: number; language: AppLanguage;
  running?:boolean;onToggle?:()=>void;
}) {
  const t = luna2Copy[language];
  const scale = active ? breathVisualScale(practice, phase.kind, phase.progress) : 0.86;
  const action=running?(language==='ru'?'Пауза':'Pause'):active?(language==='ru'?'Продолжить':'Resume'):done?(language==='ru'?'Начать снова':'Start again'):(language==='ru'?'Нажми, чтобы начать':'Tap to begin');
  return <button type="button" onClick={onToggle} className="luna2-breath-visual luna30-breath-control" data-testid="luminous-breath-ring" data-phase={active ? phase.kind : done ? 'complete' : 'ready'} aria-label={action} aria-pressed={running}>
    <span className="luna2-breath-halo" aria-hidden="true" /><span className="luna2-breath-ring" aria-hidden="true" style={{ transform: `scale(${scale})` }}><span /></span>
    <span className="luna2-breath-readout"><span className="luna30-phase" aria-live="polite">{active ? running?breathPhaseLabel(phase.kind, language):(language==='ru'?'Пауза':'Paused') : done ? t.finished : t.ready}</span><strong aria-live="off">{active ? phase.remaining : done?'✓':'▷'}</strong><span>{active ? t.seconds : `${minutes} ${language === 'ru' ? 'мин' : 'min'}`}</span></span><span className="luna30-tap-hint">{action}</span>
  </button>;
}

export function BreathAudioModes({ language, featureEnabled,guidedAvailable=false,mode='silent',onMode,volume=.35,onVolume,muted=false,onMute,error=false }: { language: AppLanguage; featureEnabled: boolean;guidedAvailable?:boolean;mode?:BreathAudioMode;onMode?:(mode:BreathAudioMode)=>void;volume?:number;onVolume?:(volume:number)=>void;muted?:boolean;onMute?:()=>void;error?:boolean }) {
  const t = luna2Copy[language];
  return <section className="luna2-audio-modes" data-feature-flag="breathwork_audio" data-feature-enabled={featureEnabled} aria-label={t.audioMode}>
    <div role="group" aria-label={t.audioMode}><button type="button" aria-pressed={mode==='silent'} onClick={()=>onMode?.('silent')}><VolumeX size={18} />{t.silent}</button><button type="button" disabled={!featureEnabled} aria-pressed={mode==='ambient'} onClick={()=>onMode?.('ambient')}><AudioLines size={18} />{t.ambient}{!featureEnabled&&<small>{t.soon}</small>}</button><button type="button" disabled={!featureEnabled||!guidedAvailable} aria-pressed={mode==='guided'} onClick={()=>onMode?.('guided')}><Mic size={18} />{t.guided}{!guidedAvailable&&<small>{t.soon}</small>}</button></div>
    {featureEnabled&&mode!=='silent'&&<div className="luna30-audio-volume"><button type="button" onClick={onMute} aria-pressed={muted} aria-label={language==='ru'?'Выключить звук':'Mute audio'}><VolumeX size={18}/></button><label>{language==='ru'?'Громкость':'Volume'}<input type="range" min="0" max="1" step=".05" value={volume} onChange={e=>onVolume?.(Number(e.target.value))}/></label></div>}
    <p role={error?'status':undefined}>{error?(language==='ru'?'Звук недоступен. Практика продолжается в тишине.':'Audio is unavailable. The practice continues silently.'):featureEnabled&&mode==='guided'?(language==='ru'?'Короткие команды созданы AI. Ритм следует таймеру практики; остановись, если некомфортно.':'These short phase cues use an AI-generated voice. They follow the session timer; stop if uncomfortable.'):featureEnabled?guidedAvailable?(language==='ru'?'Выбери тишину, атмосферную запись или короткие голосовые подсказки.':'Choose silence, a recorded ambience or short voice cues.'):(language==='ru'?'Без звука или с атмосферной записью. Голосовое сопровождение пока недоступно.':'Choose silence or a recorded ambience. Voice guidance is not available yet.'):t.audioNote}</p>
  </section>;
}
