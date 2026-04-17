import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { ModelHandler } from './model-handler.js';
import type { ResolvedAgentProfile } from '../../shared/chat/index.js';
import {
  Gpt41ModelCard,
  Gemini25ProModelCard,
  Gemini25FlashLiteModelCard,
  Gemini31ProPreviewModelCard,
  Claude35HaikuModelCard,
  FAMILY_STRATEGIES,
} from '../../shared/chat/index.js';
import { createMockRegistry } from './__test-helpers__/test-fixtures.js';

function createTestAgent(overrides?: Partial<ResolvedAgentProfile>): ResolvedAgentProfile {
  return {
    id: 'test-agent',
    name: 'Test Agent',
    description: 'A test agent.',
    source: 'system',
    systemAgentId: 'test-agent',
    isInherited: false,
    isStandalone: false,
    isEditable: false,
    modelCard: Gpt41ModelCard,
    systemPrompt: 'You are a test assistant.',
    toolState: {},
    metadata: {},
    ...overrides,
  };
}

describe('ModelHandler with family strategies', () => {
  let consoleInfoSpy: ReturnType<typeof mock>;

  beforeEach(() => {
    consoleInfoSpy = mock(() => {});
    console.info = consoleInfoSpy as typeof console.info;
  });

  afterEach(() => {
    mock.restore();
  });

  test('generate produces text via mock language model', async () => {
    const registry = createMockRegistry();
    const handler = new ModelHandler(registry);
    const agent = createTestAgent();

    const result = await handler.generate(agent, {
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(result.text).toBe('Hello');
    expect(result.finishReason).toBe('stop');
  });

  test('stream produces text via mock language model', async () => {
    const registry = createMockRegistry();
    const handler = new ModelHandler(registry);
    const agent = createTestAgent();

    const result = handler.stream(agent, {
      messages: [{ role: 'user', content: 'hi' }],
    });

    const text = await result.text;
    expect(text).toBe('Hello');
  });

  test('handler uses systemPrompt from resolved agent', async () => {
    const registry = createMockRegistry();
    const handler = new ModelHandler(registry);
    const agent = createTestAgent({ systemPrompt: 'Custom prompt.' });

    const result = await handler.generate(agent, {
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(result.text).toBe('Hello');
  });

  test('handler resolves model for the agent modelCard', async () => {
    const registry = createMockRegistry();
    const handler = new ModelHandler(registry);
    const agent = createTestAgent({ modelCard: Gemini31ProPreviewModelCard });

    const result = await handler.generate(agent, {
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(result.text).toBe('Hello');
  });

  test('handler resolves stable Google variants for the agent modelCard', async () => {
    const registry = createMockRegistry();
    const handler = new ModelHandler(registry);
    const agent = createTestAgent({ modelCard: Gemini25FlashLiteModelCard });

    const result = await handler.generate(agent, {
      messages: [{ role: 'user', content: 'Summarize this quickly.' }],
    });

    expect(result.text).toBe('Hello');
  });

  test('handler still streams when hosted tools are enabled', async () => {
    const registry = createMockRegistry();
    const handler = new ModelHandler(registry);
    const agent = createTestAgent({
      modelCard: Gemini25ProModelCard,
      toolState: {
        google_search: true,
      },
    });

    const result = handler.stream(agent, {
      messages: [{ role: 'user', content: 'Find the latest AI SDK release notes.' }],
    });

    const text = await result.text;
    expect(text).toBe('Hello');
  });

  test('stream debug logs include attached hosted tools for GPT-4.1 web search', async () => {
    const registry = createMockRegistry();
    const handler = new ModelHandler(registry);
    const agent = createTestAgent({
      toolState: {
        web_search: true,
      },
    });

    const result = handler.stream(agent, {
      threadId: 'thread-debug',
      messages: [{ role: 'user', content: 'Find the current USD/BRL exchange rate.' }],
    });

    await result.text;

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      '[chat-debug] model-handler.stream.start',
      expect.objectContaining({
        threadId: 'thread-debug',
        modelRegistryId: 'openai:gpt-4.1',
        enabledHostedTools: expect.arrayContaining(['web_search', 'image_generation']),
        attachedHostedTools: expect.arrayContaining(['web_search', 'image_generation']),
      }),
    );
  });

  test('stream debug logs attach google_search and never surface image_generation for Gemini 2.5 Pro', async () => {
    const registry = createMockRegistry();
    const handler = new ModelHandler(registry);
    const agent = createTestAgent({
      modelCard: Gemini25ProModelCard,
      toolState: {
        google_search: true,
        image_generation: true,
      },
    });

    const result = handler.stream(agent, {
      threadId: 'thread-gemini',
      messages: [{ role: 'user', content: 'What is the weather in Sao Paulo?' }],
    });

    await result.text;

    const call = consoleInfoSpy.mock.calls.find(
      ([label]: readonly unknown[]) => label === '[chat-debug] model-handler.stream.start',
    );
    expect(call).toBeDefined();
    const payload = call?.[1] as {
      readonly modelRegistryId: string;
      readonly enabledHostedTools: string[];
      readonly attachedHostedTools: string[];
      readonly skippedHostedTools: string[];
    };

    expect(payload.modelRegistryId).toBe(Gemini25ProModelCard.registryId);
    expect(payload.attachedHostedTools).toContain('google_search');
    expect(payload.attachedHostedTools).not.toContain('image_generation');
    expect(payload.attachedHostedTools).not.toContain('web_search');
    expect(payload.enabledHostedTools).not.toContain('image_generation');
  });

  test('stream debug logs attach web_search and web_fetch and never surface image_generation for Claude 3.5 Haiku', async () => {
    const registry = createMockRegistry();
    const handler = new ModelHandler(registry);
    const agent = createTestAgent({
      modelCard: Claude35HaikuModelCard,
      toolState: {
        web_search: true,
        web_fetch: true,
        image_generation: true,
      },
    });

    const result = handler.stream(agent, {
      threadId: 'thread-claude',
      messages: [{ role: 'user', content: 'Summarize the latest AI SDK docs page.' }],
    });

    await result.text;

    const call = consoleInfoSpy.mock.calls.find(
      ([label]: readonly unknown[]) => label === '[chat-debug] model-handler.stream.start',
    );
    expect(call).toBeDefined();
    const payload = call?.[1] as {
      readonly modelRegistryId: string;
      readonly enabledHostedTools: string[];
      readonly attachedHostedTools: string[];
      readonly skippedHostedTools: string[];
    };

    expect(payload.modelRegistryId).toBe(Claude35HaikuModelCard.registryId);
    expect(payload.attachedHostedTools).toEqual(
      expect.arrayContaining(['web_search', 'web_fetch']),
    );
    expect(payload.attachedHostedTools).not.toContain('image_generation');
    expect(payload.attachedHostedTools).not.toContain('google_search');
    expect(payload.enabledHostedTools).not.toContain('image_generation');
  });

  test('stream debug logs include attached hosted tools for GPT-4.1 image generation', async () => {
    const registry = createMockRegistry();
    const handler = new ModelHandler(registry);
    const agent = createTestAgent({
      toolState: {
        image_generation: true,
      },
    });

    const result = handler.stream(agent, {
      threadId: 'thread-image',
      messages: [{ role: 'user', content: 'Create a panda image.' }],
    });

    await result.text;

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      '[chat-debug] model-handler.stream.start',
      expect.objectContaining({
        threadId: 'thread-image',
        modelRegistryId: 'openai:gpt-4.1',
        enabledHostedTools: expect.arrayContaining(['web_search', 'image_generation']),
        attachedHostedTools: expect.arrayContaining(['web_search', 'image_generation']),
        skippedHostedTools: [],
      }),
    );
  });

});

describe('ModelHandler with swappable registry source', () => {
  test('accepts a getter and re-resolves the registry per request', async () => {
    const registryA = createMockRegistry();
    const registryB = createMockRegistry();
    let current = registryA;
    const handler = new ModelHandler(() => current);
    const agent = createTestAgent();

    const a = await handler.generate(agent, {
      messages: [{ role: 'user', content: 'first' }],
    });
    expect(a.text).toBe('Hello');

    current = registryB;

    const b = await handler.generate(agent, {
      messages: [{ role: 'user', content: 'second' }],
    });
    expect(b.text).toBe('Hello');
  });
});

describe('model card input policies', () => {
  test('GPT-4.1 rejects video input', () => {
    const agent = createTestAgent();
    expect(agent.modelCard.inputPolicy.video.outcome).toBe('reject');
    expect(agent.modelCard.inputPolicy.video.reason).toContain('does not support video');
  });

  test('Gemini 2.5 Pro allows video input', () => {
    const agent = createTestAgent({ modelCard: Gemini25ProModelCard });
    expect(agent.modelCard.inputPolicy.video.outcome).toBe('pass-through');
  });

  test('Claude 3.5 Haiku rejects file and pdf', () => {
    const agent = createTestAgent({ modelCard: Claude35HaikuModelCard });
    expect(agent.modelCard.inputPolicy.file.outcome).toBe('reject');
    expect(agent.modelCard.inputPolicy.pdf.outcome).toBe('reject');
    expect(agent.modelCard.inputPolicy.video.outcome).toBe('reject');
  });
});

describe('family strategy objects', () => {
  test('GPT41 strategy has prepareMessages', () => {
    expect(FAMILY_STRATEGIES['gpt41'].prepareMessages).toBeDefined();
  });

  test('GEMINI25 strategy is empty (full multimodal)', () => {
    const gemini = FAMILY_STRATEGIES['gemini25'];
    expect(gemini.prepareMessages).toBeUndefined();
    expect(gemini.resolveTools).toBeUndefined();
    expect(gemini.providerOptions).toBeUndefined();
  });

  test('GEMINI31 strategy is empty (full multimodal)', () => {
    const gemini = FAMILY_STRATEGIES['gemini31'];
    expect(gemini.prepareMessages).toBeUndefined();
    expect(gemini.resolveTools).toBeUndefined();
    expect(gemini.providerOptions).toBeUndefined();
  });

  test('CLAUDE35 strategy has prepareMessages', () => {
    expect(FAMILY_STRATEGIES['claude35'].prepareMessages).toBeDefined();
  });

  test('FAMILY_STRATEGIES has entries for all families', () => {
    expect(FAMILY_STRATEGIES).toHaveProperty('gpt41');
    expect(FAMILY_STRATEGIES).toHaveProperty('claude4');
    expect(FAMILY_STRATEGIES).toHaveProperty('claude35');
    expect(FAMILY_STRATEGIES).toHaveProperty('gemini25');
    expect(FAMILY_STRATEGIES).toHaveProperty('gemini31');
  });

  test('all model cards carry a familyId', () => {
    expect(Gpt41ModelCard.familyId).toBe('gpt41');
    expect(Gemini25ProModelCard.familyId).toBe('gemini25');
    expect(Gemini31ProPreviewModelCard.familyId).toBe('gemini31');
    expect(Claude35HaikuModelCard.familyId).toBe('claude35');
  });

  test('model cards expose hosted native tool metadata', () => {
    expect(Gpt41ModelCard.nativeToolSupportLevel).toBe('hosted');
    expect(Gpt41ModelCard.nativeTools).toContain('web_search');
    expect(Gemini25ProModelCard.nativeTools).toContain('google_search');
    expect(Gemini31ProPreviewModelCard.nativeTools).toContain('google_search');
    expect(Claude35HaikuModelCard.nativeTools).toContain('web_fetch');
  });
});
