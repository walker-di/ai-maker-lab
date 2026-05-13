import { describe, expect, test } from 'bun:test';
import { extractQuestionLootKind, shouldDeferQuestionLoot } from './factory.js';

describe('factory question loot', () => {
  test('extractQuestionLootKind reads params.contains', () => {
    expect(
      extractQuestionLootKind({
        kind: 'coin',
        tile: { col: 0, row: 0 },
        params: { contains: 'mushroom' },
      }),
    ).toBe('mushroom');
  });

  test('extractQuestionLootKind falls back to item kind', () => {
    expect(
      extractQuestionLootKind({
        kind: 'flower',
        tile: { col: 0, row: 0 },
      }),
    ).toBe('flower');
  });

  test('shouldDeferQuestionLoot is true for loot on a question tile', () => {
    expect(
      shouldDeferQuestionLoot(
        { kind: 'mushroom', tile: { col: 1, row: 1 } },
        'question',
      ),
    ).toBe(true);
  });

  test('shouldDeferQuestionLoot is false off a question tile', () => {
    expect(
      shouldDeferQuestionLoot(
        { kind: 'mushroom', tile: { col: 1, row: 1 } },
        'ground',
      ),
    ).toBe(false);
  });
});
