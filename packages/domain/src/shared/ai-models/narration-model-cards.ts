export type NarrationProviderId = 'azure' | 'huggingface-local' | 'vibevoice-local';

export type NarrationModelAvailability = 'available' | 'blocked' | 'missing';

export type NarrationModelStatus = NarrationModelAvailability | 'experimental';

export type NarrationOptionStability = 'stable' | 'experimental';

export interface NarrationModelCapabilities {
  readonly longForm?: boolean;
  readonly streaming?: boolean;
  readonly maxSpeakers?: number;
}

export interface NarrationVoiceCard {
  readonly value: string;
  readonly label: string;
  readonly stability?: NarrationOptionStability;
}

export interface NarrationLanguageCard {
  readonly value: string;
  readonly label: string;
  readonly stability?: NarrationOptionStability;
}

export interface NarrationModelCard {
  readonly provider: NarrationProviderId;
  readonly value: string;
  readonly label: string;
  readonly availability: NarrationModelAvailability;
  readonly status: NarrationModelStatus;
  readonly reason?: string;
  readonly warning?: string;
  readonly badges?: readonly string[];
  readonly capabilities?: NarrationModelCapabilities;
  readonly voices: readonly NarrationVoiceCard[];
  readonly languages: readonly NarrationLanguageCard[];
}

export const NARRATION_MODEL_CARD_CATALOG: readonly NarrationModelCard[] = [
  {
    provider: 'azure',
    value: 'azure-neural',
    label: 'Azure Neural Voices (managed)',
    availability: 'available',
    status: 'available',
    badges: ['managed'],
    capabilities: {
      longForm: true,
      streaming: false,
    },
    voices: [],
    languages: [],
  },
  {
    provider: 'huggingface-local',
    value: 'Xenova/mms-tts-eng',
    label: 'MMS TTS English (HF local)',
    availability: 'available',
    status: 'available',
    badges: ['local'],
    capabilities: {
      longForm: false,
      streaming: false,
      maxSpeakers: 1,
    },
    voices: [{
      value: 'default',
      label: 'Default voice (model-managed)',
      stability: 'stable',
    }],
    languages: [{
      value: 'en-US',
      label: 'English (US)',
      stability: 'stable',
    }],
  },
  {
    provider: 'vibevoice-local',
    value: 'microsoft/VibeVoice-1.5B',
    label: 'VibeVoice 1.5B (long-form)',
    availability: 'blocked',
    status: 'blocked',
    reason: 'Official local usage is disabled upstream for this runtime.',
    warning: 'VibeVoice local usage is blocked until upstream enables official support.',
    badges: ['long-form', 'blocked'],
    capabilities: {
      longForm: true,
      streaming: false,
      maxSpeakers: 4,
    },
    voices: [{
      value: 'default',
      label: 'Default speaker (model-managed)',
      stability: 'stable',
    }],
    languages: [
      {
        value: 'en-US',
        label: 'English',
        stability: 'stable',
      },
      {
        value: 'zh-CN',
        label: 'Chinese',
        stability: 'stable',
      },
    ],
  },
  {
    provider: 'vibevoice-local',
    value: 'microsoft/VibeVoice-Realtime-0.5B',
    label: 'VibeVoice Realtime 0.5B',
    availability: 'missing',
    status: 'experimental',
    reason: 'Local runtime support is missing or experimental in this app.',
    warning: 'Realtime local runtime is not configured and language quality varies by locale.',
    badges: ['realtime', 'streaming', 'experimental'],
    capabilities: {
      longForm: false,
      streaming: true,
      maxSpeakers: 1,
    },
    voices: [{
      value: 'default',
      label: 'Default speaker (model-managed)',
      stability: 'experimental',
    }],
    languages: [
      {
        value: 'en-US',
        label: 'English',
        stability: 'stable',
      },
      {
        value: 'de-DE',
        label: 'German',
        stability: 'experimental',
      },
      {
        value: 'fr-FR',
        label: 'French',
        stability: 'experimental',
      },
      {
        value: 'it-IT',
        label: 'Italian',
        stability: 'experimental',
      },
      {
        value: 'ja-JP',
        label: 'Japanese',
        stability: 'experimental',
      },
      {
        value: 'ko-KR',
        label: 'Korean',
        stability: 'experimental',
      },
      {
        value: 'nl-NL',
        label: 'Dutch',
        stability: 'experimental',
      },
      {
        value: 'pl-PL',
        label: 'Polish',
        stability: 'experimental',
      },
      {
        value: 'pt-PT',
        label: 'Portuguese',
        stability: 'experimental',
      },
      {
        value: 'es-ES',
        label: 'Spanish',
        stability: 'experimental',
      },
    ],
  },
] as const;

const MODEL_CARD_BY_PROVIDER_AND_VALUE = new Map<string, NarrationModelCard>(
  NARRATION_MODEL_CARD_CATALOG.map((card) => [`${card.provider}:${card.value}`, card]),
);

const MODEL_CARD_BY_VALUE = new Map<string, NarrationModelCard>(
  NARRATION_MODEL_CARD_CATALOG.map((card) => [card.value, card]),
);

export function listNarrationModelCards(provider?: NarrationProviderId): NarrationModelCard[] {
  if (!provider) return [...NARRATION_MODEL_CARD_CATALOG];
  return NARRATION_MODEL_CARD_CATALOG.filter((card) => card.provider === provider);
}

export function findNarrationModelCard(value: string): NarrationModelCard | undefined {
  return MODEL_CARD_BY_VALUE.get(value);
}

export function findNarrationModelCardForProvider(
  provider: NarrationProviderId,
  value?: string,
): NarrationModelCard | undefined {
  if (value) {
    const exact = MODEL_CARD_BY_PROVIDER_AND_VALUE.get(`${provider}:${value}`);
    if (exact) return exact;
  }
  return NARRATION_MODEL_CARD_CATALOG.find((card) => card.provider === provider);
}
