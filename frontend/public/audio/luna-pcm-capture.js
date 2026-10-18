/* Mono PCM capture. No encoding, network, storage, or provider API in this worklet. */
class LunaPcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pending = new Float32Array(4096);
    this.used = 0;
    this.ended = false;
    this.port.onmessage = event => {
      if (event.data !== 'stop' || this.ended) return;
      this.flush();
      this.ended = true;
      this.port.postMessage({ done: true });
    };
  }
  flush() {
    if (!this.used) return;
    const samples = this.pending.slice(0, this.used);
    this.port.postMessage({ samples }, [samples.buffer]);
    this.used = 0;
  }
  process(inputs) {
    if (this.ended) return false;
    const channels = inputs[0];
    if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      let value = 0;
      for (const channel of channels) value += channel[i] ?? 0;
      this.pending[this.used++] = value / channels.length;
      if (this.used === this.pending.length) this.flush();
    }
    return true;
  }
}
registerProcessor('luna-pcm-capture', LunaPcmCapture);
