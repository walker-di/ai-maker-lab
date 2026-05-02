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

const QWEN3_TTS_LANGUAGES: readonly NarrationLanguageCard[] = [
  { value: 'zh-CN', label: 'Chinese (zh-CN)', stability: 'stable' },
  { value: 'en-US', label: 'English (en-US)', stability: 'stable' },
  { value: 'ja-JP', label: 'Japanese (ja-JP)', stability: 'stable' },
  { value: 'ko-KR', label: 'Korean (ko-KR)', stability: 'stable' },
  { value: 'de-DE', label: 'German (de-DE)', stability: 'stable' },
  { value: 'fr-FR', label: 'French (fr-FR)', stability: 'stable' },
  { value: 'ru-RU', label: 'Russian (ru-RU)', stability: 'stable' },
  { value: 'pt-PT', label: 'Portuguese (pt-PT)', stability: 'stable' },
  { value: 'es-ES', label: 'Spanish (es-ES)', stability: 'stable' },
  { value: 'it-IT', label: 'Italian (it-IT)', stability: 'stable' },
] as const;

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
    provider: 'huggingface-local',
    value: 'onnx-community/Kokoro-82M-ONNX',
    label: 'Kokoro 82M (HF local)',
    availability: 'available',
    status: 'available',
    badges: ['local', 'multi-voice'],
    capabilities: {
      longForm: false,
      streaming: false,
      maxSpeakers: 11,
    },
    voices: [
      { value: 'af', label: 'American English Female (default)', stability: 'stable' },
      { value: 'af_bella', label: 'American English Female – Bella', stability: 'stable' },
      { value: 'af_nicole', label: 'American English Female – Nicole', stability: 'stable' },
      { value: 'af_sarah', label: 'American English Female – Sarah', stability: 'stable' },
      { value: 'af_sky', label: 'American English Female – Sky', stability: 'stable' },
      { value: 'am_adam', label: 'American English Male – Adam', stability: 'stable' },
      { value: 'am_michael', label: 'American English Male – Michael', stability: 'stable' },
      { value: 'bf_emma', label: 'British English Female – Emma', stability: 'stable' },
      { value: 'bf_isabella', label: 'British English Female – Isabella', stability: 'stable' },
      { value: 'bm_george', label: 'British English Male – George', stability: 'stable' },
      { value: 'bm_lewis', label: 'British English Male – Lewis', stability: 'stable' },
    ],
    languages: [
      { value: 'en-US', label: 'English (US)', stability: 'stable' },
      { value: 'en-GB', label: 'English (GB)', stability: 'stable' },
    ],
  },
  {
    provider: 'huggingface-local',
    value: 'Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign',
    label: 'Qwen3-TTS 1.7B Voice Design (HF local)',
    availability: 'available',
    status: 'available',
    badges: ['local', 'voice-design', 'streaming'],
    capabilities: {
      longForm: false,
      streaming: true,
      maxSpeakers: 1,
    },
    voices: [{
      value: 'default',
      label: 'Default voice (model-managed)',
      stability: 'stable',
    }],
    languages: QWEN3_TTS_LANGUAGES,
  },
  {
    provider: 'huggingface-local',
    value: 'Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice',
    label: 'Qwen3-TTS 1.7B Custom Voice (HF local)',
    availability: 'available',
    status: 'available',
    badges: ['local', 'custom-voice', 'streaming'],
    capabilities: {
      longForm: false,
      streaming: true,
      maxSpeakers: 1,
    },
    voices: [{
      value: 'default',
      label: 'Default voice (model-managed)',
      stability: 'stable',
    }],
    languages: QWEN3_TTS_LANGUAGES,
  },
  {
    provider: 'huggingface-local',
    value: 'Qwen/Qwen3-TTS-12Hz-1.7B-Base',
    label: 'Qwen3-TTS 1.7B Base (HF local)',
    availability: 'available',
    status: 'available',
    badges: ['local', 'voice-clone', 'streaming'],
    capabilities: {
      longForm: false,
      streaming: true,
      maxSpeakers: 1,
    },
    voices: [{
      value: 'default',
      label: 'Default voice (model-managed)',
      stability: 'stable',
    }],
    languages: QWEN3_TTS_LANGUAGES,
  },
  {
    provider: 'huggingface-local',
    value: 'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice',
    label: 'Qwen3-TTS 0.6B Custom Voice (HF local)',
    availability: 'available',
    status: 'available',
    badges: ['local', 'custom-voice', 'streaming'],
    capabilities: {
      longForm: false,
      streaming: true,
      maxSpeakers: 1,
    },
    voices: [{
      value: 'default',
      label: 'Default voice (model-managed)',
      stability: 'stable',
    }],
    languages: QWEN3_TTS_LANGUAGES,
  },
  {
    provider: 'huggingface-local',
    value: 'Qwen/Qwen3-TTS-12Hz-0.6B-Base',
    label: 'Qwen3-TTS 0.6B Base (HF local)',
    availability: 'available',
    status: 'available',
    badges: ['local', 'voice-clone', 'streaming'],
    capabilities: {
      longForm: false,
      streaming: true,
      maxSpeakers: 1,
    },
    voices: [{
      value: 'default',
      label: 'Default voice (model-managed)',
      stability: 'stable',
    }],
    languages: QWEN3_TTS_LANGUAGES,
  },
  {
    provider: 'vibevoice-local',
    value: 'microsoft/VibeVoice-1.5B',
    label: 'VibeVoice 1.5B (long-form)',
    availability: 'available',
    status: 'experimental',
    reason: 'Experimental local ONNX runtime. Requires onnxruntime-node.',
    warning: 'VibeVoice uses prompt/reference-audio speaker guidance instead of a fixed voice catalog.',
    badges: ['long-form', 'experimental'],
    capabilities: {
      longForm: true,
      streaming: false,
      maxSpeakers: 4,
    },
    voices: [
      {
        value: 'default',
        label: 'Default speaker control',
        stability: 'experimental',
      },
      {
        value: 'speaker-prompt-a',
        label: 'Speaker prompt slot A (text prompt-guided)',
        stability: 'experimental',
      },
      {
        value: 'speaker-prompt-b',
        label: 'Speaker prompt slot B (text prompt-guided)',
        stability: 'experimental',
      },
      {
        value: 'reference-audio-slot-1',
        label: 'Reference audio slot 1 (speaker sample)',
        stability: 'experimental',
      },
      {
        value: 'custom-reference-audio',
        label: 'Custom reference audio (user-provided sample)',
        stability: 'experimental',
      },
    ],
    languages: [
      {
        value: 'auto',
        label: 'Auto (infer script language from narration text)',
        stability: 'stable',
      },
      {
        value: 'en-US',
        label: 'English script (en-US)',
        stability: 'stable',
      },
      {
        value: 'zh-CN',
        label: 'Chinese/Mandarin script (zh-CN)',
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
      label: 'Default speaker control',
      stability: 'experimental',
    }],
    languages: [
      {
        value: 'auto',
        label: 'Auto (infer script language from narration text)',
        stability: 'experimental',
      },
      {
        value: 'en-US',
        label: 'English script (en-US)',
        stability: 'experimental',
      },
      {
        value: 'zh-CN',
        label: 'Chinese/Mandarin script (zh-CN)',
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
