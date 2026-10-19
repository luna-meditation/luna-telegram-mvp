import {useEffect,useRef,useState} from 'react';
import {X,CheckCircle} from 'lucide-react';
import {startVerifiedBreath,heartbeatVerifiedBreath,type AppLanguage} from '../../api';
import {featureFlags} from '../../config/featureFlags';
import {breathCycleSeconds,breathPhaseAt,breathPhaseLabel,type BreathPracticeId,type BreathPractice} from './practices';
import {useBreathPractices} from './editorialPractices';
import {PracticePicker} from './PracticePicker';
import {useBreathAudio} from './useBreathAudio';
import {BreathAudioModes,BreathingVisual} from '../../luna2/BreathingVisual';
import './embedded.css';
import {SourceReflection} from '../../luna2/SourceReflection';
type BreathMode=BreathPracticeId;
type Proof={clientId:string;id?:string;promise?:Promise<{id:string}>;previous?:Promise<unknown>};
type CachedSession={mode:BreathMode;minutes:number;elapsed:number;done:boolean;recorded:boolean;sessionStarted:boolean;proof:Proof;practice:BreathPractice};
const inlineSessions=new Map<string,CachedSession>();
const breathCopy={en:{categoryBreath:'Breath',breathCircle:'Breath Circle',close:'Close',breathSaveError:'Could not save your practice. Retry saving; no second session is started.',breathComplete:'Breath practice complete',startBreathing:'Start breathing'},ru:{categoryBreath:'Дыхание',breathCircle:'Круг дыхания',close:'Закрыть',breathSaveError:'Не удалось сохранить практику. Повтори сохранение — новая сессия не запускается.',breathComplete:'Дыхательная практика завершена',startBreathing:'Начать дыхание'}};
const formatTime=(seconds:number)=>{const value=Math.max(0,Math.floor(seconds));return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`;};

export function BreathPracticeSession({
  initData,
  launch,
  initial,
  embedded = false,
  cacheKey,
  onOpenFull,
  onComplete,
  onClose,
  language,
  redesigned = false,
  registerBackHandler
}: {
  initData?:string;
  launch?:{practiceId:BreathPracticeId;minutes:number}|null;
  initial?:{practiceId:BreathPracticeId;minutes:number};
  embedded?:boolean;
  cacheKey?:string;
  onOpenFull?:(practiceId:BreathPracticeId,minutes:number)=>void;
  onComplete: (mode: BreathMode, durationSeconds: number, breathCount: number,sessionId?:string) => Promise<void>;
  onClose: () => void;
  language: AppLanguage;
  redesigned?: boolean;
  registerBackHandler?:(handler:(()=>void)|null)=>void;
}) {
  const cachedSession=embedded&&cacheKey?inlineSessions.get(cacheKey):undefined;
  const [mode, setMode] = useState<BreathMode>(cachedSession?.mode??launch?.practiceId??initial?.practiceId??'calm');
  const [minutes, setMinutes] = useState(cachedSession?.minutes??launch?.minutes??initial?.minutes??1);
  const [running, setRunning] = useState(Boolean(launch));
  const [elapsed, setElapsed] = useState(cachedSession?.elapsed??0);
  const [done, setDone] = useState(cachedSession?.done??false);
  const [savingError, setSavingError] = useState('');
  const [recorded,setRecorded]=useState(cachedSession?.recorded??false);
  const [saving,setSaving]=useState(false);
  const startedAtRef = useRef<number | null>(launch?Date.now():null);
  const [sessionStarted, setSessionStarted] = useState(cachedSession?.sessionStarted??Boolean(launch));
  const breathAudio=useBreathAudio(redesigned&&featureFlags.breathwork_audio,language,featureFlags.breathwork_guided,()=>setRunning(false));
  useEffect(()=>{if(!running)breathAudio.pause();},[running]);
  const durationSeconds = minutes * 60;
  const currentPractices=useBreathPractices();
  const selectedPractice=currentPractices.find(item=>item.id===mode)??currentPractices[0];
  // An editor publishing while this screen is open cannot change an active
  // session's timing. Pause/resume uses the same snapshot until reset.
  const practiceSnapshot=useRef(cachedSession?.practice??selectedPractice);
  if(!sessionStarted)practiceSnapshot.current=selectedPractice;
  const practice=practiceSnapshot.current;
  useEffect(()=>{if(launch)breathAudio.start(practice);},[]);
  const phase = breathPhaseAt(practice, elapsed);
  useEffect(()=>{breathAudio.cue(practice,elapsed,running);},[practice,elapsed,running,language,breathAudio.mode]);
  const hasStarted = (redesigned ? sessionStarted : elapsed > 0) && !done;
  const proof=useRef<Proof>(cachedSession?.proof??{clientId:crypto.randomUUID()});
  useEffect(()=>{if(!embedded||!cacheKey)return;inlineSessions.set(cacheKey,{mode,minutes,elapsed,done,recorded,sessionStarted,proof:proof.current,practice:practiceSnapshot.current});if(inlineSessions.size>12)inlineSessions.delete(inlineSessions.keys().next().value!);},[embedded,cacheKey,mode,minutes,elapsed,done,recorded,sessionStarted]);
  const ensureProof=()=>{const current=proof.current;if(current.promise)return current.promise;const request=Promise.resolve(current.previous).then(()=>startVerifiedBreath(current.clientId,mode,durationSeconds,initData));current.promise=request;void request.catch(()=>{if(current.promise===request)current.promise=undefined;});return request;};
  const resetProof=()=>{const current=proof.current;proof.current={clientId:crypto.randomUUID(),previous:current.promise?current.promise.then(value=>heartbeatVerifiedBreath(value.id,false,initData)).catch(()=>undefined):current.previous};};
  useEffect(()=>{
    if(!running)return;
    let alive=true;
    const session=ensureProof();
    const beat=(active:boolean)=>void session.then(value=>heartbeatVerifiedBreath(value.id,active,initData)).catch(()=>{if(alive)setSavingError(breathCopy[language].breathSaveError);});
    beat(true);const timer=window.setInterval(()=>beat(true),5000);
    const hidden=()=>{if(document.visibilityState==='hidden')setRunning(false);};document.addEventListener('visibilitychange',hidden);
    return()=>{alive=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',hidden);beat(false);};
  },[running,mode,durationSeconds,initData]);

  const saveCompletion=()=>{setSaving(true);setSavingError('');const completedBreaths=Math.max(1,Math.floor(durationSeconds/breathCycleSeconds(practice)));return ensureProof().then(async value=>{await onComplete(mode,durationSeconds,completedBreaths,value.id);proof.current.id=value.id;}).then(()=>setRecorded(true)).catch(()=>setSavingError(breathCopy[language].breathSaveError)).finally(()=>setSaving(false));};

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const startedAt = startedAtRef.current ?? Date.now() - elapsed * 1000;
      const nextElapsed = Math.min(durationSeconds, (Date.now() - startedAt) / 1000);
      setElapsed(nextElapsed);
      if (nextElapsed >= durationSeconds) {
        window.clearInterval(timer);
        setRunning(false);
        setDone(true);
        void saveCompletion();
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [durationSeconds, language, mode, onComplete, practice, running]);

  const startOrResume = () => {
    if(saving)return;
    if(done||!sessionStarted)resetProof();
    breathAudio.start(practice);
    const resumeElapsed = done ? 0 : elapsed;
    setSavingError('');
    setRecorded(false);
    setDone(false);
    setElapsed(resumeElapsed);
    startedAtRef.current = Date.now() - resumeElapsed * 1000;
    setSessionStarted(true);
    setRunning(true);
    if (redesigned&&!embedded) window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const restart = () => {
    if(saving)return;
    resetProof();
    setRunning(false);
    setDone(false);
    setRecorded(false);
    setElapsed(0);
    setSavingError('');
    startedAtRef.current = null;
    setSessionStarted(false);
    breathAudio.reset();
  };

  return (
    <div data-testid={embedded?'chat-breathing':'breath-practice-session'} data-session-state={running?'running':done?'completed':sessionStarted?'paused':'ready'} className={`breath-circle-page luna-fade ${embedded?'luna-intelligence-breath':''} ${redesigned ? 'luna2-breath' : ''} ${redesigned && (running || hasStarted) ? 'is-practicing' : ''}`}>
      <div className="breath-circle-header">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold">{breathCopy[language].categoryBreath}</p>
          <h2 className="type-page-title">{breathCopy[language].breathCircle}</h2>
          <p>{language === 'en' ? 'Follow one quiet phase at a time.' : 'Следуй за одной спокойной фазой за раз.'}</p>
        </div>
        {!embedded&&<button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full bg-surface text-cream" aria-label={breathCopy[language].close}>
          <X size={18} />
        </button>}
      </div>

      <section className="breath-circle-visual" aria-live={redesigned ? undefined : 'polite'}>
        {redesigned ? <BreathingVisual practice={practice} phase={phase} active={hasStarted || running} done={done} minutes={minutes} language={language} running={running} onToggle={running?()=>setRunning(false):startOrResume} /> : (
        <div className={`breath-circle-orbit ${running ? 'is-running' : ''}`} data-phase={hasStarted || running ? phase.kind : 'ready'}>
          <div
            className={`breath-circle-core ${running ? 'is-running' : ''}`}
            style={{ transform: `scale(${hasStarted || running ? phase.scale : 0.9})` }}
          >
            <div>
              <p className="breath-circle-phase">{hasStarted || running ? breathPhaseLabel(phase.kind, language) : (language === 'en' ? 'Ready' : 'Готово')}</p>
              <p className="breath-circle-count">{hasStarted || running ? phase.remaining : `${minutes} ${language === 'en' ? 'min' : 'мин'}`}</p>
            </div>
          </div>
        </div>
        )}
        <div className="breath-circle-session-meta">
          <strong>{practice.name[language]}</strong>
          <span>{practice.timing[language]}</span>
          <small>{running || hasStarted ? `${language === 'en' ? 'Session' : 'Сессия'} · ${formatTime(Math.max(0, durationSeconds - elapsed))}` : practice.description[language]}</small>
        </div>
      </section>

      {redesigned && !embedded && <BreathAudioModes language={language} featureEnabled={featureFlags.breathwork_audio} guidedAvailable={featureFlags.breathwork_guided} mode={breathAudio.mode} onMode={mode=>breathAudio.setMode(mode,running)} volume={breathAudio.volume} onVolume={breathAudio.setVolume} voiceVolume={breathAudio.voiceVolume} onVoiceVolume={breathAudio.setVoiceVolume} muted={breathAudio.muted} onMute={()=>breathAudio.setMuted(value=>!value)} error={breathAudio.error}/>}

      {!(embedded&&hasStarted)&&<details className="luna-intelligence-breath-options" open={!embedded}><summary hidden={!embedded}>{language==='ru'?'Настроить практику':'Practice options'}</summary><section className="breath-circle-controls">
        {redesigned?<PracticePicker value={mode} onChange={setMode} disabled={running||hasStarted} language={language} registerBackHandler={registerBackHandler}/>:<label className="breath-practice-select">
          <span>{language === 'en' ? 'Practice' : 'Практика'}</span>
          <select value={mode} onChange={(event) => setMode(event.currentTarget.value as BreathMode)} disabled={running || hasStarted} aria-label={language === 'en' ? 'Breathing practice' : 'Дыхательная практика'}>
            {currentPractices.map((item) => <option key={item.id} value={item.id}>{item.name[language]} — {item.timing[language]}</option>)}
          </select>
        </label>}
        <details className="breath-practice-guide">
          <summary>{language === 'en' ? 'How to practice' : 'Как выполнять'}</summary>
          <p>{practice.guide[language]}</p>
        </details>
        <details className="breath-practice-guide"><summary>{language==='en'?'Why this practice':'Для чего эта практика'}</summary><p>{practice.description[language]} {language==='en'?'Choose a comfortable rhythm; this is a wellbeing practice, not medical treatment.':'Выбирай комфортный ритм. Это практика для самочувствия, а не лечение.'}</p></details>
        <div className="breath-duration-options" role="group" aria-label={language === 'en' ? 'Session duration' : 'Длительность сессии'}>
          {[1, 3, 5, 10].map((item) => (
            <button key={item} onClick={() => setMinutes(item)} disabled={running || hasStarted} aria-pressed={minutes === item}>
              {item} {language === 'en' ? 'min' : 'мин'}
            </button>
          ))}
        </div>
      </section></details>}

      {done ? (
        <div className="rounded-[24px] border border-gold/20 bg-gold/10 p-4 text-center">
          <CheckCircle className="mx-auto text-gold" />
          <h3 className="type-section-title mt-2">{breathCopy[language].breathComplete}</h3>
          <p className="mt-2 text-sm text-cream/75">
            {language==='ru'?`Спокойных циклов: ${Math.max(1, Math.floor(durationSeconds / breathCycleSeconds(practice)))}`:`Calm cycles: ${Math.max(1, Math.floor(durationSeconds / breathCycleSeconds(practice)))}`}
          </p>
          <p role="status">{saving?(language==='ru'?'Сохраняем завершение…':'Saving completion…'):recorded?(language==='ru'?'Завершение сохранено':'Completion recorded'):savingError||''}</p>{savingError&&<button type="button" disabled={saving} onClick={()=>void saveCompletion()}>{language==='ru'?'Повторить сохранение':'Retry saving'}</button>}
        </div>
      ) : null}

      {recorded&&proof.current.id&&<SourceReflection key={proof.current.id} kind="breath" referenceId={proof.current.id} language={language} initData={initData}/>}
      <div className="breath-circle-actions">
        {embedded&&hasStarted&&<button type="button" className="breath-circle-restart" onClick={restart}>{language==='ru'?'Остановить':'Stop'}</button>}
        {embedded&&onOpenFull&&!hasStarted&&<button type="button" className="breath-circle-restart" onClick={()=>{setRunning(false);onOpenFull(mode,minutes);}}>{language==='ru'?'Открыть полную практику':'Open full practice'}</button>}
        {redesigned && !embedded && done && <button type="button" onClick={onClose} className="breath-circle-primary">{language==='ru'?'Завершить':'Finish'}</button>}
        {(!embedded&&hasStarted || done) && <button type="button" onClick={restart} className="breath-circle-restart">{language === 'en' ? 'Restart' : 'Сначала'}</button>}
        {!redesigned && <button
          type="button"
          onClick={running ? () => setRunning(false) : startOrResume}
          className="breath-circle-primary"
          aria-label={running ? (language === 'en' ? 'Pause breathing practice' : 'Пауза дыхательной практики') : undefined}
        >
          {running ? (language === 'en' ? 'Pause' : 'Пауза') : hasStarted ? (language === 'en' ? 'Resume' : 'Продолжить') : done ? (language === 'en' ? 'Start again' : 'Начать снова') : breathCopy[language].startBreathing}
        </button>}
      </div>
    </div>
  );
}
