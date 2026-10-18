/** Browser-side normalization; the server independently validates these bytes. */
export function pcm16Wav(samples:Float32Array,rate=16000){
 const output=new ArrayBuffer(44+samples.length*2),v=new DataView(output),word=(offset:number,s:string)=>{for(let i=0;i<s.length;i++)v.setUint8(offset+i,s.charCodeAt(i));};
 word(0,'RIFF');v.setUint32(4,output.byteLength-8,true);word(8,'WAVE');word(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);word(36,'data');v.setUint32(40,samples.length*2,true);
 for(let i=0;i<samples.length;i++){const n=Math.max(-1,Math.min(1,samples[i]));v.setInt16(44+i*2,n<0?n*32768:n*32767,true);}return new Blob([output],{type:'audio/wav'});
}
export async function normalizeVoiceAudio(blob:Blob){
 const context=new OfflineAudioContext(1,16000*45,16000),decoded=await context.decodeAudioData(await blob.arrayBuffer());if(decoded.duration<.25||decoded.duration>46)throw new Error('recording_duration');const length=Math.min(16000*45,Math.floor(decoded.duration*16000));
 const render=new OfflineAudioContext(1,length,16000),source=render.createBufferSource();source.buffer=decoded;source.connect(render.destination);source.start();const pcm=await render.startRendering();return pcm16Wav(pcm.getChannelData(0));
}
