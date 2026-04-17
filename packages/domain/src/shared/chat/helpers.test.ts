import { describe, expect, test } from 'bun:test';
import {
  findModelCardByRegistryId,
  findModelCardByModelId,
  findModelCardByProvider,
  resolveSystemAgent,
  resolveUserAgent,
  duplicateSystemAgentAsUser,
  Gpt41ModelCard,
  Claude4SonnetModelCard,
  Gemini25ProModelCard,
  Gemini25FlashModelCard,
  Gemini25FlashLiteModelCard,
  Gemini31ProPreviewModelCard,
  Gemini31FlashLitePreviewModelCard,
  MODEL_CARD_CATALOG,
  ModelProvider,
  formatRegistryId,
  supportsModality,
} from './index.js';
import type {
  SystemAgentDefinition,
  StoredUserAgent,
} from './index.js';

describe('model-card lookups', () => {
  test('finds a card by registryId', () => {
    const card = findModelCardByRegistryId('openai:gpt-4.1');
    expect(card).toBeDefined();
    expect(card!.modelId).toBe('gpt-4.1');
    expect(card!.provider).toBe('openai');
  });

  test('finds a card by modelId', () => {
    const card = findModelCardByModelId('claude-sonnet-4-20250514');
    expect(card).toBeDefined();
    expect(card!.provider).toBe('anthropic');
  });

  test('finds Google preview cards by modelId', () => {
    const card = findModelCardByModelId('gemini-3.1-pro-preview');
    expect(card).toBeDefined();
    expect(card).toBe(Gemini31ProPreviewModelCard);
  });

  test('returns undefined for unknown registryId', () => {
    expect(findModelCardByRegistryId('openai:nonexistent')).toBeUndefined();
  });

  test('returns undefined for unknown modelId', () => {
    expect(findModelCardByModelId('nonexistent-model')).toBeUndefined();
  });

  test('finds all cards by provider', () => {
    const openaiCards = findModelCardByProvider(ModelProvider.OpenAI);
    expect(openaiCards.length).toBe(3);
    expect(openaiCards.every((c) => c.provider === 'openai')).toBe(true);

    const googleCards = findModelCardByProvider(ModelProvider.Google);
    expect(googleCards.length).toBe(5);
  });

  test('formatRegistryId produces correct format', () => {
    expect(formatRegistryId('openai', 'gpt-4.1')).toBe('openai:gpt-4.1');
    expect(formatRegistryId('google', 'gemini-2.5-pro')).toBe('google:gemini-2.5-pro');
  });
});

describe('capability checks', () => {
  test('Gemini 2.5 Pro supports video', () => {
    expect(supportsModality(Gemini25ProModelCard.capabilities, 'video')).toBe(true);
  });

  test('Gemini 3.1 models support video', () => {
    expect(supportsModality(Gemini31ProPreviewModelCard.capabilities, 'video')).toBe(true);
    expect(supportsModality(Gemini31FlashLitePreviewModelCard.capabilities, 'video')).toBe(true);
  });

  test('GPT-4.1 does not support video', () => {
    expect(supportsModality(Gpt41ModelCard.capabilities, 'video')).toBe(false);
  });

  test('all catalog cards support text and streaming', () => {
    for (const card of MODEL_CARD_CATALOG) {
      expect(supportsModality(card.capabilities, 'text')).toBe(true);
      expect(supportsModality(card.capabilities, 'streaming')).toBe(true);
    }
  });

  test('all catalog cards support tools', () => {
    for (const card of MODEL_CARD_CATALOG) {
      expect(supportsModality(card.capabilities, 'tools')).toBe(true);
    }
  });

  test('GPT-4.1 supports image, file, pdf', () => {
    expect(supportsModality(Gpt41ModelCard.capabilities, 'image')).toBe(true);
    expect(supportsModality(Gpt41ModelCard.capabilities, 'file')).toBe(true);
    expect(supportsModality(Gpt41ModelCard.capabilities, 'pdf')).toBe(true);
  });
});

