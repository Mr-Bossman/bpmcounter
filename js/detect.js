class BeatDetector {
  static MIN_BPM = 60;
  static MAX_BPM = 200;
  static MIN_INTERVAL = 60000 / BeatDetector.MAX_BPM;
  static MAX_INTERVAL = 60000 / BeatDetector.MIN_BPM;
  static HISTORY_SIZE = 16;
  static FLUX_HISTORY = 43;
  static THRESHOLD_MULT = 1.5;
  static MIN_ENERGY = 0.005;

  #audio;
  #beats = [];
  #fluxHistory = [];
  #bpm = null;
  #onBeat = null;
  #prevEnergy = 0;
  #armed = true;

  constructor(audio) {
    this.#audio = audio;
    this.#audio.onSample = () => this.#process();
  }

  get bpm() {
    return this.#bpm;
  }

  set onBeat(fn) {
    this.#onBeat = fn;
  }

  get onBeat() {
    return this.#onBeat;
  }

  #process() {
    const t = AudioStream.MAX_SAMPLES - 1;
    const energy = Math.max(
      this.#audio.getEnergyL(t, AudioStream.Band.LOW),
      this.#audio.getEnergyR(t, AudioStream.Band.LOW),
    );

    const flux = Math.max(0, energy - this.#prevEnergy);
    this.#prevEnergy = energy;

    this.#fluxHistory.push(flux);
    if (this.#fluxHistory.length > BeatDetector.FLUX_HISTORY) {
      this.#fluxHistory.shift();
    }

    if (this.#fluxHistory.length < BeatDetector.FLUX_HISTORY) return;

    const avg = this.#fluxHistory.reduce((a, b) => a + b) / this.#fluxHistory.length;
    const threshold = avg * BeatDetector.THRESHOLD_MULT + BeatDetector.MIN_ENERGY;

    if (flux <= threshold) {
      this.#armed = true;
      return;
    }

    if (!this.#armed) return;

    const now = performance.now();
    const last = this.#beats.length ? this.#beats[this.#beats.length - 1] : 0;
    if (now - last < BeatDetector.MIN_INTERVAL) return;

    this.#armed = false;
    this.#beats.push(now);
    if (this.#beats.length > BeatDetector.HISTORY_SIZE) {
      this.#beats.shift();
    }

    this.#calcBpm();
    if (this.#onBeat) this.#onBeat(this.#bpm);
  }

  #calcBpm() {
    if (this.#beats.length < 4) {
      this.#bpm = null;
      return;
    }

    const intervals = [];
    for (let i = 1; i < this.#beats.length; i++) {
      const interval = this.#beats[i] - this.#beats[i - 1];
      if (interval >= BeatDetector.MIN_INTERVAL && interval <= BeatDetector.MAX_INTERVAL) {
        intervals.push(interval);
      }
    }

    if (intervals.length < 3) {
      this.#bpm = null;
      return;
    }

    intervals.sort((a, b) => a - b);
    const mid = Math.floor(intervals.length / 2);
    const median = intervals.length % 2
      ? intervals[mid]
      : (intervals[mid - 1] + intervals[mid]) / 2;

    const adjusted = intervals.map(iv => iv < median * 0.75 ? iv * 2 : iv);
    adjusted.sort((a, b) => a - b);
    const adjMid = Math.floor(adjusted.length / 2);
    const adjMedian = adjusted.length % 2
      ? adjusted[adjMid]
      : (adjusted[adjMid - 1] + adjusted[adjMid]) / 2;

    this.#bpm = Math.round(60000 / adjMedian);
  }

  reset() {
    this.#beats.length = 0;
    this.#fluxHistory.length = 0;
    this.#bpm = null;
    this.#prevEnergy = 0;
    this.#armed = true;
  }
}
