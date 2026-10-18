import {z} from 'zod';
export const voiceMetadata=z.object({requestId:z.string().uuid(),language:z.enum(['en','ru'])}).strict();
export const transcriptionModel='gpt-4o-mini-transcribe';
export const voiceMaxSeconds=45;
/** Only our canonical mono PCM16 WAV is accepted. The server derives duration
 * from validated sample count, not an editable browser duration or container tag. */
export function validateVoiceWav(wav:Buffer){
 if(wav.length<44+8000||wav.length>44+16000*2*voiceMaxSeconds||wav.toString('ascii',0,4)!=='RIFF'||wav.readUInt32LE(4)!==wav.length-8||wav.toString('ascii',8,12)!=='WAVE'||wav.toString('ascii',12,16)!=='fmt '||wav.readUInt32LE(16)!==16||wav.readUInt16LE(20)!==1||wav.readUInt16LE(22)!==1||wav.readUInt32LE(24)!==16000||wav.readUInt32LE(28)!==32000||wav.readUInt16LE(32)!==2||wav.readUInt16LE(34)!==16||wav.toString('ascii',36,40)!=='data'||wav.readUInt32LE(40)!==wav.length-44||(wav.length-44)%2)throw new Error('invalid_voice_audio');
 // Cheap signal-quality gate, not speech recognition: reject silence, DC and
 // isolated clicks before reserving money. Never infer text from audio energy.
 const frameSamples=320,totalSamples=(wav.length-44)/2;let activeSamples=0,peak=0,clipped=0;
 for(let start=0;start<totalSamples;start+=frameSamples){const count=Math.min(frameSamples,totalSamples-start);let sum=0,squares=0;
  for(let n=0;n<count;n++){const sample=wav.readInt16LE(44+(start+n)*2);sum+=sample;squares+=sample*sample;peak=Math.max(peak,Math.abs(sample));if(Math.abs(sample)>=32700)clipped++;}
  const variance=Math.max(0,squares/count-(sum/count)**2);if(Math.sqrt(variance)>=64)activeSamples+=count;
 }
 if(peak<128||activeSamples<1920)throw new Error('voice_empty');
 if(clipped/totalSamples>.35)throw new Error('voice_clipped');
 return{durationMs:Math.round(totalSamples/16),bytes:wav.length};
}
/** Official standard token pricing checked 2026-10-17. Estimate, not invoice. */
export function transcriptionUsage(payload:unknown){
 const p=payload as {text?:unknown;usage?:{type?:unknown;input_tokens?:unknown;output_tokens?:unknown}},u=p?.usage;
 if(u?.type!=='tokens'||!Number.isSafeInteger(u.input_tokens)||Number(u.input_tokens)<0||!Number.isSafeInteger(u.output_tokens)||Number(u.output_tokens)<0)return null;
 return{inputTokens:Number(u.input_tokens),outputTokens:Number(u.output_tokens),costMicrousd:Math.ceil(Number(u.input_tokens)*1.25+Number(u.output_tokens)*5)};
}
