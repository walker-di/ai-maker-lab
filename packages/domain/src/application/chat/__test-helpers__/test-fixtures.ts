import { simulateReadableStream, type ModelMessage } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import type { HostedNativeToolName, SystemAgentDefinition } from '../../../shared/chat/index.js';
import type { ISystemAgentDefinitionSource } from '../ports.js';
import type { ProviderRegistry } from '../../../infrastructure/ai/provider-registry.js';

export class InMemorySystemSource implements ISystemAgentDefinitionSource {
  constructor(private readonly agents: SystemAgentDefinition[] = []) {}
  loadAll() { return [...this.agents]; }
  findById(id: string) { return this.agents.find((a) => a.id === id); }
}

export const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sZrxh8AAAAASUVORK5CYII=';

export const IMAGE_GENERATION_PREVIEW_URL = 'https://cdn.openai.com/generated/panda';

export interface HostedToolFixture {
  readonly toolName: HostedNativeToolName;
  readonly toolCallId: string;
  readonly assistantText: string;
  readonly input: Record<string, unknown>;
  readonly output: Record<string, unknown>;
  readonly streamedParts: readonly Record<string, unknown>[];
  readonly responseMessages: readonly ModelMessage[];
  readonly expectsPreviewParts: boolean;
}

function buildStreamedToolParts(
  toolName: HostedNativeToolName,
  toolCallId: string,
  assistantText: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  options: { providerExecuted?: boolean } = {},
): readonly Record<string, unknown>[] {
  const part: Record<string, unknown> = {
    type: `tool-${toolName}`,
    toolCallId,
    state: 'output-available',
    input,
    output,
  };

  if (options.providerExecuted === true) {
    part.providerExecuted = true;
  }

  return [
    { type: 'text', text: assistantText },
    part,
  ];
}

function buildResponseMessages(
  assistantText: string,
  toolName: HostedNativeToolName,
  toolCallId: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  options: { providerExecuted?: boolean } = {},
): readonly ModelMessage[] {
  return [
    {
      role: 'assistant',
      content: [
        { type: 'text', text: assistantText },
        {
          type: `tool-${toolName}`,
          toolCallId,
          state: 'output-available',
          input,
          output,
          ...(options.providerExecuted === true ? { providerExecuted: true } : {}),
        },
      ],
    } as unknown as ModelMessage,
  ];
}

