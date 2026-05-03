import { describe, expect, test } from 'bun:test';
import { NullAudioBus } from './audio-bus.js';

describe('AudioBus contract', () => {
  test('null bus accepts mute and resume calls for deterministic tests', async () => {
    const bus = new NullAudioBus();
    expect(() => bus.setMuted?.(true)).not.toThrow();
    await expect(bus.resume?.()).resolves.toBeUndefined();
    expect(() => bus.playSfx('select')).not.toThrow();
  });
});
