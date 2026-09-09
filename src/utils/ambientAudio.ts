// Ambient Audio Synthesizer using Web Audio API (Zero external assets, 100% offline & low latency)

export type AmbientSoundType = 'none' | 'brown-noise' | 'lofi' | 'rain' | 'cafe';

class AmbientSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentType: AmbientSoundType = 'none';
  private activeNodes: { stop?: () => void; intervalId?: number }[] = [];
  private volume: number = 0.5;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getCurrentType(): AmbientSoundType {
    return this.currentType;
  }

  public stop() {
    this.activeNodes.forEach((node) => {
      if (node.stop) {
        try {
          node.stop();
        } catch (e) {}
      }
      if (node.intervalId) {
        clearInterval(node.intervalId);
      }
    });
    this.activeNodes = [];
    this.currentType = 'none';
  }

  public play(type: AmbientSoundType) {
    this.initContext();
    this.stop();

    if (type === 'none' || !this.ctx || !this.masterGain) {
      return;
    }

    this.currentType = type;

    switch (type) {
      case 'brown-noise':
        this.startBrownNoise();
        break;
      case 'rain':
        this.startRain();
        break;
      case 'lofi':
        this.startLofiBeat();
        break;
      case 'cafe':
        this.startCafeAmbience();
        break;
    }
  }

  // Brown Noise Generator (Warm, deep focus rumble)
  private startBrownNoise() {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = this.ctx.sampleRate * 4;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; // boost level
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Filter to warm low frequencies
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.7, this.ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    whiteNoise.start();
    this.activeNodes.push({
      stop: () => {
        try {
          whiteNoise.stop();
          whiteNoise.disconnect();
        } catch (e) {}
      },
    });
  }

  // Rain Simulator (Layered soft pink noise + gentle droplet filter resonance)
  private startRain() {
    if (!this.ctx || !this.masterGain) return;

    // 1. Base rain shower noise
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      data[i] *= 0.11;
      b6 = white * 0.115926;
    }

    const rainSource = this.ctx.createBufferSource();
    rainSource.buffer = noiseBuffer;
    rainSource.loop = true;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1200, this.ctx.currentTime);
    bandpass.Q.setValueAtTime(0.8, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.65, this.ctx.currentTime);

    rainSource.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.masterGain);
    rainSource.start();

    // 2. Random droplet generator
    const dropletInterval = window.setInterval(() => {
      if (!this.ctx || !this.masterGain || this.currentType !== 'rain') return;
      try {
        const osc = this.ctx.createOscillator();
        const dropGain = this.ctx.createGain();
        osc.type = 'sine';
        const freq = 1800 + Math.random() * 1200;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.6, this.ctx.currentTime + 0.06);

        dropGain.gain.setValueAtTime(0.08 * Math.random(), this.ctx.currentTime);
        dropGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.06);

        osc.connect(dropGain);
        dropGain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.07);
      } catch (e) {}
    }, 180);

    this.activeNodes.push({
      stop: () => {
        try {
          rainSource.stop();
          rainSource.disconnect();
        } catch (e) {}
      },
      intervalId: dropletInterval,
    });
  }

  // Lo-Fi Beat Synthesizer (Mellow electric piano chords + gentle vinyl warmth)
  private startLofiBeat() {
    if (!this.ctx || !this.masterGain) return;

    // Chords in D major / B minor jazz voicing:
    // Chord 1: Dmaj7 (D3, F#3, A3, C#4)
    // Chord 2: Bm7 (B2, D3, F#3, A3)
    // Chord 3: Gmaj7 (G2, B2, D3, F#3)
    // Chord 4: A7sus4 (A2, D3, E3, G3)
    const chordVoicings = [
      [146.83, 185.0, 220.0, 277.18],
      [123.47, 146.83, 185.0, 220.0],
      [98.0, 123.47, 146.83, 185.0],
      [110.0, 146.83, 164.81, 196.0],
    ];

    let chordIdx = 0;

    const playChord = () => {
      if (!this.ctx || !this.masterGain || this.currentType !== 'lofi') return;
      const chord = chordVoicings[chordIdx % chordVoicings.length];
      chordIdx++;

      chord.forEach((freq, i) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const chordGain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(650, this.ctx.currentTime);

        const startTime = this.ctx.currentTime + i * 0.04;
        chordGain.gain.setValueAtTime(0.0001, startTime);
        chordGain.gain.linearRampToValueAtTime(0.08, startTime + 0.3);
        chordGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 3.6);

        osc.connect(filter);
        filter.connect(chordGain);
        chordGain.connect(this.masterGain);

        osc.start(startTime);
        osc.stop(startTime + 3.8);
      });
    };

    playChord();
    const lofiInterval = window.setInterval(playChord, 3800);

    this.activeNodes.push({
      intervalId: lofiInterval,
    });
  }

  // Café Ambience (Warm background chatter resonance & subtle cup touches)
  private startCafeAmbience() {
    if (!this.ctx || !this.masterGain) return;

    // Filtered modulated noise for room murmur
    const bufferSize = this.ctx.sampleRate * 3;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }

    const murmur = this.ctx.createBufferSource();
    murmur.buffer = noiseBuffer;
    murmur.loop = true;

    const band1 = this.ctx.createBiquadFilter();
    band1.type = 'bandpass';
    band1.frequency.setValueAtTime(450, this.ctx.currentTime);
    band1.Q.setValueAtTime(2.0, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);

    murmur.connect(band1);
    band1.connect(gain);
    gain.connect(this.masterGain);
    murmur.start();

    // Occasional ceramic / glass clink
    const cafeInterval = window.setInterval(() => {
      if (!this.ctx || !this.masterGain || this.currentType !== 'cafe') return;
      if (Math.random() > 0.45) return;

      try {
        const osc = this.ctx.createOscillator();
        const clinkGain = this.ctx.createGain();
        osc.type = 'sine';
        const f = 2400 + Math.random() * 800;
        osc.frequency.setValueAtTime(f, this.ctx.currentTime);

        clinkGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
        clinkGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.15);

        osc.connect(clinkGain);
        clinkGain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.16);
      } catch (e) {}
    }, 2400);

    this.activeNodes.push({
      stop: () => {
        try {
          murmur.stop();
          murmur.disconnect();
        } catch (e) {}
      },
      intervalId: cafeInterval,
    });
  }
}

export const ambientSound = new AmbientSoundEngine();
