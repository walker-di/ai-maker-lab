import type { ModelMessage, ToolSet } from 'ai';
import type { ModelCard } from './model-card.js';
import type { ModelCapabilityMatrix } from './model-capability-matrix.js';
import type { ModelInputPolicy } from './model-input-policy.js';
import type {
  NativeToolSupportLevel,
  HostedNativeToolName,
  NativeToolFamily,
} from './model-native-tools.js';
import { ModelProvider, SupportedModelId, formatRegistryId } from './model-provider.js';
import { DEFAULT_UI_PRESENTATION } from './model-ui-presentation.js';
import { DEFAULT_INPUT_POLICY, VIDEO_CAPABLE_INPUT_POLICY } from './model-input-policy.js';
import { DEFAULT_TOOL_POLICY } from './model-tool-policy.js';

// ── Family strategy ──

export interface ModelFamilyStrategy {
  prepareMessages?(messages: ModelMessage[], card: ModelCard): ModelMessage[];
  resolveTools?(requestedState: Record<string, boolean>): ToolSet;
  providerOptions?: Record<string, Record<string, unknown>>;
}

function stripPartTypes(types: readonly string[]) {
  return (messages: ModelMessage[]): ModelMessage[] =>
    messages.map((msg) => {
      if (msg.role !== 'user' || !Array.isArray(msg.content)) return msg;
      const filtered = msg.content.filter(
        (part: { type: string }) => !types.includes(part.type),
      );
      return { ...msg, content: filtered.length > 0 ? filtered : msg.content };
    });
}

// ── Family infrastructure ──

interface ModelFamily {
  readonly familyId: string;
  readonly provider: ModelProvider;
  readonly capabilities: ModelCapabilityMatrix;
  readonly inputPolicy: ModelInputPolicy;
  readonly disabledComposerControls: readonly string[];
  readonly nativeToolSupportLevel: NativeToolSupportLevel;
  readonly nativeTools: readonly HostedNativeToolName[];
  readonly nativeToolFamilies: readonly NativeToolFamily[];
  readonly toolPolicy?: Partial<ModelCard['toolPolicy']>;
  readonly strategy: ModelFamilyStrategy;
}

interface MemberSpec {
  readonly modelId: SupportedModelId;
  readonly label: string;
  readonly description: string;
  readonly badges: readonly string[];
}

function defineCard(family: ModelFamily, member: MemberSpec): ModelCard {
  return {
    familyId: family.familyId,
    provider: family.provider,
    modelId: member.modelId,
    registryId: formatRegistryId(family.provider, member.modelId),
    label: member.label,
    description: member.description,
    capabilities: family.capabilities,
    uiPresentation: {
      ...DEFAULT_UI_PRESENTATION,
      badges: member.badges,
      disabledComposerControls: family.disabledComposerControls,
    },
    inputPolicy: family.inputPolicy,
    nativeToolSupportLevel: family.nativeToolSupportLevel,
    nativeTools: family.nativeTools,
    nativeToolFamilies: family.nativeToolFamilies,
    toolPolicy: {
      ...DEFAULT_TOOL_POLICY,
      ...family.toolPolicy,
      hostedToolConfigs: {
        ...DEFAULT_TOOL_POLICY.hostedToolConfigs,
        ...(family.toolPolicy?.hostedToolConfigs ?? {}),
      },
    },
    providerOptionsPreset: {},
  };
}

// ── Shared capability profiles ──

const VISION_NO_VIDEO: ModelCapabilityMatrix = {
  text: true,
  image: true,
  file: true,
  pdf: true,
  video: false,
  streaming: true,
  tools: true,
  replyThreads: false,
};

const VISION_TEXT_ONLY: ModelCapabilityMatrix = {
  text: true,
  image: true,
  file: false,
  pdf: false,
  video: false,
  streaming: true,
  tools: true,
  replyThreads: false,
};

const FULL_MULTIMODAL: ModelCapabilityMatrix = {
  text: true,
  image: true,
  file: true,
  pdf: true,
  video: true,
  streaming: true,
  tools: true,
  replyThreads: false,
};

const NO_VIDEO_INPUT_POLICY: ModelInputPolicy = {
  ...DEFAULT_INPUT_POLICY,
  video: { outcome: 'reject', reason: 'This model does not support video input.' },
};

