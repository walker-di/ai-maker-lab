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
    expect(keys).toContain('vibevoice-local:microsoft/VibeVoice-1.5B');
    expect(keys).toContain('vibevoice-local:microsoft/VibeVoice-Realtime-0.5B');
  });

  test('captures blocked and missing vibevoice runtime metadata', () => {
    const longForm = findNarrationModelCardForProvider('vibevoice-local', 'microsoft/VibeVoice-1.5B');
    expect(longForm?.availability).toBe('blocked');
    expect(longForm?.capabilities?.longForm).toBe(true);
    expect(longForm?.capabilities?.maxSpeakers).toBe(4);

    const realtime = findNarrationModelCardForProvider('vibevoice-local', 'microsoft/VibeVoice-Realtime-0.5B');
    expect(realtime?.availability).toBe('missing');
    expect(realtime?.status).toBe('experimental');
    expect(realtime?.capabilities?.streaming).toBe(true);
    expect(realtime?.capabilities?.maxSpeakers).toBe(1);
    const stableLanguage = realtime?.languages.find((language) => language.value === 'en-US');
    expect(stableLanguage?.stability).toBe('stable');
    const experimentalLanguage = realtime?.languages.find((language) => language.value === 'es-ES');
    expect(experimentalLanguage?.stability).toBe('experimental');
  });
});
