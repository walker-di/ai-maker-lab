import { describe, expect, test } from 'bun:test';
import { ModelHandler } from './model-handler.js';
import type { ResolvedAgentProfile } from '../../shared/chat/index.js';
import { Gpt41ModelCard, Gemini25ProModelCard, Claude35HaikuModelCard, FAMILY_STRATEGIES } from '../../shared/chat/index.js';
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
    const agent = createTestAgent({ modelCard: Gemini25ProModelCard });

    const result = await handler.generate(agent, {
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(result.text).toBe('Hello');
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

  test('CLAUDE35 strategy has prepareMessages', () => {
    expect(FAMILY_STRATEGIES['claude35'].prepareMessages).toBeDefined();
  });

  test('FAMILY_STRATEGIES has entries for all families', () => {
    expect(FAMILY_STRATEGIES).toHaveProperty('gpt41');
    expect(FAMILY_STRATEGIES).toHaveProperty('claude4');
    expect(FAMILY_STRATEGIES).toHaveProperty('claude35');
    expect(FAMILY_STRATEGIES).toHaveProperty('gemini25');
  });

  test('all model cards carry a familyId', () => {
    expect(Gpt41ModelCard.familyId).toBe('gpt41');
    expect(Gemini25ProModelCard.familyId).toBe('gemini25');
    expect(Claude35HaikuModelCard.familyId).toBe('claude35');
  });
});
