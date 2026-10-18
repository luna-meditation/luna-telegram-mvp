import {pcm16Wav} from './voiceWav';

export type VoiceCapture = {stop:()=>Promise<Blob>;cancel:()=>void};
/** Capture decoded microphone PCM rather than re-decoding a Safari MP4/WebM
 * container. Resume is called on the user's tap, before the permission promise. */
export function prepareVoiceCapture(){
 const context=new AudioContext({latencyHint:'interactive'});
 const resumed=context.resume();
 let cancelled=false,stream:MediaStream|null=null,node:AudioWorkletNode|null=null,source:MediaStreamAudioSourceNode|null=null,mute:GainNode|null=null;
 const chunks:Float32Array[]=[];let sampleCount=0,ended=false,finish:(()=>void)|undefined;
 const cleanup=()=>{stream?.getTracks().forEach(track=>track.stop());stream=null;source?.disconnect();node?.disconnect();mute?.disconnect();if(context.state!=='closed')void context.close().catch(()=>undefined);};
 const cancel=()=>{cancelled=true;ended=true;chunks.length=0;finish?.();cleanup();};
 const start=async():Promise<VoiceCapture>=>{
  try{
   await resumed;
   stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1}});
   if(cancelled)throw new Error('recording_cancelled');
   await context.audioWorklet.addModule('/audio/luna-pcm-capture.js');
   if(cancelled)throw new Error('recording_cancelled');
   source=context.createMediaStreamSource(stream);node=new AudioWorkletNode(context,'luna-pcm-capture',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});mute=context.createGain();mute.gain.value=0;
   node.port.onmessage=event=>{if(cancelled)return;if(event.data?.samples instanceof Float32Array){const remaining=Math.max(0,Math.floor(context.sampleRate*45)-sampleCount),samples=event.data.samples.subarray(0,remaining);if(samples.length){chunks.push(samples);sampleCount+=samples.length;}}if(event.data?.done){ended=true;finish?.();}};
   source.connect(node);node.connect(mute);mute.connect(context.destination);
   return{cancel,stop:async()=>{
    if(cancelled||ended)throw new Error('recording_cancelled');
    // Flush the final partial worklet frame before closing the microphone.
    await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>{finish=undefined;reject(new Error('recording_flush_timeout'));},1500);finish=()=>{clearTimeout(timeout);resolve();};node!.port.postMessage('stop');});
    const rate=context.sampleRate;cleanup();
    if(cancelled||sampleCount/rate<.25)throw new Error('recording_too_short');
    const pcm=new Float32Array(sampleCount);let offset=0;for(const chunk of chunks){pcm.set(chunk,offset);offset+=chunk.length;}chunks.length=0;
    // WebKit may ignore a requested sample rate. Resample actual PCM once.
    if(rate===16000)return pcm16Wav(pcm);
    const render=new OfflineAudioContext(1,Math.floor(sampleCount*16000/rate),16000),buffer=render.createBuffer(1,sampleCount,rate);buffer.copyToChannel(pcm,0);const resampler=render.createBufferSource();resampler.buffer=buffer;resampler.connect(render.destination);resampler.start();const output=await render.startRendering();return pcm16Wav(output.getChannelData(0));
   }};
  }catch(error){cleanup();throw error;}
 };
 return{start,cancel};
}
