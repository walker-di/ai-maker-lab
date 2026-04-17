import { describe, expect, test } from 'bun:test';
import { ONE_PIXEL_PNG_BASE64 } from '../../application/chat/__test-helpers__/test-fixtures.js';
import { resolveToolInvocationOutput } from './tool-invocation-output.js';

describe('resolveToolInvocationOutput', () => {
  test('uses rich result when output is empty', () => {
    expect(
      resolveToolInvocationOutput({}, {
        images: [{ image_url: 'https://cdn.openai.com/generated/panda' }],
      }),
    ).toEqual({
      images: [{ image_url: 'https://cdn.openai.com/generated/panda' }],
    });
  });

  test('parses stringified output.result payloads into readable structured output', () => {
    expect(
      resolveToolInvocationOutput({
        result: JSON.stringify({
          images: [{ image_url: 'https://cdn.openai.com/generated/panda' }],
        }),
      }, undefined),
    ).toEqual({
      result: {
        images: [{ image_url: 'https://cdn.openai.com/generated/panda' }],
      },
    });
  });

  test('prefers a richer sibling result over shallow string output', () => {
    expect(
      resolveToolInvocationOutput('completed', {
        images: [{ image_url: 'https://cdn.openai.com/generated/panda' }],
      }),
    ).toEqual({
      images: [{ image_url: 'https://cdn.openai.com/generated/panda' }],
    });
  });

  test('replaces shallow output.result strings with richer structured sibling result', () => {
    expect(
      resolveToolInvocationOutput(
        {
          status: 'completed',
          result: 'generated successfully',
        },
        {
          images: [{ image_url: 'https://cdn.openai.com/generated/panda' }],
        },
      ),
    ).toEqual({
      status: 'completed',
      result: {
        images: [{ image_url: 'https://cdn.openai.com/generated/panda' }],
      },
    });
  });

  test('keeps error strings and no-result fallbacks intact', () => {
    expect(resolveToolInvocationOutput({ error: 'division by zero' }, undefined)).toEqual({
      error: 'division by zero',
    });
    expect(resolveToolInvocationOutput('tool failed', undefined)).toBe('tool failed');
  });

  test('preserves persisted naked base64 image results for downstream preview helpers', () => {
    expect(
      resolveToolInvocationOutput(
        {
          result: ONE_PIXEL_PNG_BASE64,
        },
        undefined,
      ),
    ).toEqual({
      result: ONE_PIXEL_PNG_BASE64,
    });
  });
});
