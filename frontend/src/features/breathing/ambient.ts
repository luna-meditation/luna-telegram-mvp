export type SceneSound='water'|'ocean'|'mist'|'forest'|'rain';
const sceneAudioCache=new Map<string,string>();
// Original procedural WAV generator reused from Luna Home, not third-party recorded audio.
export function createSceneAudioUrl(kind: SceneSound) {
  const cached = sceneAudioCache.get(kind);
  if (cached) return cached;

  const sampleRate = 22050;
  const seconds = 5;
  const totalSamples = sampleRate * seconds;
  const samples = new Float32Array(totalSamples);
  const base = kind === 'ocean' ? 0.18 : kind === 'rain' ? 0.12 : kind === 'forest' ? 0.1 : kind === 'mist' ? 0.08 : 0.11;

  for (let index = 0; index < totalSamples; index += 1) {
    const t = index / sampleRate;
    const cycle = t / seconds;
    const fade = Math.min(1, index / 1400, (totalSamples - index) / 1400);
    const wave = Math.sin(Math.PI * 2 * cycle);
    const noise = (Math.random() * 2 - 1) * base;
    const low = Math.sin(Math.PI * 2 * (kind === 'mist' ? 110 : 72) * t) * 0.025;
    const pulse = kind === 'ocean'
      ? Math.sin(Math.PI * 2 * 0.32 * t) * 0.12
      : kind === 'water'
        ? Math.sin(Math.PI * 2 * 0.21 * t) * 0.08
        : kind === 'rain'
          ? Math.random() * 0.12
          : kind === 'forest'
            ? Math.sin(Math.PI * 2 * 0.17 * t) * 0.05
            : Math.sin(Math.PI * 2 * 0.12 * t) * 0.035;
    samples[index] = Math.max(-0.8, Math.min(0.8, (noise * (0.55 + Math.abs(wave) * 0.45) + low + pulse) * fade));
  }

  const dataSize = totalSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  samples.forEach((sample) => {
    view.setInt16(offset, sample * 32767, true);
    offset += 2;
  });

  const url = URL.createObjectURL(new Blob([view], { type: 'audio/wav' }));
  sceneAudioCache.set(kind, url);
  return url;
}
