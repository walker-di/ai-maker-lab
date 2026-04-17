export const ModelProvider = {
  OpenAI: 'openai',
  Anthropic: 'anthropic',
  Google: 'google',
} as const;

export type ModelProvider = (typeof ModelProvider)[keyof typeof ModelProvider];

export const SupportedModelId = {
  Gpt41: 'gpt-4.1',
  Gpt41Mini: 'gpt-4.1-mini',
  Gpt4o: 'gpt-4o',
  Claude4Sonnet: 'claude-sonnet-4-20250514',
  Claude35Haiku: 'claude-3-5-haiku-20241022',
  Gemini25Pro: 'gemini-2.5-pro',
  Gemini25Flash: 'gemini-2.5-flash',
  Gemini25FlashLite: 'gemini-2.5-flash-lite',
  Gemini31ProPreview: 'gemini-3.1-pro-preview',
  Gemini31FlashLitePreview: 'gemini-3.1-flash-lite-preview',
} as const;

export type SupportedModelId = (typeof SupportedModelId)[keyof typeof SupportedModelId];

export function formatRegistryId(provider: ModelProvider, modelId: string): string {
  return `${provider}:${modelId}`;
}
