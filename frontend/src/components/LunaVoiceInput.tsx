import {useEffect,useRef,useState} from 'react';
import {Mic,Square,X,Check,RotateCcw,LoaderCircle} from 'lucide-react';
import {ApiRequestError,transcribeLunaVoice,type AppLanguage} from '../api';
import {prepareVoiceCapture,type VoiceCapture} from './voiceCapture';
import {observeAudioFocus,requestAudioFocus} from '../audioFocus';
import './voice42.css';

type VoiceState='idle'|'requesting'|'recording'|'processing'|'ready'|'sending'|'error';
export function LunaVoiceInput({language,initData,disabled,onTranscript,onBusy}:{language:AppLanguage;initData?:string;disabled:boolean;onTranscript:(text:string)=>void;onBusy:(busy:boolean)=>void}){
 const en=language==='en';
 const [state,setState]=useState<VoiceState>('idle'),[elapsed,setElapsed]=useState(0),[error,setError]=useState('');
 const capture=useRef<VoiceCapture|null>(null),preparation=useRef<ReturnType<typeof prepareVoiceCapture>|null>(null),wav=useRef<Blob|null>(null),operation=useRef(''),generation=useRef(0),mounted=useRef(true),timer=useRef<ReturnType<typeof setInterval>>(),startTime=useRef(0),waiting=useRef(false);
 function clearTimer(){if(timer.current)clearInterval(timer.current);timer.current=undefined;}
 function cancel(){generation.current++;preparation.current?.cancel();capture.current?.cancel();preparation.current=null;capture.current=null;clearTimer();wav.current=null;waiting.current=false;if(mounted.current){setState('idle');setError('');}}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;cancel();};},[]);
 useEffect(()=>{onBusy(state!=='idle');},[state,onBusy]);
 useEffect(()=>observeAudioFocus('microphone',()=>{if(capture.current)void stop(false,en?'Audio interrupted. Transcribe or cancel.':'Запись прервалась. Распознай её или отмени.');}),[en]);
 useEffect(()=>{const background=()=>{if(document.hidden&&capture.current)void stop(false,en?'Recording stopped when you left. Transcribe or cancel.':'Запись остановлена при сворачивании. Распознай её или отмени.');};document.addEventListener('visibilitychange',background);return()=>document.removeEventListener('visibilitychange',background);},[en]);
 async function send(){
  if(waiting.current||!wav.current)return;const token=generation.current;waiting.current=true;setState('sending');setError('');
  try{const result=await transcribeLunaVoice(wav.current,operation.current,language,initData);if(mounted.current&&generation.current===token){onTranscript(result.text);wav.current=null;setState('idle');}}
  catch(error){if(mounted.current&&generation.current===token){let code='';if(error instanceof ApiRequestError)try{code=JSON.parse(error.responseBody??'{}').code??'';}catch{/* Never expose the raw server response. */}setState('error');setError(['voice_empty','voice_clipped'].includes(code)?(en?'No clear voice was captured. Cancel and record again closer to the microphone.':'Не удалось записать разборчивую речь. Отмени и попробуй ещё раз ближе к микрофону.'):(en?'Could not confirm the transcript. Retry uses the same request; your audio stays here.':'Не удалось подтвердить текст. Повтор использует тот же запрос; запись остаётся здесь.'));}}
  finally{if(generation.current===token)waiting.current=false;}
 }
 async function stop(transcribe:boolean,note=''){
  const recording=capture.current;if(!recording)return;capture.current=null;clearTimer();const token=generation.current;setState('processing');setError(note);
  try{const blob=await recording.stop();if(mounted.current&&generation.current===token){wav.current=blob;waiting.current=false;if(transcribe)await send();else setState('ready');}}
  catch{recording.cancel();if(mounted.current&&generation.current===token){waiting.current=false;setState('error');setError(en?'This recording could not be prepared. Cancel and try again, or type.':'Не удалось подготовить запись. Отмени её и попробуй снова или напиши текст.');}}
 }
 async function start(){
  if(waiting.current||disabled)return;const token=++generation.current;waiting.current=true;setState('requesting');setError('');setElapsed(0);wav.current=null;
  try{
   if(!navigator.mediaDevices?.getUserMedia||typeof AudioContext==='undefined'||typeof AudioWorkletNode==='undefined')throw new Error('unsupported');
   requestAudioFocus('microphone');preparation.current=prepareVoiceCapture();const recording=await preparation.current.start();
   if(!mounted.current||generation.current!==token){recording.cancel();return;}
   capture.current=recording;operation.current=crypto.randomUUID();requestAudioFocus('microphone');startTime.current=performance.now();setState('recording');
   timer.current=setInterval(()=>{setElapsed(Math.floor((performance.now()-startTime.current)/1000));if(performance.now()-startTime.current>=44000)void stop(false);},200);
  }catch(error){if(generation.current!==token||!mounted.current)return;preparation.current?.cancel();setState('error');setError(error instanceof DOMException&&error.name==='NotAllowedError'?(en?'Microphone access was denied. Allow it in Telegram/browser settings, or type your message.':'Доступ к микрофону запрещён. Разреши его в настройках Telegram/браузера или напиши сообщение.'):(en?'Recording is unavailable on this device. You can type your message.':'Запись недоступна на этом устройстве. Можно написать сообщение.'));}
  finally{if(generation.current===token)waiting.current=false;}
 }
 const busy=['requesting','processing','sending'].includes(state),status=state==='recording'?(en?'Listening…':'Слушаю…'):state==='ready'?(en?'Ready to transcribe':'Готово к распознаванию'):state==='sending'?(en?'Turning speech into text…':'Перевожу речь в текст…'):state==='processing'?(en?'Preparing…':'Готовлю запись…'):state==='requesting'?(en?'Allow microphone access':'Разреши доступ к микрофону'):(en?'Voice input':'Голосовой ввод');
 return <div className={`voice42${state!=='idle'?' voice42-active':''}`}>{state==='idle'?<button type="button" className="voice42-mic" disabled={disabled} aria-label={en?'Record a voice message':'Записать голосовое сообщение'} title={en?'Dictate up to 45 seconds, then review the text':'Продиктуй до 45 секунд и проверь текст'} onClick={()=>void start()}><Mic size={20}/></button>:<section className="voice42-inline" aria-label={en?'Voice input':'Голосовой ввод'}>
  <div className="voice42-row">{state!=='sending'&&<button type="button" onClick={cancel} aria-label={en?'Cancel recording':'Отменить запись'}><X size={21}/></button>}<div className="voice42-status"><span role="status" aria-live="polite">{status}</span>{state==='recording'&&<div className="voice42-meter" aria-hidden="true">{[9,18,12,25,16,22,11,19,13].map((height,i)=><i key={i} style={{height,animationDelay:`${i*-.13}s`}}/>)}</div>}</div>{state==='recording'&&<time className="voice42-time">0:{String(elapsed).padStart(2,'0')}</time>}{state==='recording'?<button type="button" className="voice42-confirm" onClick={()=>void stop(true)} aria-label={en?'Stop & transcribe':'Остановить и распознать'}><Square size={18} fill="currentColor"/></button>:(state==='ready'||state==='error'&&wav.current)?<button type="button" className="voice42-confirm" disabled={waiting.current} onClick={()=>void send()} aria-label={state==='error'?(en?'Retry transcription':'Повторить распознавание'):(en?'Transcribe recording':'Распознать запись')}>{state==='error'?<RotateCcw size={20}/>:<Check size={22}/>}</button>:busy?<LoaderCircle className="voice42-spinner" size={22} aria-hidden="true"/>:null}</div>
  {error&&<p role="alert">{error}</p>}<small>{en?'Stop → private OpenAI transcription. Review the text before sending. Audio is not saved by Luna.':'Стоп → распознавание в OpenAI. Проверь текст перед отправкой. Luna не сохраняет аудио.'}</small>
 </section>}</div>;
}
