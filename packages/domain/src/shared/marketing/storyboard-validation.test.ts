import { describe, expect, test } from 'bun:test';
import {
  CreateStoryboardDtoSchema,
  GenerateStoryboardFramesDtoSchema,
  GeneratedStoryboardFrameDraftSchema,
  UpdateStoryboardTransitionDtoSchema,
} from './validation.js';


describe('storyboard validation', () => {
  test('requires storyboard names and generation prompts', () => {
    expect(CreateStoryboardDtoSchema.safeParse({ name: 'Launch video' }).success).toBe(true);
    expect(CreateStoryboardDtoSchema.safeParse({ name: '' }).success).toBe(false);
    expect(GenerateStoryboardFramesDtoSchema.safeParse({ prompt: 'A rocket launch', count: 3 }).success).toBe(true);
    expect(GenerateStoryboardFramesDtoSchema.safeParse({ prompt: '', count: 3 }).success).toBe(false);
  });

  test('coerces string count to number for HTTP boundary safety', () => {
    const parsed = GenerateStoryboardFramesDtoSchema.parse({ prompt: 'A story', count: '3' });
    expect(parsed).toEqual({ prompt: 'A story', count: 3 });
  });

  test('rejects NaN and non-numeric count', () => {
    expect(GenerateStoryboardFramesDtoSchema.safeParse({ prompt: 'A story', count: 'abc' }).success).toBe(false);
    expect(GenerateStoryboardFramesDtoSchema.safeParse({ prompt: 'A story', count: NaN }).success).toBe(false);
  });

  test('uses default count when omitted', () => {
    const parsed = GenerateStoryboardFramesDtoSchema.parse({ prompt: 'A story' });
    expect(parsed.count).toBe(3);
  });

  test('requires generated frame prompts', () => {
    expect(GeneratedStoryboardFrameDraftSchema.safeParse({
      narration: 'Open on the product.',
      mainImagePrompt: 'Hero product image',
      backgroundImagePrompt: 'Studio background',
      bgmPrompt: 'Upbeat electronic music',
    }).success).toBe(true);

    expect(GeneratedStoryboardFrameDraftSchema.safeParse({
      narration: 'Missing image prompts',
      bgmPrompt: 'Music',
    }).success).toBe(false);
  });

  test('validates transition defaults and duration', () => {
    expect(UpdateStoryboardTransitionDtoSchema.parse({ transitionTypeAfter: 'fade' })).toEqual({
      transitionTypeAfter: 'fade',
      transitionDurationMs: 1000,
    });
    expect(UpdateStoryboardTransitionDtoSchema.safeParse({ transitionTypeAfter: 'explode' }).success).toBe(false);
    expect(UpdateStoryboardTransitionDtoSchema.safeParse({ transitionTypeAfter: 'fade', transitionDurationMs: -1 }).success).toBe(false);
  });
});
