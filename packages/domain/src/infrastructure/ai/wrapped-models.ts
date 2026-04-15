import { wrapLanguageModel, defaultSettingsMiddleware } from 'ai';
import type { ModelCard } from '../../shared/chat/index.js';
import type { ProviderRegistry } from './provider-registry.js';

export type RegistryModelId = `openai:${string}` | `anthropic:${string}` | `google:${string}`;

type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };

export function resolveWrappedModel(
  registry: ProviderRegistry,
  card: ModelCard,
) {
  const baseModel = registry.languageModel(card.registryId as RegistryModelId);

  if (Object.keys(card.providerOptionsPreset).length === 0) {
    return baseModel;
  }

  return wrapLanguageModel({
    model: baseModel,
    middleware: defaultSettingsMiddleware({
      settings: {
        providerOptions: card.providerOptionsPreset as Record<string, Record<string, JSONValue>>,
      },
    }),
  });
}
