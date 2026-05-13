import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { z } from 'zod';

let generateObjectCalls: unknown[] = [];
let generateTextCalls: unknown[] = [];

mock.module('ai', () => ({
  generateObject: async (input: unknown) => {
    generateObjectCalls.push(input);
    return {
      object: {
        frames: [{
          title: 'Opening',
          narration: 'Open on the product.',
          mainImagePrompt: 'Hero product image',
          backgroundImagePrompt: 'Studio background',
          bgmPrompt: 'Upbeat music',
          durationMs: 5000,
        }],
      },
    };
  },
  generateText: async (input: unknown) => {
    generateTextCalls.push(input);
    return { text: 'Regenerated prompt' };
  },
}));

mock.module('@ai-sdk/anthropic', () => ({ createAnthropic: () => (model: string) => ({ provider: 'anthropic', model }) }));
mock.module('@ai-sdk/openai', () => ({ createOpenAI: () => (model: string) => ({ provider: 'openai', model }) }));
mock.module('@ai-sdk/google', () => ({ createGoogleGenerativeAI: () => (model: string) => ({ provider: 'google', model }) }));

describe('AiSdkMarketingTextGateway storyboard methods', () => {
  beforeEach(() => {
    generateObjectCalls = [];
    generateTextCalls = [];
  });

  test('generates structured storyboard frames with the requested count', async () => {
    const { AiSdkMarketingTextGateway } = await import('./AiSdkMarketingTextGateway.js');
    const gateway = new AiSdkMarketingTextGateway({ provider: 'anthropic', model: 'test-model', apiKey: 'test' });

    const frames = await gateway.generateStoryboardFrames('Launch a product', 1);

    expect(frames).toHaveLength(1);
    expect(frames[0].mainImagePrompt).toBe('Hero product image');

    const call = generateObjectCalls[0] as { schema: z.ZodTypeAny; prompt: string };
    expect(call.prompt).toContain('Launch a product');

    const missingTitle = call.schema.safeParse({
      frames: [{
        narration: 'Narration',
        mainImagePrompt: 'Main prompt',
        backgroundImagePrompt: 'Background prompt',
        bgmPrompt: 'BGM prompt',
        durationMs: 4000,
      }],
    });
    expect(missingTitle.success).toBe(false);
    if (!missingTitle.success) {
      expect(missingTitle.error.issues.some((issue) => issue.path.join('.') === 'frames.0.title')).toBe(true);
    }

    const missingDurationMs = call.schema.safeParse({
      frames: [{
        title: 'Frame title',
        narration: 'Narration',
        mainImagePrompt: 'Main prompt',
        backgroundImagePrompt: 'Background prompt',
        bgmPrompt: 'BGM prompt',
      }],
    });
    expect(missingDurationMs.success).toBe(false);
    if (!missingDurationMs.success) {
      expect(missingDurationMs.error.issues.some((issue) => issue.path.join('.') === 'frames.0.durationMs')).toBe(true);
    }
  });

  test('regenerates a prompt with ordered storyboard context', async () => {
    const { AiSdkMarketingTextGateway } = await import('./AiSdkMarketingTextGateway.js');
    const gateway = new AiSdkMarketingTextGateway({ provider: 'anthropic', model: 'test-model', apiKey: 'test' });

    const prompt = await gateway.regenerateStoryboardPrompt({
      promptType: 'mainImage',
      frame: {
        id: 'frame-1', storyboardId: 'story-1', sceneId: 'scene-1', orderIndex: 0,
        title: 'Opening', narration: 'Open', mainImagePrompt: 'main', backgroundImagePrompt: 'background', bgmPrompt: 'music',
        transitionTypeAfter: 'none', transitionDurationMs: 1000, createdAt: 'now', updatedAt: 'now',
      },
      storyboard: {
        id: 'story-1', name: 'Storyboard', frameCount: 1, createdAt: 'now', updatedAt: 'now',
        frames: [{
          id: 'frame-1', storyboardId: 'story-1', sceneId: 'scene-1', orderIndex: 0,
          title: 'Opening', narration: 'Open', mainImagePrompt: 'main', backgroundImagePrompt: 'background', bgmPrompt: 'music',
          transitionTypeAfter: 'none', transitionDurationMs: 1000, createdAt: 'now', updatedAt: 'now',
        }],
      },
    });

    expect(prompt).toBe('Regenerated prompt');
    expect(JSON.stringify(generateTextCalls[0])).toContain('Full ordered context');
  });
});
