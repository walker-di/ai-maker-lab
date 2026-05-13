import { describe, expect, test } from 'bun:test';
import { NullAudioBus, WebAudioBus } from './audio-bus.js';

describe('AudioBus contract', () => {
  test('null bus accepts mute and resume calls for deterministic tests', async () => {
    const bus = new NullAudioBus();
    expect(() => bus.setMuted?.(true)).not.toThrow();
    await expect(bus.resume?.()).resolves.toBeUndefined();
    expect(() => bus.playSfx('select')).not.toThrow();
  });

  test('web audio bus updates gain with a stub audio context', () => {
    const originalAudioContext = (globalThis as typeof globalThis & { AudioContext?: unknown }).AudioContext;
    const gainTargets: number[] = [];

    class AudioContextStub {
      readonly state = 'running';
      readonly currentTime = 0;
      readonly destination = {};
      readonly sampleRate = 44_100;

      createGain() {
        return {
          gain: {
            setTargetAtTime(value: number) {
              gainTargets.push(value);
            },
            setValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
          connect() {},
        };
      }

      createOscillator() {
        return {
          type: 'sine',
          frequency: { setValueAtTime() {} },
          connect() {},
          start() {},
          stop() {},
        };
      }

      createBuffer(_channels: number, length: number, _sampleRate: number) {
        return {
          getChannelData() {
            return new Float32Array(Math.max(1, length));
          },
        };
      }

      createBufferSource() {
        return {
          buffer: null,
          connect() {},
          start() {},
          stop() {},
        };
      }

      resume() {
        return Promise.resolve();
      }

      close() {
        return Promise.resolve();
      }
    }

    (globalThis as typeof globalThis & { AudioContext?: unknown }).AudioContext = AudioContextStub;

    try {
      const bus = new WebAudioBus();
      expect(() => bus.playSfx('select')).not.toThrow();
      bus.setMuted(true);
      bus.setMuted(false);
      expect(() => bus.playSfx('victory')).not.toThrow();
      expect(gainTargets).toContain(0.7);
      expect(gainTargets).toContain(0);
      bus.dispose();
    } finally {
      (globalThis as typeof globalThis & { AudioContext?: unknown }).AudioContext = originalAudioContext;
    }
  });
});
