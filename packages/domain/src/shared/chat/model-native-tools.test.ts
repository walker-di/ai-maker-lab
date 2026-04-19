import { describe, expect, test } from 'bun:test';
import { isHostedNativeToolName } from './model-native-tools.js';

const ALL_VALID_NAMES = [
  'google_search',
  'file_search',
  'url_context',
  'google_maps',
  'code_execution',
  'web_search',
  'web_fetch',
  'image_generation',
  'code_interpreter',
] as const;

describe('isHostedNativeToolName', () => {
  for (const name of ALL_VALID_NAMES) {
    test(`returns true for '${name}'`, () => {
      expect(isHostedNativeToolName(name)).toBe(true);
    });
  }

  test('returns false for empty string', () => {
    expect(isHostedNativeToolName('')).toBe(false);
  });

  test('returns false for unknown tool name', () => {
    expect(isHostedNativeToolName('calculator')).toBe(false);
  });

  test('returns false for partial match', () => {
    expect(isHostedNativeToolName('google')).toBe(false);
    expect(isHostedNativeToolName('search')).toBe(false);
  });

  test('returns false for wrong casing', () => {
    expect(isHostedNativeToolName('Google_Search')).toBe(false);
    expect(isHostedNativeToolName('WEB_SEARCH')).toBe(false);
  });

  test('returns false for name with extra whitespace', () => {
    expect(isHostedNativeToolName(' google_search')).toBe(false);
    expect(isHostedNativeToolName('google_search ')).toBe(false);
  });
});
