import { describe, expect, test } from 'bun:test';
import {
  findNarrationModelCardForProvider,
  listNarrationModelCards,
} from './narration-model-cards.js';

describe('narration model cards', () => {
  test('includes required provider model cards', () => {
    const all = listNarrationModelCards();
    const keys = all.map((card) => `${card.provider}:${card.value}`);

    expect(keys).toContain('azure:azure-neural');
    expect(keys).toContain('huggingface-local:Xenova/mms-tts-eng');
    expect(keys).toContain('huggingface-local:onnx-community/Kokoro-82M-ONNX');
    expect(keys).toContain('vibevoice-local:microsoft/VibeVoice-1.5B');
    expect(keys).toContain('vibevoice-local:microsoft/VibeVoice-Realtime-0.5B');
  });

  test('Kokoro 82M has the expected voices and languages', () => {
    const kokoro = findNarrationModelCardForProvider('huggingface-local', 'onnx-community/Kokoro-82M-ONNX');
    expect(kokoro?.availability).toBe('available');
    expect(kokoro?.capabilities?.maxSpeakers).toBe(11);
    const voiceValues = kokoro?.voices.map((v) => v.value) ?? [];
    expect(voiceValues).toContain('af');
    expect(voiceValues).toContain('af_bella');
    expect(voiceValues).toContain('am_adam');
    expect(voiceValues).toContain('bm_lewis');
    const langValues = kokoro?.languages.map((l) => l.value) ?? [];
    expect(langValues).toContain('en-US');
    expect(langValues).toContain('en-GB');
  });

  test('captures experimental and missing vibevoice runtime metadata', () => {
    const longForm = findNarrationModelCardForProvider('vibevoice-local', 'microsoft/VibeVoice-1.5B');
    expect(longForm?.availability).toBe('available');
    expect(longForm?.status).toBe('experimental');
    expect(longForm?.capabilities?.longForm).toBe(true);
    expect(longForm?.capabilities?.maxSpeakers).toBe(4);
    expect(longForm?.voices).toEqual(expect.arrayContaining([
      expect.objectContaining({
        value: 'default',
        label: 'Default speaker control',
      }),
      expect.objectContaining({
        value: 'reference-audio-slot-1',
        label: 'Reference audio slot 1 (speaker sample)',
      }),
      expect.objectContaining({
        value: 'custom-reference-audio',
        label: 'Custom reference audio (user-provided sample)',
      }),
    ]));
    expect(longForm?.languages).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'auto', label: 'Auto (infer script language from narration text)' }),
      expect.objectContaining({ value: 'en-US', label: 'English script (en-US)' }),
      expect.objectContaining({ value: 'zh-CN', label: 'Chinese/Mandarin script (zh-CN)' }),
    ]));

    const realtime = findNarrationModelCardForProvider('vibevoice-local', 'microsoft/VibeVoice-Realtime-0.5B');
    expect(realtime?.availability).toBe('missing');
    expect(realtime?.status).toBe('experimental');
    expect(realtime?.capabilities?.streaming).toBe(true);
    expect(realtime?.capabilities?.maxSpeakers).toBe(1);
    expect(realtime?.languages).toEqual([
      expect.objectContaining({
        value: 'auto',
        label: 'Auto (infer script language from narration text)',
        stability: 'experimental',
      }),
      expect.objectContaining({
        value: 'en-US',
        label: 'English script (en-US)',
        stability: 'experimental',
      }),
      expect.objectContaining({
        value: 'zh-CN',
        label: 'Chinese/Mandarin script (zh-CN)',
        stability: 'experimental',
      }),
    ]);
  });
});
