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
