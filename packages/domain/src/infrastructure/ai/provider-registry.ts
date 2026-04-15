import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createProviderRegistry } from 'ai';

export interface ProviderRegistryConfig {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  googleApiKey?: string;
}

export function buildProviderRegistry(config: ProviderRegistryConfig = {}) {
  return createProviderRegistry({
    openai: createOpenAI({
      apiKey: config.openaiApiKey ?? process.env.OPENAI_API_KEY,
    }),
    anthropic: createAnthropic({
      apiKey: config.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY,
    }),
    google: createGoogleGenerativeAI({
      apiKey: config.googleApiKey ?? process.env.GEMINI_API_KEY,
    }),
  });
}

export type ProviderRegistry = ReturnType<typeof buildProviderRegistry>;
