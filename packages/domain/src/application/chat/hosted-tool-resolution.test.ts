import { describe, expect, test } from 'bun:test';
import { resolveHostedToolState } from './hosted-tool-resolution.js';
import type { ResolvedAgentProfile } from '../../shared/chat/index.js';
import {
  Gpt41ModelCard,
  Gemini25ProModelCard,
  Claude4SonnetModelCard,
} from '../../shared/chat/index.js';

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
    toolsEnabled: true,
    toolState: {},
    metadata: {},
    ...overrides,
  };
}

describe('resolveHostedToolState', () => {
  test('enables GPT-4.1 default hosted tools when tool state is empty', () => {
    const resolved = resolveHostedToolState(createTestAgent());

    expect(resolved.enabledTools).toEqual(['web_search', 'image_generation']);
  });

  test('ignores unknown tool names from agent state', () => {
    const resolved = resolveHostedToolState(
      createTestAgent({
        toolState: {
          unknown_tool: true,
        },
      }),
    );

    expect(resolved.enabledTools).toEqual(['web_search', 'image_generation']);
  });

  test('enables supported openai hosted tools from agent state', () => {
    const resolved = resolveHostedToolState(
      createTestAgent({
        toolState: {
          web_search: true,
          code_interpreter: true,
          google_search: true,
        },
      }),
    );

    expect(resolved.enabledTools).toEqual(['web_search', 'image_generation', 'code_interpreter']);
  });

  test('filters tools to the current model card provider surface', () => {
    const resolved = resolveHostedToolState(
      createTestAgent({
        modelCard: Claude4SonnetModelCard,
        toolState: {
          web_search: true,
          web_fetch: true,
          image_generation: true,
        },
      }),
    );

    expect(resolved.enabledTools).toEqual(['web_search', 'web_fetch']);
  });

  test('respects explicit false for removable hosted tools', () => {
    const card = {
      ...Gemini25ProModelCard,
      toolPolicy: {
        ...Gemini25ProModelCard.toolPolicy,
        defaultEnabledTools: ['google_search', 'url_context'],
      },
    };

    const resolved = resolveHostedToolState(
      createTestAgent({
        modelCard: card,
        toolState: {
          url_context: false,
        },
      }),
    );

    expect(resolved.enabledTools).toEqual(['google_search']);
  });

  test('applies default-enabled tools from the model card before explicit overrides', () => {
    const card = {
      ...Gemini25ProModelCard,
      toolPolicy: {
        ...Gemini25ProModelCard.toolPolicy,
        defaultEnabledTools: ['google_search'],
        modelSpecificToolAdditions: ['url_context'],
      },
    };

    const resolved = resolveHostedToolState(
      createTestAgent({
        modelCard: card,
      }),
    );

    expect(resolved.enabledTools).toEqual(['google_search', 'url_context']);
  });

  test('invokes the model card tool-policy hook to add and remove tools', () => {
    const card = {
      ...Gemini25ProModelCard,
      toolPolicy: {
        ...Gemini25ProModelCard.toolPolicy,
        defaultEnabledTools: ['google_search'],
        hook: ({ hasAttachments }: { hasAttachments: boolean }) => {
          if (!hasAttachments) {
            return undefined;
          }
          return {
            addedTools: ['url_context'] as const,
            removedTools: ['google_search'] as const,
            providerOptionOverrides: { google: { extra: 'attachments-mode' } },
          };
        },
      },
    };

    const baseline = resolveHostedToolState(createTestAgent({ modelCard: card }));
    expect(baseline.enabledTools).toEqual(['google_search']);

    const withAttachments = resolveHostedToolState(
      createTestAgent({ modelCard: card }),
      { hasAttachments: true, attachmentClassifications: ['pdf'] },
    );
    expect(withAttachments.enabledTools).toEqual(['url_context']);
    expect(withAttachments.providerOptions).toMatchObject({
      google: { extra: 'attachments-mode' },
    });
  });

  test('disables all hosted tools when toolsEnabled is false', () => {
    const resolved = resolveHostedToolState(
      createTestAgent({
        toolsEnabled: false,
        toolState: { web_search: true, image_generation: true },
      }),
    );

    expect(resolved.enabledTools).toEqual([]);
    expect(resolved.providerOptions).toEqual({});
  });
});
