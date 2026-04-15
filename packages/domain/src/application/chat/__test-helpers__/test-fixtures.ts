import { mock } from 'bun:test';
import type { LanguageModel } from 'ai';
import type { SystemAgentDefinition } from '../../../shared/chat/index.js';
import type { ISystemAgentDefinitionSource } from '../ports.js';
import type { ProviderRegistry } from '../../../infrastructure/ai/provider-registry.js';

export class InMemorySystemSource implements ISystemAgentDefinitionSource {
  constructor(private readonly agents: SystemAgentDefinition[] = []) {}
  loadAll() { return [...this.agents]; }
  findById(id: string) { return this.agents.find((a) => a.id === id); }
}

export function createMockLanguageModel(modelId = 'gpt-4.1'): LanguageModel {
  return {
    modelId,
    specificationVersion: 'v2',
    provider: 'mock',
    supportedUrls: {},
    doGenerate: mock(async () => ({
      content: [{ type: 'text' as const, text: 'Hello', providerMetadata: {} }],
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: 5 },
      warnings: [],
    })),
    doStream: mock(async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start' as const, warnings: [] });
          controller.enqueue({ type: 'text-start' as const, id: 't1' });
          controller.enqueue({ type: 'text-delta' as const, id: 't1', delta: 'Hello' });
          controller.enqueue({ type: 'text-end' as const, id: 't1' });
          controller.enqueue({
            type: 'finish' as const,
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 5 },
          });
          controller.close();
        },
      }),
    })),
  } as unknown as LanguageModel;
}

export function createMockRegistry(model?: LanguageModel): ProviderRegistry {
  const m = model ?? createMockLanguageModel();
  return {
    languageModel: (_id: string) => m,
    textEmbeddingModel: () => { throw new Error('not implemented'); },
    imageModel: () => { throw new Error('not implemented'); },
  } as unknown as ProviderRegistry;
}
