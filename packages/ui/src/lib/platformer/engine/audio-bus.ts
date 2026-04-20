import type { AssetBundle } from './assets.js';

export type PlayMusicOptions = {
  /** When set, crossfade from the current music instance over this duration. */
  crossfadeMs?: number;
};

/**
 * Lightweight audio bus. Keeps track of the active music track and dispatches
 * sfx by id. The Pixi adapter will swap this for a `@pixi/sound`-backed
 * implementation; the default no-op implementation is used in tests and
 * during SSR.
 */
export interface AudioBus {
  playMusic(trackId: string, options?: PlayMusicOptions): void;
  stopMusic(): void;
  playSfx(sfxId: string): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}

export class NullAudioBus implements AudioBus {
  private currentMusic: string | null = null;
  readonly events: { type: 'music' | 'sfx' | 'stop' | 'mute'; id?: string; muted?: boolean }[] = [];
  playMusic(trackId: string, _options?: PlayMusicOptions): void {
    if (this.currentMusic === trackId) return;
    this.currentMusic = trackId;
    this.events.push({ type: 'music', id: trackId });
  }
  stopMusic(): void {
    if (!this.currentMusic) return;
    this.currentMusic = null;
    this.events.push({ type: 'stop' });
  }
  playSfx(sfxId: string): void {
    this.events.push({ type: 'sfx', id: sfxId });
  }
  setMuted(muted: boolean): void {
    this.events.push({ type: 'mute', muted });
  }
  dispose(): void {}
}

/**
 * Web Audio + HTMLAudioElement based bus. Used as a fallback when @pixi/sound
 * is not available or on tests that mount a DOM. The Pixi-backed adapter wraps
 * this for parity but routes through the shared resource graph.
 */
export class HtmlAudioBus implements AudioBus {
  private musicEl: HTMLAudioElement | null = null;
  private currentMusic: string | null = null;
  private muted = false;
  constructor(private readonly bundle: AssetBundle, private readonly basePath = '/platformer/assets') {}
  playMusic(trackId: string, _options?: PlayMusicOptions): void {
    if (this.currentMusic === trackId) return;
    this.stopMusic();
    const track = this.bundle.audio.music[trackId];
    if (!track) return;
    const url = track.url ?? `${this.basePath}/music/${trackId}.wav`;
    if (typeof Audio === 'undefined') return;
    const el = new Audio(url);
    el.loop = track.loop ?? true;
    el.volume = this.muted ? 0 : 0.5;
    el.play().catch(() => {});
    this.musicEl = el;
    this.currentMusic = trackId;
  }
  stopMusic(): void {
    if (!this.musicEl) return;
    this.musicEl.pause();
    this.musicEl = null;
    this.currentMusic = null;
  }
  playSfx(sfxId: string): void {
    if (this.muted) return;
    const sfx = this.bundle.audio.sfx[sfxId];
    if (!sfx) return;
    if (typeof Audio === 'undefined') return;
    const url = sfx.url ?? `${this.basePath}/sfx/${sfxId}.wav`;
    const el = new Audio(url);
    el.volume = 0.7;
    el.play().catch(() => {});
  }
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.musicEl) this.musicEl.volume = muted ? 0 : 0.5;
  }
  dispose(): void {
    this.stopMusic();
  }
}
