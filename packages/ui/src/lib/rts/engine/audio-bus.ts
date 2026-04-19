export interface AudioBus {
  playSfx(key: string, options?: { volume?: number }): void;
  playMusic(key: string, options?: { volume?: number; loop?: boolean }): void;
  stopMusic(): void;
  setMasterVolume(volume: number): void;
  dispose(): void;
}

export class NullAudioBus implements AudioBus {
  playSfx(): void {}
  playMusic(): void {}
  stopMusic(): void {}
  setMasterVolume(): void {}
  dispose(): void {}
}