const CLAUDE35_INPUT_POLICY: ModelInputPolicy = {
  ...DEFAULT_INPUT_POLICY,
  file: { outcome: 'reject', reason: 'Claude 3.5 Haiku does not support file input.' },
  pdf: { outcome: 'reject', reason: 'Claude 3.5 Haiku does not support PDF input.' },
  video: { outcome: 'reject', reason: 'Claude 3.5 Haiku does not support video input.' },
};

// ── OpenAI GPT-4.1 family ──

const GPT41_FAMILY: ModelFamily = {
  familyId: 'gpt41',
  provider: ModelProvider.OpenAI,
  capabilities: VISION_NO_VIDEO,
  inputPolicy: NO_VIDEO_INPUT_POLICY,
  disabledComposerControls: ['video-attach'],
  nativeToolSupportLevel: 'hosted',
  nativeTools: ['web_search', 'file_search', 'image_generation', 'code_interpreter'],
  nativeToolFamilies: ['search', 'retrieval', 'imageGeneration', 'codeExecution'],
  toolPolicy: {
    defaultEnabledTools: ['web_search', 'image_generation'],
    removableTools: ['web_search', 'file_search', 'image_generation', 'code_interpreter'],
  },
  strategy: { prepareMessages: stripPartTypes(['file']) },
};

export const Gpt41ModelCard = defineCard(GPT41_FAMILY, {
  modelId: SupportedModelId.Gpt41,
  label: 'GPT-4.1',
  description: 'OpenAI GPT-4.1 — strong reasoning and tool use.',
  badges: ['reasoning'],
});

export const Gpt41MiniModelCard = defineCard(GPT41_FAMILY, {
  modelId: SupportedModelId.Gpt41Mini,
  label: 'GPT-4.1 Mini',
  description: 'OpenAI GPT-4.1 Mini — fast, cost-effective model.',
  badges: ['fast'],
});

export const Gpt4oModelCard = defineCard(GPT41_FAMILY, {
  modelId: SupportedModelId.Gpt4o,
  label: 'GPT-4o',
  description: 'OpenAI GPT-4o — multimodal model with vision and audio.',
  badges: ['multimodal'],
});

// ── Anthropic Claude 4 family ──

const CLAUDE4_FAMILY: ModelFamily = {
  familyId: 'claude4',
  provider: ModelProvider.Anthropic,
  capabilities: VISION_NO_VIDEO,
  inputPolicy: NO_VIDEO_INPUT_POLICY,
  disabledComposerControls: ['video-attach'],
  nativeToolSupportLevel: 'hosted',
  nativeTools: ['web_search', 'web_fetch', 'code_execution'],
  nativeToolFamilies: ['search', 'retrieval', 'codeExecution'],
  toolPolicy: {
    defaultEnabledTools: [],
    removableTools: ['web_search', 'web_fetch', 'code_execution'],
  },
  strategy: { prepareMessages: stripPartTypes(['file']) },
};

export const Claude4SonnetModelCard = defineCard(CLAUDE4_FAMILY, {
  modelId: SupportedModelId.Claude4Sonnet,
  label: 'Claude Sonnet 4',
  description: 'Anthropic Claude Sonnet 4 — balanced intelligence and speed.',
  badges: ['balanced'],
});

// ── Anthropic Claude 3.5 family ──

const CLAUDE35_FAMILY: ModelFamily = {
  familyId: 'claude35',
  provider: ModelProvider.Anthropic,
  capabilities: VISION_TEXT_ONLY,
  inputPolicy: CLAUDE35_INPUT_POLICY,
  disabledComposerControls: ['video-attach', 'file-attach', 'pdf-attach'],
  nativeToolSupportLevel: 'hosted',
  nativeTools: ['web_search', 'web_fetch', 'code_execution'],
  nativeToolFamilies: ['search', 'retrieval', 'codeExecution'],
  toolPolicy: {
    defaultEnabledTools: [],
    removableTools: ['web_search', 'web_fetch', 'code_execution'],
  },
  strategy: { prepareMessages: stripPartTypes(['file']) },
};

export const Claude35HaikuModelCard = defineCard(CLAUDE35_FAMILY, {
  modelId: SupportedModelId.Claude35Haiku,
  label: 'Claude 3.5 Haiku',
  description: 'Anthropic Claude 3.5 Haiku — fast and lightweight.',
  badges: ['fast'],
});

// ── Google Gemini 2.5 family ──

