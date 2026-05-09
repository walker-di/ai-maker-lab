import { describe, expect, test } from 'bun:test';
import { clamp } from './clamp.js';

describe('clamp', () => {
  test('returns the value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  test('returns min when value is below min', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(-100, -10, 10)).toBe(-10);
  });

  test('returns max when value is above max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(100, -10, 10)).toBe(10);
  });

  test('handles equal boundaries', () => {
    expect(clamp(5, 5, 5)).toBe(5);
    expect(clamp(3, 5, 5)).toBe(5);
    expect(clamp(7, 5, 5)).toBe(5);
  });

  test('handles negative ranges', () => {
    expect(clamp(-5, -10, -3)).toBe(-5);
    expect(clamp(-15, -10, -3)).toBe(-10);
    expect(clamp(0, -10, -3)).toBe(-3);
  });
});