export const HOSTED_TOOL_FIXTURES: readonly HostedToolFixture[] = [
  {
    toolName: 'image_generation',
    toolCallId: 'tool-image-1',
    assistantText: 'Here is your panda image.',
    input: { prompt: 'pls create a panda image' },
    output: {
      result: ONE_PIXEL_PNG_BASE64,
    },
    streamedParts: buildStreamedToolParts(
      'image_generation',
      'tool-image-1',
      'Here is your panda image.',
      { prompt: 'pls create a panda image' },
      {
        result: ONE_PIXEL_PNG_BASE64,
      },
      { providerExecuted: true },
    ),
    responseMessages: buildResponseMessages(
      'Here is your panda image.',
      'image_generation',
      'tool-image-1',
      { prompt: 'pls create a panda image' },
      {
        result: ONE_PIXEL_PNG_BASE64,
      },
      { providerExecuted: true },
    ),
    expectsPreviewParts: true,
  },
  {
    toolName: 'web_search',
    toolCallId: 'tool-web-search-1',
    assistantText: 'I checked the latest sources.',
    input: { query: 'current usd brl exchange rate' },
    output: {
      results: [
        {
          title: 'Wise exchange rate',
          url: 'https://wise.com',
          snippet: 'USD to BRL market rate overview.',
        },
      ],
    },
    streamedParts: buildStreamedToolParts(
      'web_search',
      'tool-web-search-1',
      'I checked the latest sources.',
      { query: 'current usd brl exchange rate' },
      {
        results: [
          {
            title: 'Wise exchange rate',
            url: 'https://wise.com',
            snippet: 'USD to BRL market rate overview.',
          },
        ],
      },
      { providerExecuted: true },
    ),
    responseMessages: buildResponseMessages(
      'I checked the latest sources.',
      'web_search',
      'tool-web-search-1',
      { query: 'current usd brl exchange rate' },
      {
        results: [
          {
            title: 'Wise exchange rate',
            url: 'https://wise.com',
            snippet: 'USD to BRL market rate overview.',
          },
        ],
      },
      { providerExecuted: true },
    ),
    expectsPreviewParts: false,
  },
  {
    toolName: 'google_search',
    toolCallId: 'tool-google-search-1',
    assistantText: 'I found fresh Google results.',
    input: { query: 'best coffee near paulista avenue' },
    output: {
      results: [
        {
          title: 'Top cafes on Paulista Avenue',
          url: 'https://example.com/cafes',
          snippet: 'A local roundup of popular cafes.',
        },
      ],
    },
    streamedParts: buildStreamedToolParts(
      'google_search',
      'tool-google-search-1',
      'I found fresh Google results.',
      { query: 'best coffee near paulista avenue' },
      {
        results: [
          {
            title: 'Top cafes on Paulista Avenue',
            url: 'https://example.com/cafes',
            snippet: 'A local roundup of popular cafes.',
          },
        ],
      },
      { providerExecuted: true },
    ),
    responseMessages: buildResponseMessages(
      'I found fresh Google results.',
      'google_search',
      'tool-google-search-1',
      { query: 'best coffee near paulista avenue' },
      {
        results: [
          {
            title: 'Top cafes on Paulista Avenue',
            url: 'https://example.com/cafes',
            snippet: 'A local roundup of popular cafes.',
          },
        ],
      },
      { providerExecuted: true },
    ),
    expectsPreviewParts: false,
  },
  {
    toolName: 'file_search',
    toolCallId: 'tool-file-search-1',
    assistantText: 'I found matching files in the knowledge base.',
    input: { query: 'quarterly revenue summary' },
    output: {
      matches: [
        {
          filename: 'revenue-summary-q1.pdf',
          snippet: 'Revenue increased 14% year over year.',
        },
      ],
    },
    streamedParts: buildStreamedToolParts(
      'file_search',
      'tool-file-search-1',
      'I found matching files in the knowledge base.',
      { query: 'quarterly revenue summary' },
      {
        matches: [
          {
            filename: 'revenue-summary-q1.pdf',
            snippet: 'Revenue increased 14% year over year.',
          },
        ],
      },
    ),
    responseMessages: buildResponseMessages(
      'I found matching files in the knowledge base.',
      'file_search',
      'tool-file-search-1',
      { query: 'quarterly revenue summary' },
      {
        matches: [
          {
            filename: 'revenue-summary-q1.pdf',
            snippet: 'Revenue increased 14% year over year.',
          },
        ],
      },
    ),
    expectsPreviewParts: false,
  },
  {
    toolName: 'web_fetch',
    toolCallId: 'tool-web-fetch-1',
    assistantText: 'I fetched the target page.',
    input: { url: 'https://example.com/docs/ai-sdk' },
    output: {
      url: 'https://example.com/docs/ai-sdk',
      summary: 'The page explains the AI SDK stream protocol.',
    },
    streamedParts: buildStreamedToolParts(
      'web_fetch',
      'tool-web-fetch-1',
      'I fetched the target page.',
      { url: 'https://example.com/docs/ai-sdk' },
      {
        url: 'https://example.com/docs/ai-sdk',
        summary: 'The page explains the AI SDK stream protocol.',
      },
      { providerExecuted: true },
    ),
    responseMessages: buildResponseMessages(
      'I fetched the target page.',
      'web_fetch',
      'tool-web-fetch-1',
      { url: 'https://example.com/docs/ai-sdk' },
      {
        url: 'https://example.com/docs/ai-sdk',
        summary: 'The page explains the AI SDK stream protocol.',
      },
      { providerExecuted: true },
    ),
    expectsPreviewParts: false,
  },
  {
    toolName: 'url_context',
    toolCallId: 'tool-url-context-1',
    assistantText: 'I gathered context from the URL.',
    input: { url: 'https://example.com/docs/ai-sdk' },
    output: {
      url: 'https://example.com/docs/ai-sdk',
      summary: 'The document covers message streams and tool execution.',
    },
    streamedParts: buildStreamedToolParts(
      'url_context',
      'tool-url-context-1',
      'I gathered context from the URL.',
      { url: 'https://example.com/docs/ai-sdk' },
      {
        url: 'https://example.com/docs/ai-sdk',
        summary: 'The document covers message streams and tool execution.',
      },
      { providerExecuted: true },
    ),
    responseMessages: buildResponseMessages(
      'I gathered context from the URL.',
      'url_context',
      'tool-url-context-1',
      { url: 'https://example.com/docs/ai-sdk' },
      {
        url: 'https://example.com/docs/ai-sdk',
        summary: 'The document covers message streams and tool execution.',
      },
      { providerExecuted: true },
    ),
    expectsPreviewParts: false,
  },
  {
    toolName: 'google_maps',
    toolCallId: 'tool-google-maps-1',
    assistantText: 'I found a matching place in Maps.',
    input: { location: 'Sao Paulo Museum of Art' },
    output: {
      places: [
        {
          name: 'Sao Paulo Museum of Art',
          formattedAddress: 'Avenida Paulista, 1578 - Bela Vista, Sao Paulo',
        },
      ],
    },
    streamedParts: buildStreamedToolParts(
      'google_maps',
      'tool-google-maps-1',
      'I found a matching place in Maps.',
      { location: 'Sao Paulo Museum of Art' },
      {
        places: [
          {
            name: 'Sao Paulo Museum of Art',
            formattedAddress: 'Avenida Paulista, 1578 - Bela Vista, Sao Paulo',
          },
        ],
      },
      { providerExecuted: true },
    ),
    responseMessages: buildResponseMessages(
      'I found a matching place in Maps.',
      'google_maps',
      'tool-google-maps-1',
      { location: 'Sao Paulo Museum of Art' },
      {
        places: [
          {
            name: 'Sao Paulo Museum of Art',
            formattedAddress: 'Avenida Paulista, 1578 - Bela Vista, Sao Paulo',
          },
        ],
      },
      { providerExecuted: true },
    ),
    expectsPreviewParts: false,
  },
  {
    toolName: 'code_execution',
    toolCallId: 'tool-code-execution-1',
    assistantText: 'I ran the calculation.',
    input: { code: 'print(6 * 7)' },
    output: {
      stdout: '42',
      message: 'Execution finished successfully.',
    },
    streamedParts: buildStreamedToolParts(
      'code_execution',
      'tool-code-execution-1',
      'I ran the calculation.',
      { code: 'print(6 * 7)' },
      {
        stdout: '42',
        message: 'Execution finished successfully.',
      },
      { providerExecuted: true },
    ),
    responseMessages: buildResponseMessages(
      'I ran the calculation.',
      'code_execution',
      'tool-code-execution-1',
      { code: 'print(6 * 7)' },
      {
        stdout: '42',
        message: 'Execution finished successfully.',
      },
      { providerExecuted: true },
    ),
    expectsPreviewParts: false,
  },
  {
    toolName: 'code_interpreter',
    toolCallId: 'tool-code-interpreter-1',
    assistantText: 'I analyzed the data in the interpreter.',
    input: { code: 'import pandas as pd\nprint(df.describe())' },
    output: {
      stdout: 'count  3',
      artifacts: [{ name: 'summary.csv' }],
    },
    streamedParts: buildStreamedToolParts(
      'code_interpreter',
      'tool-code-interpreter-1',
      'I analyzed the data in the interpreter.',
      { code: 'import pandas as pd\nprint(df.describe())' },
      {
        stdout: 'count  3',
        artifacts: [{ name: 'summary.csv' }],
      },
      { providerExecuted: true },
    ),
    responseMessages: buildResponseMessages(
      'I analyzed the data in the interpreter.',
      'code_interpreter',
      'tool-code-interpreter-1',
      { code: 'import pandas as pd\nprint(df.describe())' },
      {
        stdout: 'count  3',
        artifacts: [{ name: 'summary.csv' }],
      },
      { providerExecuted: true },
    ),
    expectsPreviewParts: false,
  },
] as const;

export function getHostedToolFixture(toolName: HostedNativeToolName): HostedToolFixture {
  const fixture = HOSTED_TOOL_FIXTURES.find((entry) => entry.toolName === toolName);
  if (!fixture) {
    throw new Error(`Missing hosted tool fixture: ${toolName}`);
  }

  return fixture;
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
