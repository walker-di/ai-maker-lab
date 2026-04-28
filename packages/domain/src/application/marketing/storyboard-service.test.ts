import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Surreal } from 'surrealdb';
import { createDbConnection } from '../../infrastructure/database/client.js';
import { SurrealDbAdapter } from '../../infrastructure/database/SurrealDbAdapter.js';
import { SurrealStoryRepository } from '../../infrastructure/database/marketing/SurrealStoryRepository.js';
import { SurrealSceneRepository } from '../../infrastructure/database/marketing/SurrealSceneRepository.js';
import { SurrealClipRepository } from '../../infrastructure/database/marketing/SurrealClipRepository.js';
import type { IMarketingTextGenerationGateway } from './ports.js';
import { StoryboardService } from './story-service.js';

function createAiGateway(): IMarketingTextGenerationGateway {
  return {
    async generateProductDescription() { return 'description'; },
    async generatePersonas() { return []; },
    async generateCreativeText() { return 'creative'; },
    async generateMarketingStrategy() { return 'strategy'; },
    async generateStoryboard() { return { scenes: [], clips: [] }; },
    async generateStoryboardFrames(prompt, count) {
      return Array.from({ length: count }, (_, index) => ({
        title: `Frame ${index + 1}`,
        narration: `${prompt} narration ${index + 1}`,
        mainImagePrompt: `${prompt} main ${index + 1}`,
        backgroundImagePrompt: `${prompt} background ${index + 1}`,
        bgmPrompt: `${prompt} bgm ${index + 1}`,
      }));
    },
    async regenerateStoryboardPrompt({ promptType, frame }) {
      return `${promptType} regenerated for ${frame.orderIndex}`;
    },
  };
}

describe('StoryboardService', () => {
  let db: Surreal;
  let service: StoryboardService;

  beforeEach(async () => {
    db = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    const adapter = new SurrealDbAdapter(db);
    service = new StoryboardService(
      new SurrealStoryRepository(adapter),
      new SurrealSceneRepository(adapter),
      new SurrealClipRepository(adapter),
      createAiGateway(),
    );
  });

  afterEach(async () => {
    await db.close();
  });

  test('creates, lists, and opens a storyboard', async () => {
    const created = await service.create({ name: 'Product launch', description: 'Storyboard' });
    expect(created.name).toBe('Product launch');
    expect(created.frameCount).toBe(0);
    expect(await service.list()).toHaveLength(1);
    const detail = await service.get(created.id);
    expect(detail?.frames).toEqual([]);
  });

  test('generates, edits, reorders, and deletes frames', async () => {
    const storyboard = await service.create({ name: 'Launch' });
    let detail = await service.generateFrames(storyboard.id, { prompt: 'Rocket', count: 2 });
    expect(detail.frames.map((frame) => frame.orderIndex)).toEqual([0, 1]);
    expect(detail.frames[0].mainImagePrompt).toBe('Rocket main 1');

    const firstFrame = detail.frames[0];
    const updated = await service.updateFrameText(storyboard.id, firstFrame.id, {
      narration: 'Updated narration',
      backgroundImagePrompt: 'Updated background',
    });
    expect(updated.narration).toBe('Updated narration');
    expect(updated.backgroundImagePrompt).toBe('Updated background');

    detail = await service.reorderFrame(storyboard.id, firstFrame.id, { direction: 'down' });
    expect(detail.frames[1].id).toBe(firstFrame.id);

    detail = await service.deleteFrame(storyboard.id, firstFrame.id);
    expect(detail.frames).toHaveLength(1);
    expect(detail.frames[0].orderIndex).toBe(0);
  });

  test('regenerates prompts and updates transition metadata', async () => {
    const storyboard = await service.create({ name: 'Launch' });
    const detail = await service.generateFrames(storyboard.id, { prompt: 'Rocket', count: 1 });
    const frame = detail.frames[0];

    const regenerated = await service.regeneratePrompt(storyboard.id, frame.id, 'mainImage');
    expect(regenerated.prompt).toBe('mainImage regenerated for 0');
    expect(regenerated.frame.mainImagePrompt).toBe('mainImage regenerated for 0');

    const transitioned = await service.updateTransition(storyboard.id, frame.id, {
      transitionTypeAfter: 'fade',
      transitionDurationMs: 1500,
    });
    expect(transitioned.transitionTypeAfter).toBe('fade');
    expect(transitioned.transitionDurationMs).toBe(1500);
  });
});
