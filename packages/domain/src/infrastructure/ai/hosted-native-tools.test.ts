import { describe, expect, test } from 'bun:test';
import type { ModelCard } from '../../shared/chat/index.js';
import {
  Gpt41ModelCard,
  Gemini25ProModelCard,
  Claude4SonnetModelCard,
} from '../../shared/chat/index.js';
import type { HostedNativeToolName } from '../../shared/chat/index.js';
import { buildHostedNativeTools } from './hosted-native-tools.js';

function withToolConfig(
  card: ModelCard,
  configs: Partial<Record<HostedNativeToolName, unknown>>,
): ModelCard {
  return {
    ...card,
    toolPolicy: {
      ...card.toolPolicy,
      hostedToolConfigs: { ...card.toolPolicy.hostedToolConfigs, ...configs },
    },
  };
}

function expectProviderTool(tool: unknown, expectedId: string) {
  expect(tool).toBeDefined();
  const t = tool as { type: string; id: string };
  expect(t.type).toBe('provider');
  expect(t.id).toBe(expectedId);
}

describe('buildHostedNativeTools', () => {
  test('returns empty result for empty enabledTools', () => {
    const result = buildHostedNativeTools(Gpt41ModelCard, []);
    expect(result.tools).toEqual({});
    expect(result.attachedTools).toEqual([]);
    expect(result.skippedTools).toEqual([]);
  });

  // --- Google provider ---

  test('Google: attaches google_search', () => {
    const result = buildHostedNativeTools(Gemini25ProModelCard, ['google_search']);
    expect(result.attachedTools).toEqual(['google_search']);
    expect(result.skippedTools).toEqual([]);
    expectProviderTool(result.tools.google_search, 'google.google_search');
  });

  test('Google: attaches url_context and google_maps', () => {
    const result = buildHostedNativeTools(Gemini25ProModelCard, ['url_context', 'google_maps']);
    expect(result.attachedTools).toEqual(['url_context', 'google_maps']);
    expectProviderTool(result.tools.url_context, 'google.url_context');
    expectProviderTool(result.tools.google_maps, 'google.google_maps');
  });

  test('Google: attaches code_execution via Google factory', () => {
    const result = buildHostedNativeTools(Gemini25ProModelCard, ['code_execution']);
    expect(result.attachedTools).toEqual(['code_execution']);
    expectProviderTool(result.tools.code_execution, 'google.code_execution');
  });

  test('Google: skips OpenAI-only tools', () => {
    const result = buildHostedNativeTools(Gemini25ProModelCard, [
      'web_search',
      'image_generation',
      'code_interpreter',
    ]);
    expect(result.skippedTools).toContain('image_generation');
    expect(result.skippedTools).toContain('code_interpreter');
  });

  // --- OpenAI provider ---

  test('OpenAI: attaches web_search and code_interpreter', () => {
    const result = buildHostedNativeTools(Gpt41ModelCard, ['web_search', 'code_interpreter']);
    expect(result.attachedTools).toEqual(['web_search', 'code_interpreter']);
    expectProviderTool(result.tools.web_search, 'openai.web_search');
    expectProviderTool(result.tools.code_interpreter, 'openai.code_interpreter');
  });

  test('OpenAI: attaches image_generation', () => {
    const result = buildHostedNativeTools(Gpt41ModelCard, ['image_generation']);
    expect(result.attachedTools).toEqual(['image_generation']);
    expectProviderTool(result.tools.image_generation, 'openai.image_generation');
  });

  test('OpenAI: skips Google-only tools', () => {
    const result = buildHostedNativeTools(Gpt41ModelCard, [
      'google_search',
      'url_context',
      'google_maps',
    ]);
    expect(result.attachedTools).toEqual([]);
    expect(result.skippedTools).toEqual(['google_search', 'url_context', 'google_maps']);
  });

  // --- Anthropic provider ---

  test('Anthropic: attaches web_search via Anthropic factory', () => {
    const result = buildHostedNativeTools(Claude4SonnetModelCard, ['web_search']);
    expect(result.attachedTools).toEqual(['web_search']);
    expectProviderTool(result.tools.web_search, 'anthropic.web_search_20250305');
  });

  test('Anthropic: attaches web_fetch', () => {
    const result = buildHostedNativeTools(Claude4SonnetModelCard, ['web_fetch']);
    expect(result.attachedTools).toEqual(['web_fetch']);
    expectProviderTool(result.tools.web_fetch, 'anthropic.web_fetch_20250910');
  });

  test('Anthropic: attaches code_execution via fallback chain', () => {
    const result = buildHostedNativeTools(Claude4SonnetModelCard, ['code_execution']);
    expect(result.attachedTools).toEqual(['code_execution']);
    expectProviderTool(result.tools.code_execution, 'anthropic.code_execution_20260120');
  });

  test('Anthropic: skips OpenAI-only tools', () => {
    const result = buildHostedNativeTools(Claude4SonnetModelCard, [
      'image_generation',
      'code_interpreter',
    ]);
    expect(result.attachedTools).toEqual([]);
    expect(result.skippedTools).toEqual(['image_generation', 'code_interpreter']);
  });

  // --- file_search requires config ---

  test('file_search: skipped for Google without fileSearchStoreNames config', () => {
    const result = buildHostedNativeTools(Gemini25ProModelCard, ['file_search']);
    expect(result.skippedTools).toEqual(['file_search']);
  });

  test('file_search: attached for Google with fileSearchStoreNames config', () => {
    const card = withToolConfig(Gemini25ProModelCard, {
      file_search: { fileSearchStoreNames: ['store-1'] },
    });
    const result = buildHostedNativeTools(card, ['file_search']);
    expect(result.attachedTools).toEqual(['file_search']);
    expectProviderTool(result.tools.file_search, 'google.file_search');
  });

  test('file_search: skipped for OpenAI without vectorStoreIds config', () => {
    const result = buildHostedNativeTools(Gpt41ModelCard, ['file_search']);
    expect(result.skippedTools).toEqual(['file_search']);
  });

  test('file_search: attached for OpenAI with vectorStoreIds config', () => {
    const card = withToolConfig(Gpt41ModelCard, {
      file_search: { vectorStoreIds: ['vs-123'] },
    });
    const result = buildHostedNativeTools(card, ['file_search']);
    expect(result.attachedTools).toEqual(['file_search']);
    expectProviderTool(result.tools.file_search, 'openai.file_search');
  });

  test('file_search: skipped for Anthropic (no provider support)', () => {
    const result = buildHostedNativeTools(Claude4SonnetModelCard, ['file_search']);
    expect(result.skippedTools).toEqual(['file_search']);
  });

  // --- mixed scenarios ---

  test('mixed tools: partitions into attached and skipped', () => {
    const result = buildHostedNativeTools(Gpt41ModelCard, [
      'web_search',
      'google_search',
      'code_interpreter',
      'url_context',
    ]);
    expect(result.attachedTools).toEqual(['web_search', 'code_interpreter']);
    expect(result.skippedTools).toEqual(['google_search', 'url_context']);
  });
});
