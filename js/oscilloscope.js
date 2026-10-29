class Oscilloscope {
  static Style = Object.freeze({
    BLUE: 'blue',
    THREE_BAND: '3-band',
    RGB: 'rgb',
  });

  #canvas;
  #ctx;
  #audio;
  #barCount = 3000;
  #style = Oscilloscope.Style.THREE_BAND;

  constructor(canvasId, audio, fps = 60) {
    this.#canvas = document.getElementById(canvasId);
    this.#ctx = this.#canvas.getContext('2d');
    this.#audio = audio;

    this.#resize();
    window.addEventListener('resize', () => this.#resize());
    setInterval(() => this.#draw(), 1000 / fps);
  }

  get style() {
    return this.#style;
  }

  set style(value) {
    if (!Object.values(Oscilloscope.Style).includes(value)) return;
    this.#style = value;
  }

  #resize() {
    this.#canvas.width = window.innerWidth * devicePixelRatio;
    this.#canvas.height = window.innerHeight * devicePixelRatio;
  }

  #draw() {
    const w = this.#canvas.width;
    const h = this.#canvas.height;
    const centerY = h / 2;
    const halfH = centerY;
    const ctx = this.#ctx;

    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, w, h);

    if (!this.#audio.isListening()) return;

    const samplesPerPx = AudioStream.MAX_SAMPLES / w;
    const barW = 1;

    const { Band } = AudioStream;

    for (let px = 0; px < w; px += barW) {
      const t = px * samplesPerPx;

      const getEnergyR = (b) => this.#audio.getEnergyR(t, b);
      const getEnergyL = (b) => this.#audio.getEnergyL(t, b);

      for (const { band, color, scale } of Oscilloscope.#BANDS) {
        const is3Band = this.#style === Oscilloscope.Style.THREE_BAND;
        if (is3Band === (band === AudioStream.Band.ALL)) continue;

        const energyR = getEnergyR(band);
        const energyL = getEnergyL(band);
        let colorR, colorL;
        switch (this.#style) {
          case Oscilloscope.Style.THREE_BAND:
            colorR = color;
            colorL = color;
            break;
          case Oscilloscope.Style.RGB:
            colorR = Oscilloscope.#rgbColor(getEnergyR(Band.LOW), getEnergyR(Band.MID), getEnergyR(Band.HIGH));
            colorL = Oscilloscope.#rgbColor(getEnergyL(Band.LOW), getEnergyL(Band.MID), getEnergyL(Band.HIGH));
            break;
          case Oscilloscope.Style.BLUE:
          default:
            colorR = Oscilloscope.#blueColor(energyR);
            colorL = Oscilloscope.#blueColor(energyL);
        }
        this.#drawBar(px, barW, centerY, halfH, energyR * scale, -1, colorR);
        this.#drawBar(px, barW, centerY, halfH, energyL * scale, 1, colorL);
      }
    }
  }

  static #BANDS = [
    { band: AudioStream.Band.ALL,  color: null, scale: 2.5 },
    { band: AudioStream.Band.LOW,  color: "rgb(20, 113, 240)", scale: 1.0 },
    { band: AudioStream.Band.MID,  color: "rgb(219, 127, 26)", scale: 0.6 },
    { band: AudioStream.Band.HIGH, color: "rgb(254, 249, 235)", scale: 0.6 },
  ];


  static #blueColor(energy) {
    const intensity = 0.4 + energy * 0.6;
    return `rgb(${Math.round(10 * intensity)},${Math.round(120 + 100 * energy)},${Math.round(200 + 55 * intensity)})`;
  }

  static #rgbColor(low, mid, high) {
    return `rgb(${Math.round(low * 255)},${Math.round(mid * 255)},${Math.round(high * 255)})`;
  }

  #drawBar(px, barW, centerY, halfH, energy, direction, color) {
    const barH = Math.min(energy * halfH, halfH);
    if (barH < 0.5) return;

    this.#ctx.fillStyle = color;
    const y = direction < 0 ? centerY - barH : centerY - 1;
    this.#ctx.fillRect(px, y, barW, barH + 1);
  }
}
