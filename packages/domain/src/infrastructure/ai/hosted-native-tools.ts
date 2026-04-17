import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import type { ToolSet } from 'ai';
import type { HostedNativeToolName, ModelCard } from '../../shared/chat/index.js';

type HostedTool = ToolSet[string];

export interface HostedNativeToolsResult {
  readonly tools: ToolSet;
  readonly attachedTools: readonly HostedNativeToolName[];
  readonly skippedTools: readonly HostedNativeToolName[];
}

export function buildHostedNativeTools(
  card: ModelCard,
  enabledTools: readonly HostedNativeToolName[],
): HostedNativeToolsResult {
  const tools: ToolSet = {};
  const attachedTools: HostedNativeToolName[] = [];
  const skippedTools: HostedNativeToolName[] = [];

  for (const toolName of enabledTools) {
    const builtTool = buildHostedNativeTool(
      card,
      toolName,
      card.toolPolicy.hostedToolConfigs[toolName],
    );
    if (!builtTool) {
      skippedTools.push(toolName);
      continue;
    }

    tools[toolName] = builtTool;
    attachedTools.push(toolName);
  }

  return { tools, attachedTools, skippedTools };
}

function buildHostedNativeTool(
  card: ModelCard,
  toolName: HostedNativeToolName,
  config: unknown,
): HostedTool | undefined {
  switch (toolName) {
    case 'google_search':
      if (card.provider !== 'google') return undefined;
      return invokeToolFactory(google, ['tools', 'googleSearch'], ensureObject(config));
    case 'file_search':
      return buildFileSearchTool(card, config);
    case 'url_context':
      if (card.provider !== 'google') return undefined;
      return invokeToolFactory(google, ['tools', 'urlContext'], ensureObject(config));
    case 'google_maps':
      if (card.provider !== 'google') return undefined;
      return invokeToolFactory(google, ['tools', 'googleMaps'], ensureObject(config));
    case 'code_execution':
      return card.provider === 'google'
        ? invokeToolFactory(google, ['tools', 'codeExecution'], ensureObject(config))
        : invokeToolFactory(anthropic, ['tools', 'codeExecution_20260120'], ensureObject(config)) ??
            invokeToolFactory(anthropic, ['tools', 'codeExecution_20250825'], ensureObject(config)) ??
            invokeToolFactory(anthropic, ['tools', 'codeExecution_20250522'], ensureObject(config));
    case 'web_search':
      return card.provider === 'openai'
        ? invokeToolFactory(openai, ['tools', 'webSearch'], ensureObject(config))
        : invokeToolFactory(anthropic, ['tools', 'webSearch_20250305'], ensureObject(config));
    case 'web_fetch':
      if (card.provider !== 'anthropic') return undefined;
      return invokeToolFactory(anthropic, ['tools', 'webFetch_20250910'], ensureObject(config));
    case 'image_generation':
      if (card.provider !== 'openai') return undefined;
      return invokeToolFactory(openai, ['tools', 'imageGeneration'], ensureObject(config));
    case 'code_interpreter':
      if (card.provider !== 'openai') return undefined;
      return invokeToolFactory(openai, ['tools', 'codeInterpreter'], ensureObject(config));
  }
}

function buildFileSearchTool(card: ModelCard, config: unknown): HostedTool | undefined {
  const normalized = ensureObject(config);
  const googleStoreNames = Array.isArray(normalized.fileSearchStoreNames)
    ? normalized.fileSearchStoreNames
    : undefined;
  if (card.provider === 'google' && googleStoreNames && googleStoreNames.length > 0) {
    return invokeToolFactory(google, ['tools', 'fileSearch'], normalized);
  }

  const openaiStoreIds = Array.isArray(normalized.vectorStoreIds)
    ? normalized.vectorStoreIds
    : undefined;
  if (card.provider === 'openai' && openaiStoreIds && openaiStoreIds.length > 0) {
    return invokeToolFactory(openai, ['tools', 'fileSearch'], normalized);
  }

  return undefined;
}

function invokeToolFactory(
  provider: unknown,
  path: readonly string[],
  config: Record<string, unknown>,
): HostedTool | undefined {
  let current: any = provider;
  for (const key of path) {
    current = current?.[key];
  }

  if (typeof current !== 'function') {
    return undefined;
  }

  return current(config);
}

function ensureObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}
