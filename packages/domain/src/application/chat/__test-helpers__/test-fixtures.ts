import { simulateReadableStream } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import type { SystemAgentDefinition } from '../../../shared/chat/index.js';
import type { ISystemAgentDefinitionSource } from '../ports.js';
import type { ProviderRegistry } from '../../../infrastructure/ai/provider-registry.js';

export class InMemorySystemSource implements ISystemAgentDefinitionSource {
  constructor(private readonly agents: SystemAgentDefinition[] = []) {}
  loadAll() { return [...this.agents]; }
  findById(id: string) { return this.agents.find((a) => a.id === id); }
}

export function createMockLanguageModel(modelId = 'gpt-4.1') {
  return new MockLanguageModelV3({
    modelId,
    doGenerate: async () => ({
      content: [{ type: 'text', text: 'Hello' }],
      finishReason: { unified: 'stop' as const, raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 5, text: 5, reasoning: undefined },
      },
      warnings: [],
    }),
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'text-start' as const, id: 't1' },
          { type: 'text-delta' as const, id: 't1', delta: 'Hello' },
          { type: 'text-end' as const, id: 't1' },
          {
            type: 'finish' as const,
            finishReason: { unified: 'stop' as const, raw: undefined },
            logprobs: undefined,
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 5, text: 5, reasoning: undefined },
            },
          },
        ],
      }),
    }),
  });
}

export function createMockRegistry(model?: MockLanguageModelV3): ProviderRegistry {
  const m = model ?? createMockLanguageModel();
  return {
    languageModel: (_id: string) => m,
    textEmbeddingModel: () => { throw new Error('not implemented'); },
    imageModel: () => { throw new Error('not implemented'); },
  } as unknown as ProviderRegistry;
}