describe('agent resolution', () => {
  const systemDef: SystemAgentDefinition = {
    id: 'system-test',
    name: 'Test Agent',
    description: 'A test system agent.',
    modelCard: Gpt41ModelCard,
    systemPrompt: 'You are a test assistant.',
    defaultToolState: { search: true, calculator: false },
    metadata: { category: 'test' },
  };

  test('resolveSystemAgent produces a correct resolved profile', () => {
    const resolved = resolveSystemAgent(systemDef);

    expect(resolved.id).toBe('system-test');
    expect(resolved.name).toBe('Test Agent');
    expect(resolved.source).toBe('system');
    expect(resolved.systemAgentId).toBe('system-test');
    expect(resolved.isInherited).toBe(false);
    expect(resolved.isStandalone).toBe(false);
    expect(resolved.isEditable).toBe(false);
    expect(resolved.modelCard).toBe(Gpt41ModelCard);
    expect(resolved.systemPrompt).toBe('You are a test assistant.');
    expect(resolved.toolState).toEqual({ search: true, calculator: false });
  });

  test('resolveSystemAgent does not share tool state reference', () => {
    const resolved = resolveSystemAgent(systemDef);
    expect(resolved.toolState).not.toBe(systemDef.defaultToolState);
  });

  test('resolveUserAgent with inheritance merges from system definition', () => {
    const userAgent: StoredUserAgent = {
      id: 'user-agent-1',
      source: 'user',
      inheritsFromSystemAgentId: 'system-test',
      modelCardId: Gpt41ModelCard.registryId,
      systemPrompt: 'Custom prompt.',
      toolOverrides: { calculator: true },
      userOverrides: {},
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    const resolved = resolveUserAgent(userAgent, systemDef, Gpt41ModelCard);

    expect(resolved.id).toBe('user-agent-1');
    expect(resolved.source).toBe('user');
    expect(resolved.isInherited).toBe(true);
    expect(resolved.isDuplicatedFromSystem).toBe(false);
    expect(resolved.isStandalone).toBe(false);
    expect(resolved.isEditable).toBe(true);
    expect(resolved.name).toBe('Test Agent');
    expect(resolved.systemPrompt).toBe('Custom prompt.');
    expect(resolved.toolState).toEqual({ search: true, calculator: true });
    expect(resolved.inheritsFromSystemAgentId).toBe('system-test');
  });

  test('resolveUserAgent without inheritance produces standalone profile', () => {
    const standaloneUser: StoredUserAgent = {
      id: 'user-standalone',
      source: 'user',
      modelCardId: Claude4SonnetModelCard.registryId,
      systemPrompt: 'Standalone prompt.',
      toolOverrides: {},
      userOverrides: { name: 'My Agent', description: 'Custom description' },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    const resolved = resolveUserAgent(standaloneUser, undefined, Claude4SonnetModelCard);

    expect(resolved.isInherited).toBe(false);
    expect(resolved.isDuplicatedFromSystem).toBe(false);
    expect(resolved.isStandalone).toBe(true);
    expect(resolved.name).toBe('My Agent');
    expect(resolved.description).toBe('Custom description');
    expect(resolved.modelCard).toBe(Claude4SonnetModelCard);
  });

  test('resolveUserAgent keeps standalone runtime tool state explicit', () => {
    const standaloneUser: StoredUserAgent = {
      id: 'user-openai',
      source: 'user',
      modelCardId: Gpt41ModelCard.registryId,
      systemPrompt: 'Standalone prompt.',
      toolOverrides: {},
      userOverrides: { name: 'OpenAI Agent', description: 'No hosted defaults enabled.' },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    const resolved = resolveUserAgent(standaloneUser, undefined, Gpt41ModelCard);

    expect(resolved.toolState).toEqual({});
  });

  test('resolveSystemAgent defaults toolsEnabled to true when undefined', () => {
    const resolved = resolveSystemAgent(systemDef);
    expect(resolved.toolsEnabled).toBe(true);
  });

  test('resolveSystemAgent preserves explicit toolsEnabled=false from definition', () => {
    const resolved = resolveSystemAgent({ ...systemDef, toolsEnabled: false });
    expect(resolved.toolsEnabled).toBe(false);
  });

  test('resolveUserAgent inherits toolsEnabled from the system definition when not overridden', () => {
    const userAgent: StoredUserAgent = {
      id: 'user-inherit-tools',
      source: 'user',
      inheritsFromSystemAgentId: 'system-test',
      modelCardId: Gpt41ModelCard.registryId,
      systemPrompt: 'Inherit tools.',
      toolOverrides: {},
      userOverrides: {},
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    const resolved = resolveUserAgent(
      userAgent,
      { ...systemDef, toolsEnabled: false },
      Gpt41ModelCard,
    );
    expect(resolved.toolsEnabled).toBe(false);
  });

  test('resolveUserAgent prefers explicit toolsEnabled override on the stored user agent', () => {
    const userAgent: StoredUserAgent = {
      id: 'user-override-tools',
      source: 'user',
      inheritsFromSystemAgentId: 'system-test',
      modelCardId: Gpt41ModelCard.registryId,
      systemPrompt: 'Override tools.',
      toolsEnabled: true,
      toolOverrides: {},
      userOverrides: {},
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    const resolved = resolveUserAgent(
      userAgent,
      { ...systemDef, toolsEnabled: false },
      Gpt41ModelCard,
    );
    expect(resolved.toolsEnabled).toBe(true);
  });
});

describe('agent duplication', () => {
  const systemDef: SystemAgentDefinition = {
    id: 'system-dup-test',
    name: 'Dup Agent',
    description: 'Agent to duplicate.',
    modelCard: Gemini25FlashLiteModelCard,
    systemPrompt: 'Original prompt.',
    defaultToolState: { webSearch: true },
    metadata: { priority: 'high' },
  };

  test('duplicateSystemAgentAsUser produces an independent user agent', () => {
    const duplicated = duplicateSystemAgentAsUser(systemDef, 'user-dup-1');

    expect(duplicated.id).toBe('user-dup-1');
    expect(duplicated.source).toBe('user');
    expect(duplicated.inheritsFromSystemAgentId).toBeUndefined();
    expect(duplicated.duplicatedFromSystemAgentId).toBe('system-dup-test');
    expect(duplicated.modelCardId).toBe(Gemini25FlashLiteModelCard.registryId);
    expect(duplicated.systemPrompt).toBe('Original prompt.');
    expect(duplicated.toolOverrides).toEqual({ webSearch: true });
    expect(duplicated.userOverrides).toEqual({
      name: 'Dup Agent',
      description: 'Agent to duplicate.',
    });
  });

  test('duplicated agent tool overrides are independent of system definition', () => {
    const duplicated = duplicateSystemAgentAsUser(systemDef, 'user-dup-2');
    expect(duplicated.toolOverrides).not.toBe(systemDef.defaultToolState);
  });

  test('resolved duplicated agent is editable and not inherited', () => {
    const duplicated = duplicateSystemAgentAsUser(systemDef, 'user-dup-3');
    const resolved = resolveUserAgent(duplicated, undefined, Gemini25FlashLiteModelCard);

    expect(resolved.isEditable).toBe(true);
    expect(resolved.isInherited).toBe(false);
    expect(resolved.isDuplicatedFromSystem).toBe(true);
    expect(resolved.isStandalone).toBe(true);
  });
});
