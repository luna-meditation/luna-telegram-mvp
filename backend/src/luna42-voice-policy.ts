import {z} from 'zod';
export const voiceMetadata=z.object({requestId:z.string().uuid(),language:z.enum(['en','ru'])}).strict();
export const transcriptionModel='gpt-4o-mini-transcribe';
export const voiceMaxSeconds=45;
/** Only our canonical mono PCM16 WAV is accepted. The server derives duration
 * from validated sample count, not an editable browser duration or container tag. */
export function validateVoiceWav(wav:Buffer){
 if(wav.length<44+8000||wav.length>44+16000*2*voiceMaxSeconds||wav.toString('ascii',0,4)!=='RIFF'||wav.readUInt32LE(4)!==wav.length-8||wav.toString('ascii',8,12)!=='WAVE'||wav.toString('ascii',12,16)!=='fmt '||wav.readUInt32LE(16)!==16||wav.readUInt16LE(20)!==1||wav.readUInt16LE(22)!==1||wav.readUInt32LE(24)!==16000||wav.readUInt32LE(28)!==32000||wav.readUInt16LE(32)!==2||wav.readUInt16LE(34)!==16||wav.toString('ascii',36,40)!=='data'||wav.readUInt32LE(40)!==wav.length-44||(wav.length-44)%2)throw new Error('invalid_voice_audio');
 let peak=0;for(let i=44;i<wav.length;i+=2)peak=Math.max(peak,Math.abs(wav.readInt16LE(i)));if(peak<32)throw new Error('voice_empty');
 return{durationMs:Math.round((wav.length-44)/32),bytes:wav.length};
}
/** Official standard token pricing checked 2026-10-17. Estimate, not invoice. */
export function transcriptionUsage(payload:unknown){
 const p=payload as {text?:unknown;usage?:{type?:unknown;input_tokens?:unknown;output_tokens?:unknown}},u=p?.usage;
 if(u?.type!=='tokens'||!Number.isSafeInteger(u.input_tokens)||Number(u.input_tokens)<0||!Number.isSafeInteger(u.output_tokens)||Number(u.output_tokens)<0)return null;
 return{inputTokens:Number(u.input_tokens),outputTokens:Number(u.output_tokens),costMicrousd:Math.ceil(Number(u.input_tokens)*1.25+Number(u.output_tokens)*5)};
}
