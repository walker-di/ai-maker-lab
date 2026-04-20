import type { AssetBundle } from './assets.js';
import type { AudioBus, PlayMusicOptions } from './audio-bus.js';

type MediaInstance = {
  volume: number;
  stop(): void;
};

type SoundLibrary = {
  init(): unknown;
  exists(alias: string, assert?: boolean): boolean;
  add(alias: string, options: Record<string, unknown>): unknown;
  play(alias: string, options?: Record<string, unknown>): MediaInstance | Promise<MediaInstance>;
  stop(alias: string): unknown;
};

async function loadSoundLibrary(): Promise<SoundLibrary> {
  const mod = (await import('@pixi/sound')) as unknown as { sound: SoundLibrary };
  mod.sound.init();
  return mod.sound;
}

/**
 * Audio bus backed by `@pixi/sound`. Intended for the browser runtime route;
 * tests should keep using {@link NullAudioBus}.
 *
 * Uses CC0-safe placeholder audio (`silence.wav`) whenever the bundle does not
 * supply explicit URLs so the graph always resolves.
 */
export class PixiAudioBus implements AudioBus {
  private lib: SoundLibrary | null = null;
  private ready: Promise<SoundLibrary> | null = null;
  private currentMusicId: string | null = null;
  private currentMusicInstance: MediaInstance | null = null;
  private muted = false;
  private fadeRaf = 0;

  constructor(
    private readonly bundle: AssetBundle,
    private readonly basePath = '/platformer/assets',
  ) {}

  private placeholderUrl(): string {
    return `${this.basePath}/silence.wav`;
  }

  private async ensureLib(): Promise<SoundLibrary> {
    if (this.lib) return this.lib;
    if (!this.ready) {
      this.ready = loadSoundLibrary();
    }
    this.lib = await this.ready;
    return this.lib;
  }

  private cancelFade(): void {
    if (this.fadeRaf) {
      cancelAnimationFrame(this.fadeRaf);
      this.fadeRaf = 0;
    }
  }

  private musicAlias(trackId: string): string {
    return `platformer:music:${trackId}`;
  }

  private sfxAlias(sfxId: string): string {
    return `platformer:sfx:${sfxId}`;
  }

  private async ensureMusic(trackId: string, snd: SoundLibrary): Promise<void> {
    const alias = this.musicAlias(trackId);
    if (snd.exists(alias, false)) return;
    const track = this.bundle.audio.music[trackId];
    const url = track?.url ?? this.placeholderUrl();
    snd.add(alias, {
      url,
      preload: true,
      loop: true,
      singleInstance: true,
      volume: 0.45,
    });
  }

  private async ensureSfx(sfxId: string, snd: SoundLibrary): Promise<void> {
    const alias = this.sfxAlias(sfxId);
    if (snd.exists(alias, false)) return;
    const sfx = this.bundle.audio.sfx[sfxId];
    const url = sfx?.url ?? this.placeholderUrl();
    snd.add(alias, {
      url,
      preload: true,
      loop: false,
      singleInstance: false,
      volume: 0.75,
    });
  }

  private async resolvePlay(
    result: MediaInstance | Promise<MediaInstance>,
  ): Promise<MediaInstance> {
    return await Promise.resolve(result);
  }

  playMusic(trackId: string, options?: PlayMusicOptions): void {
    void this.runPlayMusic(trackId, options);
  }

  private async runPlayMusic(trackId: string, options?: PlayMusicOptions): Promise<void> {
    if (this.currentMusicId === trackId) return;
    const snd = await this.ensureLib();
    await this.ensureMusic(trackId, snd);
    const alias = this.musicAlias(trackId);
    const crossfadeMs = options?.crossfadeMs ?? 450;
    const prev = this.currentMusicInstance;
    const targetVol = this.muted ? 0 : 0.45;
    const nextRaw = snd.play(alias, { loop: true, volume: prev && crossfadeMs > 0 ? 0 : targetVol });
    const next = await this.resolvePlay(nextRaw);
    this.currentMusicId = trackId;
    this.currentMusicInstance = next;
    this.cancelFade();
    if (prev && crossfadeMs > 0) {
      const startPrev = prev.volume;
      const startNext = next.volume;
      const t0 = performance.now();
      const step = () => {
        const t = Math.min(1, (performance.now() - t0) / crossfadeMs);
        prev.volume = startPrev * (1 - t);
        next.volume = startNext + (targetVol - startNext) * t;
        if (t < 1) {
          this.fadeRaf = requestAnimationFrame(step);
        } else {
          this.fadeRaf = 0;
          try {
            prev.stop();
          } catch {
            /* ignore */
          }
        }
      };
      this.fadeRaf = requestAnimationFrame(step);
    } else {
      try {
        prev?.stop();
      } catch {
        /* ignore */
      }
      next.volume = targetVol;
    }
  }

  stopMusic(): void {
    this.cancelFade();
    this.currentMusicInstance?.stop();
    this.currentMusicInstance = null;
    this.currentMusicId = null;
  }

  playSfx(sfxId: string): void {
    void this.runPlaySfx(sfxId);
  }

  private async runPlaySfx(sfxId: string): Promise<void> {
    if (this.muted) return;
    try {
      const snd = await this.ensureLib();
      await this.ensureSfx(sfxId, snd);
      const alias = this.sfxAlias(sfxId);
      const inst = await this.resolvePlay(snd.play(alias, { loop: false, volume: 0.75 }));
      inst.volume = 0.75;
    } catch {
      /* missing asset or autoplay policy */
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.currentMusicInstance) {
      this.currentMusicInstance.volume = muted ? 0 : 0.45;
    }
  }

  dispose(): void {
    this.cancelFade();
    this.stopMusic();
    this.lib = null;
    this.ready = null;
  }
}
