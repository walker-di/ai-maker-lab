export interface AudioBus {
  playSfx(key: string, options?: { volume?: number }): void;
  playMusic(key: string, options?: { volume?: number; loop?: boolean }): void;
  stopMusic(): void;
  setMasterVolume(volume: number): void;
  setMuted?(muted: boolean): void;
  resume?(): Promise<void>;
  dispose(): void;
}

export class NullAudioBus implements AudioBus {
  playSfx(): void {}
  playMusic(): void {}
  stopMusic(): void {}
  setMasterVolume(): void {}
  setMuted(): void {}
  async resume(): Promise<void> {}
  dispose(): void {}
}

type BrowserAudioContext = AudioContext & {
  createBufferSource(): AudioBufferSourceNode;
};

export class WebAudioBus implements AudioBus {
  private context: BrowserAudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterVolume = 0.7;
  private muted = false;

  async resume(): Promise<void> {
    const context = this.ensureContext();
    if (context.state === 'suspended') await context.resume();
  }

  playSfx(key: string, options: { volume?: number } = {}): void {
    const volume = options.volume ?? 1;
    const context = this.ensureContext();
    const now = context.currentTime;
    switch (key) {
      case 'select':
        this.tone(520, 0.055, 'triangle', 0.18 * volume, now);
        break;
      case 'move':
        this.tone(360, 0.08, 'sine', 0.16 * volume, now);
        break;
      case 'attack':
        this.tone(150, 0.05, 'sawtooth', 0.16 * volume, now);
        this.noiseBurst(0.045, 0.07 * volume, now);
        break;
      case 'attack-move':
        this.tone(320, 0.06, 'square', 0.16 * volume, now);
        this.tone(360, 0.07, 'triangle', 0.1 * volume, now + 0.02);
        break;
      case 'build-place':
        this.chord([260, 390], 0.09, 'square', 0.11 * volume, now);
        break;
      case 'build-complete':
        this.chord([320, 480, 640], 0.16, 'triangle', 0.12 * volume, now);
        break;
      case 'unit-die':
        this.tone(95, 0.14, 'sawtooth', 0.2 * volume, now);
        this.noiseBurst(0.12, 0.12 * volume, now);
        break;
      case 'rocket-hit':
        this.tone(78, 0.18, 'square', 0.24 * volume, now);
        this.noiseBurst(0.18, 0.2 * volume, now);
        break;
      case 'wave-alarm':
        this.chord([180, 220], 0.22, 'sawtooth', 0.13 * volume, now);
        break;
      case 'victory':
        this.chord([392, 494, 659], 0.32, 'triangle', 0.15 * volume, now);
        break;
      case 'defeat':
        this.chord([196, 147, 110], 0.38, 'sawtooth', 0.12 * volume, now);
        break;
      default:
        this.tone(260, 0.05, 'sine', 0.08 * volume, now);
    }
  }

  playMusic(): void {}
  stopMusic(): void {}

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateGain();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.updateGain();
  }

  dispose(): void {
    void this.context?.close();
    this.context = null;
    this.masterGain = null;
  }

  private ensureContext(): BrowserAudioContext {
    if (this.context && this.masterGain) return this.context;
    const AudioContextCtor = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) throw new Error('WebAudio is not available in this browser');
    const context = new AudioContextCtor() as BrowserAudioContext;
    const masterGain = context.createGain();
    masterGain.connect(context.destination);
    this.context = context;
    this.masterGain = masterGain;
    this.updateGain();
    return context;
  }

  private updateGain(): void {
    if (!this.masterGain || !this.context) return;
    const value = this.muted ? 0 : this.masterVolume;
    this.masterGain.gain.setTargetAtTime(value, this.context.currentTime, 0.01);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, start: number): void {
    const context = this.ensureContext();
    const out = context.createGain();
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    out.gain.setValueAtTime(0.0001, start);
    out.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), start + 0.01);
    out.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(out);
    out.connect(this.masterGain!);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private chord(freqs: number[], dur: number, type: OscillatorType, gain: number, start: number): void {
    for (let i = 0; i < freqs.length; i++) {
      this.tone(freqs[i]!, dur, type, gain / freqs.length, start + i * 0.035);
    }
  }

  private noiseBurst(dur: number, gain: number, start: number): void {
    const context = this.ensureContext();
    const buffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * dur)), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    const out = context.createGain();
    out.gain.setValueAtTime(gain, start);
    out.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    source.buffer = buffer;
    source.connect(out);
    out.connect(this.masterGain!);
    source.start(start);
    source.stop(start + dur);
  }
}
