class BpmCounter {
  static TAP_TIMEOUT = 2000;
  static NOT_FOUND_TIMEOUT = 500;

  #taps = [];
  #notFoundTimer = null;
  #detector;
  #bpmEl;
  #infoEl;
  #autoEl;

  constructor(audio) {
    this.#bpmEl = document.getElementById('bpm');
    this.#infoEl = document.getElementById('info');
    this.#autoEl = document.getElementById('auto');

    this.#detector = new BeatDetector(audio);
    this.#detector.onBeat = (bpm) => { this.#auto_bpm(bpm); };

    document.getElementById('tap').addEventListener('click', () => this.#onTap());
    document.getElementById('reset').addEventListener('click', () => this.#onReset());
    document.getElementById('auto').addEventListener('click', () => this.#onAutoToggle());
    document.getElementById('scope-style').addEventListener('change', (e) => {
      scope.style = e.target.value;
    });

    audio.start();
  }

  #auto_bpm(bpm) {
      if (bpm !== null) {
        this.#display(bpm, 'auto-detected');
        this.#resetNotFoundTimer();
      }
  }

  #display(bpm, info) {
    this.#bpmEl.textContent = bpm;
    this.#infoEl.textContent = info;
  }

  #resetNotFoundTimer() {
    if (this.#notFoundTimer) clearTimeout(this.#notFoundTimer);
    this.#notFoundTimer = setTimeout(() => {
      this.#display('TAP', 'Tap the button to the beat');
    }, BpmCounter.NOT_FOUND_TIMEOUT);
  }

  #onTap() {
    const now = performance.now();

    if (this.#taps.length && now - this.#taps[this.#taps.length - 1] > BpmCounter.TAP_TIMEOUT) {
      this.#taps.length = 0;
    }

    this.#taps.push(now);

    if (this.#taps.length < 2) {
      this.#display('TAP', 'Keep tapping...');
      return;
    }

    const intervals = [];
    for (let i = 1; i < this.#taps.length; i++) {
      intervals.push(this.#taps[i] - this.#taps[i - 1]);
    }
    const avgMs = intervals.reduce((a, b) => a + b) / intervals.length;
    const bpm = Math.round(60000 / avgMs);

    this.#display(bpm, `${this.#taps.length} taps`);
    this.#resetNotFoundTimer();
  }

  #onReset() {
    this.#taps.length = 0;
    this.#detector.reset();
    this.#display('TAP', 'Tap the button to the beat');
    if (this.#notFoundTimer) clearTimeout(this.#notFoundTimer);
  }

  #onAutoToggle() {
    if (this.#detector.onBeat) {
      this.#detector.onBeat = null;
      this.#autoEl.textContent = 'Stop auto BPM';
      this.#autoEl.classList.remove('active');
    } else {
      this.#detector.onBeat = (bpm) => this.#auto_bpm(bpm);
      this.#autoEl.textContent = 'Start auto BPM';
      this.#autoEl.classList.add('active');
    }
  }
}
