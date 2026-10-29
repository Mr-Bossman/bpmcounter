class AudioStream {
  static Band = Object.freeze({
    ALL: 'all',
    LOW: 'low',
    MID: 'mid',
    HIGH: 'high',
  });

  static DURATION = 5;
  static READS_PER_SEC = 250;
  static FFT_SIZE = 1024;
  static MAX_SAMPLES = AudioStream.DURATION * AudioStream.READS_PER_SEC;

  static LOW_MAX = 250;
  static MID_MAX = 4000;

  #bandBuffers = {
    [AudioStream.Band.ALL]:  { l: new Float32Array(AudioStream.MAX_SAMPLES), r: new Float32Array(AudioStream.MAX_SAMPLES) },
    [AudioStream.Band.LOW]:  { l: new Float32Array(AudioStream.MAX_SAMPLES), r: new Float32Array(AudioStream.MAX_SAMPLES) },
    [AudioStream.Band.MID]:  { l: new Float32Array(AudioStream.MAX_SAMPLES), r: new Float32Array(AudioStream.MAX_SAMPLES) },
    [AudioStream.Band.HIGH]: { l: new Float32Array(AudioStream.MAX_SAMPLES), r: new Float32Array(AudioStream.MAX_SAMPLES) },
  };
  #writePos = 0;
  #audioContext = null;
  #analyserL = null;
  #analyserR = null;
  #source = null;
  #listening = false;
  #onSample = null;

  constructor() {
    setInterval(() => this.#sample(), 1000 / AudioStream.READS_PER_SEC);
  }

  set onSample(fn) {
    this.#onSample = fn;
  }

  isListening() {
    return this.#listening;
  }

  async start() {
    if (this.#listening) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 2 }
    });

    this.#clearBuffers();

    this.#audioContext = new AudioContext();
    const splitter = this.#audioContext.createChannelSplitter(2);

    this.#analyserL = this.#audioContext.createAnalyser();
    this.#analyserL.fftSize = AudioStream.FFT_SIZE;
    this.#analyserL.smoothingTimeConstant = 0.3;
    this.#analyserR = this.#audioContext.createAnalyser();
    this.#analyserR.fftSize = AudioStream.FFT_SIZE;
    this.#analyserR.smoothingTimeConstant = 0.3;

    this.#source = this.#audioContext.createMediaStreamSource(stream);
    this.#source.connect(splitter);
    splitter.connect(this.#analyserL, 0);
    splitter.connect(this.#analyserR, 1);

    this.#listening = true;
  }

  stop() {
    if (!this.#listening) return;

    this.#source.mediaStream.getTracks().forEach(t => t.stop());
    this.#source.disconnect();
    this.#audioContext.close();
    this.#audioContext = null;
    this.#analyserL = null;
    this.#analyserR = null;
    this.#source = null;
    this.#listening = false;
    this.#clearBuffers();
  }

  #sample() {
    if (!this.#analyserL || !this.#analyserR || !this.#listening) return;

    const len = this.#analyserL.frequencyBinCount;

    const freqL = new Uint8Array(len);
    const freqR = new Uint8Array(len);
    this.#analyserL.getByteFrequencyData(freqL);
    this.#analyserR.getByteFrequencyData(freqR);

    const sampleRate = this.#audioContext.sampleRate;
    const binHz = sampleRate / AudioStream.FFT_SIZE;
    const lowBin = Math.floor(AudioStream.LOW_MAX / binHz);
    const midBin = Math.floor(AudioStream.MID_MAX / binHz);

    const bandEnergyL = this.#bandEnergy(freqL, lowBin, midBin, len);
    const bandEnergyR = this.#bandEnergy(freqR, lowBin, midBin, len);

    for (const band of Object.values(AudioStream.Band)) {
      this.#bandBuffers[band].l[this.#writePos] = bandEnergyL[band];
      this.#bandBuffers[band].r[this.#writePos] = bandEnergyR[band];
    }
    this.#writePos = (this.#writePos + 1) % AudioStream.MAX_SAMPLES;
    if (this.#onSample) this.#onSample();
  }

  #bandEnergy(freqData, lowBin, midBin, len) {
    let all = 0, low = 0, mid = 0, high = 0;
    let allCount = 0, lowCount = 0, midCount = 0, highCount = 0;
    for (let i = 0; i < len; i++) {
      const v = freqData[i] / 255;
      all += v; allCount++;
      if (i <= lowBin) { low += v; lowCount++; }
      else if (i <= midBin) { mid += v; midCount++; }
      else { high += v; highCount++; }
    }
    return {
      [AudioStream.Band.ALL]:  allCount  ? all  / allCount  : 0,
      [AudioStream.Band.LOW]:  lowCount  ? low  / lowCount  : 0,
      [AudioStream.Band.MID]:  midCount  ? mid  / midCount  : 0,
      [AudioStream.Band.HIGH]: highCount ? high / highCount : 0,
    };
  }

  #clearBuffers() {
    for (const band of Object.values(AudioStream.Band)) {
      this.#bandBuffers[band].l.fill(0);
      this.#bandBuffers[band].r.fill(0);
    }
    this.#writePos = 0;
  }

  getEnergyL(t, band = AudioStream.Band.ALL) {
    return this.#getEnergy(this.#bandBuffers[band].l, t);
  }

  getEnergyR(t, band = AudioStream.Band.ALL) {
    return this.#getEnergy(this.#bandBuffers[band].r, t);
  }

  #getEnergy(buffer, t) {
    const i = Math.floor(t);
    const f = t - i;
    const a = buffer[(this.#writePos + i) % AudioStream.MAX_SAMPLES];
    const b = buffer[(this.#writePos + i + 1) % AudioStream.MAX_SAMPLES];
    return a + (b - a) * f;
  }
}