const GEMINI25_FAMILY: ModelFamily = {
  familyId: 'gemini25',
  provider: ModelProvider.Google,
  capabilities: FULL_MULTIMODAL,
  inputPolicy: VIDEO_CAPABLE_INPUT_POLICY,
  disabledComposerControls: [],
  nativeToolSupportLevel: 'hosted',
  nativeTools: ['google_search', 'file_search', 'url_context', 'google_maps', 'code_execution'],
  nativeToolFamilies: ['search', 'retrieval', 'urlContext', 'maps', 'codeExecution'],
  toolPolicy: {
    defaultEnabledTools: [],
    removableTools: ['google_search', 'file_search', 'url_context', 'google_maps', 'code_execution'],
  },
  strategy: {},
};

export const Gemini25ProModelCard = defineCard(GEMINI25_FAMILY, {
  modelId: SupportedModelId.Gemini25Pro,
  label: 'Gemini 2.5 Pro',
  description: 'Google Gemini 2.5 Pro — multimodal with native video support.',
  badges: ['multimodal', 'video'],
});

export const Gemini25FlashModelCard = defineCard(GEMINI25_FAMILY, {
  modelId: SupportedModelId.Gemini25Flash,
  label: 'Gemini 2.5 Flash',
  description: 'Google Gemini 2.5 Flash — fast multimodal with video.',
  badges: ['fast', 'video'],
});

export const Gemini25FlashLiteModelCard = defineCard(GEMINI25_FAMILY, {
  modelId: SupportedModelId.Gemini25FlashLite,
  label: 'Gemini 2.5 Flash-Lite',
  description: 'Google Gemini 2.5 Flash-Lite — fastest low-cost multimodal model.',
  badges: ['fast', 'budget', 'video'],
});

// ── Google Gemini 3.1 family ──

const GEMINI31_FAMILY: ModelFamily = {
  familyId: 'gemini31',
  provider: ModelProvider.Google,
  capabilities: FULL_MULTIMODAL,
  inputPolicy: VIDEO_CAPABLE_INPUT_POLICY,
  disabledComposerControls: [],
  nativeToolSupportLevel: 'hosted',
  nativeTools: ['google_search', 'file_search', 'url_context', 'google_maps', 'code_execution'],
  nativeToolFamilies: ['search', 'retrieval', 'urlContext', 'maps', 'codeExecution'],
  toolPolicy: {
    defaultEnabledTools: [],
    removableTools: ['google_search', 'file_search', 'url_context', 'google_maps', 'code_execution'],
  },
  strategy: {},
};

export const Gemini31ProPreviewModelCard = defineCard(GEMINI31_FAMILY, {
  modelId: SupportedModelId.Gemini31ProPreview,
  label: 'Gemini 3.1 Pro',
  description: 'Google Gemini 3.1 Pro preview — advanced multimodal reasoning.',
  badges: ['multimodal', 'video'],
});

export const Gemini31FlashLitePreviewModelCard = defineCard(GEMINI31_FAMILY, {
  modelId: SupportedModelId.Gemini31FlashLitePreview,
  label: 'Gemini 3.1 Flash-Lite',
  description: 'Google Gemini 3.1 Flash-Lite preview — cost-efficient multimodal speed.',
  badges: ['fast', 'budget', 'video'],
});

// ── Catalog ──

export const MODEL_CARD_CATALOG: readonly ModelCard[] = [
  Gpt41ModelCard,
  Gpt41MiniModelCard,
  Gpt4oModelCard,
  Claude4SonnetModelCard,
  Claude35HaikuModelCard,
  Gemini25ProModelCard,
  Gemini25FlashModelCard,
  Gemini25FlashLiteModelCard,
  Gemini31ProPreviewModelCard,
  Gemini31FlashLitePreviewModelCard,
];

// ── Family strategies (keyed by familyId) ──

export const FAMILY_STRATEGIES: Record<string, ModelFamilyStrategy> = {
  [GPT41_FAMILY.familyId]: GPT41_FAMILY.strategy,
  [CLAUDE4_FAMILY.familyId]: CLAUDE4_FAMILY.strategy,
  [CLAUDE35_FAMILY.familyId]: CLAUDE35_FAMILY.strategy,
  [GEMINI25_FAMILY.familyId]: GEMINI25_FAMILY.strategy,
  [GEMINI31_FAMILY.familyId]: GEMINI31_FAMILY.strategy,
};
