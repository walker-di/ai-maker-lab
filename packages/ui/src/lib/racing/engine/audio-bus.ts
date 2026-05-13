/**
 * Audio bus contract for the racing engine. Day-one ships only `NullAudioBus`
 * — audio synthesis is a follow-up. The real `WebAudioBus` will hook engine
 * RPM, tire scrub, and brake hiss in a later change.
 */

export interface AudioBus {
  setRpm(rpm: number): void;
  setLoad(load: number): void;
  setSurfaceMix(scrub: number): void;
  trigger(event: 'shift' | 'collision' | 'lapStart' | 'lapEnd'): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}

export class NullAudioBus implements AudioBus {
  setRpm(_rpm: number): void {}
  setLoad(_load: number): void {}
  setSurfaceMix(_scrub: number): void {}
  trigger(_event: 'shift' | 'collision' | 'lapStart' | 'lapEnd'): void {}
  setMuted(_muted: boolean): void {}
  dispose(): void {}
}
