import { describe, expect, test } from 'bun:test';
import { mapPartsToHostedToolEvents } from './hosted-tool-events-mapper.js';

describe('mapPartsToHostedToolEvents', () => {
  test('emits started + finished events for a completed hosted web search call', () => {
    const events = mapPartsToHostedToolEvents({
      runId: 'run-1',
      messageId: 'msg-1',
      provider: 'openai',
      emittedAt: '2026-04-16T00:00:00.000Z',
      parts: [
        {
          type: 'tool-web_search',
          toolCallId: 'call-1',
          toolName: 'web_search',
          state: 'output-available',
          input: { query: 'svelte runes' },
          output: {
            sources: [
              {
                url: 'https://example.com/runes',
                title: 'Runes intro',
                snippet: 'A short overview of Svelte runes.',
              },
            ],
          },
        },
      ],
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      kind: 'tool-call-started',
      runId: 'run-1',
      messageId: 'msg-1',
      toolCallId: 'call-1',
      toolName: 'web_search',
      provider: 'openai',
      sequence: 0,
      inputSummary: expect.stringContaining('svelte runes'),
    });
    expect(events[1]).toMatchObject({
      kind: 'tool-call-finished',
      sequence: 1,
      sources: [
        {
          url: 'https://example.com/runes',
          title: 'Runes intro',
        },
      ],
    });
  });

  test('emits started + failed events when the tool call errored', () => {
    const events = mapPartsToHostedToolEvents({
      runId: 'run-2',
      provider: 'anthropic',
      parts: [
        {
          type: 'tool-web_fetch',
          toolCallId: 'call-2',
          toolName: 'web_fetch',
          state: 'error',
          input: { url: 'https://example.com' },
          errorText: 'remote returned 503',
        },
      ],
    });

    expect(events.map((e) => e.kind)).toEqual(['tool-call-started', 'tool-call-failed']);
    expect(events[1]).toMatchObject({
      kind: 'tool-call-failed',
      errorSummary: 'remote returned 503',
    });
  });

  test('does not duplicate started events when the same tool call appears twice', () => {
    const events = mapPartsToHostedToolEvents({
      runId: 'run-3',
      provider: 'google',
      parts: [
        {
          type: 'tool-call',
          toolCallId: 'call-3',
          toolName: 'google_search',
          state: 'input-available',
          input: { query: 'foo' },
        },
        {
          type: 'tool-result',
          toolCallId: 'call-3',
          toolName: 'google_search',
          state: 'output-available',
          output: { sources: [] },
        },
      ],
    });

    const startedEvents = events.filter((e) => e.kind === 'tool-call-started');
    expect(startedEvents).toHaveLength(1);
    expect(events.map((e) => e.kind)).toEqual(['tool-call-started', 'tool-call-finished']);
  });
});
