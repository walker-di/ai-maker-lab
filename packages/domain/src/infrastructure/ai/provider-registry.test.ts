import { describe, expect, test } from 'bun:test';
import { buildProviderRegistry } from './provider-registry.js';
import { resolveWrappedModel } from './wrapped-models.js';
import { loadSystemAgentDefinitions, findSystemAgentById } from './system-agent-loader.js';
import { Gpt41ModelCard, Gemini25ProModelCard, MODEL_CARD_CATALOG } from '../../shared/chat/index.js';

describe('buildProviderRegistry', () => {
  test('creates a registry without throwing', () => {
    const registry = buildProviderRegistry({
      openaiApiKey: 'test-key',
      anthropicApiKey: 'test-key',
      googleApiKey: 'test-key',
    });

    expect(registry).toBeDefined();
    expect(typeof registry.languageModel).toBe('function');
  });

  test('registry resolves a known openai model without error', () => {
    const registry = buildProviderRegistry({
      openaiApiKey: 'test-key',
      anthropicApiKey: 'test-key',
      googleApiKey: 'test-key',
    });

    const model = registry.languageModel('openai:gpt-4.1');
    expect(model).toBeDefined();
    expect(model.modelId).toBe('gpt-4.1');
  });

  test('registry resolves anthropic and google models', () => {
    const registry = buildProviderRegistry({
      openaiApiKey: 'test-key',
      anthropicApiKey: 'test-key',
      googleApiKey: 'test-key',
    });

    const anthropicModel = registry.languageModel('anthropic:claude-sonnet-4-20250514');
    expect(anthropicModel).toBeDefined();

    const googleModel = registry.languageModel('google:gemini-2.5-pro');
    expect(googleModel).toBeDefined();
  });
});

describe('resolveWrappedModel', () => {
  test('returns base model when no provider options preset', () => {
    const registry = buildProviderRegistry({
      openaiApiKey: 'test-key',
      anthropicApiKey: 'test-key',
      googleApiKey: 'test-key',
    });

    const model = resolveWrappedModel(registry, Gpt41ModelCard);
    expect(model).toBeDefined();
    expect(model.modelId).toBe('gpt-4.1');
  });

  test('wraps model when provider options preset is present', () => {
    const registry = buildProviderRegistry({
      openaiApiKey: 'test-key',
      anthropicApiKey: 'test-key',
      googleApiKey: 'test-key',
    });

    const cardWithPreset = {
      ...Gpt41ModelCard,
      providerOptionsPreset: { openai: { reasoningEffort: 'high' } },
    };

    const model = resolveWrappedModel(registry, cardWithPreset);
    expect(model).toBeDefined();
  });

  test('resolves all catalog cards without error', () => {
    const registry = buildProviderRegistry({
      openaiApiKey: 'test-key',
      anthropicApiKey: 'test-key',
      googleApiKey: 'test-key',
    });

    for (const card of MODEL_CARD_CATALOG) {
      const model = resolveWrappedModel(registry, card);
      expect(model).toBeDefined();
    }
  });
});

describe('system agent loader', () => {
  test('loads default system agents', () => {
    const agents = loadSystemAgentDefinitions();
    expect(agents.length).toBeGreaterThanOrEqual(3);

    const general = agents.find((a) => a.id === 'system-general');
    expect(general).toBeDefined();
    expect(general!.name).toBe('General Assistant');
    expect(general!.systemPrompt).toBeTruthy();
  });

  test('finds system agent by id', () => {
    const agent = findSystemAgentById('system-creative');
    expect(agent).toBeDefined();
    expect(agent!.name).toBe('Creative Writer');
    expect(agent!.modelCard.provider).toBe('anthropic');
  });

  test('returns undefined for unknown agent id', () => {
    expect(findSystemAgentById('nonexistent')).toBeUndefined();
  });

  test('loaded agents do not share references', () => {
    const agents1 = loadSystemAgentDefinitions();
    const agents2 = loadSystemAgentDefinitions();
    expect(agents1).not.toBe(agents2);
  });
});
