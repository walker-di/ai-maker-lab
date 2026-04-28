import type {
  Story,
  Scene,
  Clip,
  Creative,
  Product,
  AudioSettings,
  CreateStoryDto,
  UpdateStoryDto,
  CreateSceneDto,
  UpdateSceneDto,
  CreateClipDto,
  UpdateClipDto,
  CreateStoryboardDto,
  GenerateStoryboardFramesDto,
  InsertBlankStoryboardFrameDto,
  UpdateStoryboardFrameTextDto,
  GenerateStoryboardFrameAssetDto,
  AttachStoryboardFrameAssetDto,
  ReorderStoryboardFrameDto,
  UpdateStoryboardTransitionDto,
  StoryboardDetail,
  StoryboardFrame,
  StoryboardSummary,
  GeneratedStoryboardFrameDraft,
  StoryboardAssetType,
  StoryboardPromptType,
  StoryboardExportResult,
} from '../../shared/marketing/index.js';
import { STORYBOARD_MAKER_CREATIVE_ID } from '../../shared/marketing/index.js';
import type {
  IStoryRepository,
  ISceneRepository,
  IClipRepository,
  IMarketingTextGenerationGateway,
  INarrationAudioGateway,
  IMarketingImageGenerationGateway,
  IBackgroundMusicGateway,
  IVideoExporter,
} from './ports.js';

export class StoryService {
  constructor(private readonly stories: IStoryRepository) {}

  async listByCreative(creativeId: string): Promise<Story[]> {
    return this.stories.findByCreativeId(creativeId);
  }

  async get(id: string): Promise<Story | null> {
    return this.stories.findById(id);
  }

  async create(dto: CreateStoryDto): Promise<Story> {
    return this.stories.create(dto);
  }

  async update(id: string, dto: UpdateStoryDto): Promise<Story> {
    return this.stories.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    return this.stories.delete(id);
  }

  async updateAudioSettings(id: string, audioSettings: AudioSettings): Promise<Story> {
    return this.stories.update(id, { audioSettings });
  }
}

export class SceneService {
  constructor(private readonly scenes: ISceneRepository) {}

  async listByStory(storyId: string): Promise<Scene[]> {
    return this.scenes.findByStoryId(storyId);
  }

  async get(id: string): Promise<Scene | null> {
    return this.scenes.findById(id);
  }

  async create(dto: CreateSceneDto): Promise<Scene> {
    return this.scenes.create(dto);
  }

  async update(id: string, dto: UpdateSceneDto): Promise<Scene> {
    return this.scenes.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    return this.scenes.delete(id);
  }
}

export class ClipService {
  constructor(
    private readonly clips: IClipRepository,
    private readonly ai: IMarketingTextGenerationGateway,
    private readonly narration: INarrationAudioGateway,
    private readonly imageGen: IMarketingImageGenerationGateway,
  ) {}

  async listByScene(sceneId: string): Promise<Clip[]> {
    return this.clips.findBySceneId(sceneId);
  }

  async get(id: string): Promise<Clip | null> {
    return this.clips.findById(id);
  }

  async create(dto: CreateClipDto): Promise<Clip> {
    return this.clips.create(dto);
  }

  async update(id: string, dto: UpdateClipDto): Promise<Clip> {
    return this.clips.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    return this.clips.delete(id);
  }

  async aiFill(
    clip: Clip,
    voice: string,
    lang?: string,
  ): Promise<Clip> {
    const updates: UpdateClipDto = {};

    if (clip.content && !clip.narrationText) {
      const { audioUrl, durationMs } = await this.narration.synthesize(clip.content, voice, lang);
      updates.narrationAudioUrl = audioUrl;
      updates.durationMs = durationMs;
      updates.narrationText = clip.content;
    }

    if (clip.content && !clip.imageUrl) {
      const { url } = await this.imageGen.generateImage(clip.content);
      updates.imageUrl = url;
    }

    return this.clips.update(clip.id, updates);
  }
}

export class StoryboardService {
  constructor(
    private readonly stories: IStoryRepository,
    private readonly scenes: ISceneRepository,
    private readonly clips: IClipRepository,
    private readonly ai: IMarketingTextGenerationGateway,
    private readonly imageGen?: IMarketingImageGenerationGateway,
    private readonly narration?: INarrationAudioGateway,
    private readonly bgm?: IBackgroundMusicGateway,
    private readonly videoExporter?: IVideoExporter,
  ) {}

  async autoCreateStoryboard(
    product: Product,
    creative: Creative,
  ): Promise<{ story: Story; scenes: Scene[]; clips: Clip[][] }> {
    const { scenes: scenePartials, clips: clipRows } = await this.ai.generateStoryboard(product, creative);

    const story = await this.stories.create({
      creativeId: creative.id,
      title: `${product.name} Storyboard`,
      audioSettings: {},
    });

    const createdScenes: Scene[] = [];
    const createdClipMatrix: Clip[][] = [];

    for (let i = 0; i < scenePartials.length; i++) {
      const sp = scenePartials[i];
      const scene = await this.scenes.create({
        storyId: story.id,
        orderIndex: i,
        description: sp?.description,
        durationMs: sp?.durationMs,
      });
      createdScenes.push(scene);

      const rowClips: Clip[] = [];
      const clipPartials = clipRows[i] ?? [];
      for (let j = 0; j < clipPartials.length; j++) {
        const cp = clipPartials[j];
        const clip = await this.clips.create({
          sceneId: scene.id,
          orderIndex: j,
          type: cp?.type ?? 'text',
          content: cp?.content,
          narrationText: cp?.narrationText,
          durationMs: cp?.durationMs,
        });
        rowClips.push(clip);
      }
      createdClipMatrix.push(rowClips);
    }

    return { story, scenes: createdScenes, clips: createdClipMatrix };
  }

  async list(): Promise<StoryboardSummary[]> {
    const stories = await this.stories.findByCreativeId(STORYBOARD_MAKER_CREATIVE_ID);
    const summaries = await Promise.all(stories.map(async (story) => {
      const scenes = await this.scenes.findByStoryId(story.id);
      return this.toSummary(story, scenes.length);
    }));
    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async create(dto: CreateStoryboardDto): Promise<StoryboardSummary> {
    const story = await this.stories.create({
      creativeId: STORYBOARD_MAKER_CREATIVE_ID,
      title: dto.name,
      description: dto.description,
      audioSettings: {},
    });
    return this.toSummary(story, 0);
  }

  async get(storyboardId: string): Promise<StoryboardDetail | null> {
    const story = await this.stories.findById(storyboardId);
    if (!story || story.creativeId !== STORYBOARD_MAKER_CREATIVE_ID) return null;
    return this.getDetailForStory(story);
  }

  async generateFrames(storyboardId: string, dto: GenerateStoryboardFramesDto): Promise<StoryboardDetail> {
    const story = await this.requireStoryboard(storyboardId);
    const drafts = this.ai.generateStoryboardFrames
      ? await this.ai.generateStoryboardFrames(dto.prompt, dto.count)
      : this.createFallbackDrafts(dto.prompt, dto.count);

    if (drafts.length === 0) throw new Error('Storyboard generation returned no frames.');

    const scenes = await this.scenes.findByStoryId(story.id);
    let nextOrder = scenes.reduce((max, scene) => Math.max(max, scene.orderIndex), -1) + 1;
    for (const draft of drafts) {
      this.assertDraft(draft);
      await this.createFrameFromDraft(story.id, nextOrder++, draft);
    }
    return this.getDetailForStory(story);
  }

  async insertBlankFrame(storyboardId: string, dto: InsertBlankStoryboardFrameDto): Promise<StoryboardDetail> {
    const story = await this.requireStoryboard(storyboardId);
    const frames = await this.listFrames(story.id);
    const afterIndex = dto.afterFrameId
      ? frames.find((frame) => frame.id === dto.afterFrameId)?.orderIndex
      : undefined;
    if (dto.afterFrameId && afterIndex == null) throw new Error('Frame not found.');
    const orderIndex = afterIndex == null ? frames.length : afterIndex + 1;

    for (const frame of frames.filter((frame) => frame.orderIndex >= orderIndex).sort((a, b) => b.orderIndex - a.orderIndex)) {
      await this.scenes.update(frame.sceneId, { orderIndex: frame.orderIndex + 1 });
    }

    await this.createFrameFromDraft(story.id, orderIndex, {
      title: dto.title ?? 'Untitled frame',
      narration: '',
      mainImagePrompt: '',
      backgroundImagePrompt: '',
      bgmPrompt: '',
      durationMs: 5000,
    });
    return this.getDetailForStory(story);
  }

  async updateFrameText(storyboardId: string, frameId: string, dto: UpdateStoryboardFrameTextDto): Promise<StoryboardFrame> {
    await this.requireStoryboard(storyboardId);
    const frame = await this.requireFrame(storyboardId, frameId);
    if (dto.title !== undefined || dto.backgroundImagePrompt !== undefined || dto.bgmPrompt !== undefined) {
      await this.scenes.update(frame.sceneId, {
        description: dto.title ?? frame.title,
        backgroundImagePrompt: dto.backgroundImagePrompt ?? frame.backgroundImagePrompt,
        bgmPrompt: dto.bgmPrompt ?? frame.bgmPrompt,
      });
    }
    if (dto.narration !== undefined || dto.mainImagePrompt !== undefined) {
      await this.clips.update(frame.clipId!, {
        content: dto.narration ?? frame.narration,
        narrationText: dto.narration ?? frame.narration,
        mainImagePrompt: dto.mainImagePrompt ?? frame.mainImagePrompt,
      });
    }
    return this.requireFrame(storyboardId, frameId);
  }

  async regeneratePrompt(storyboardId: string, frameId: string, promptType: StoryboardPromptType): Promise<{ prompt: string; frame: StoryboardFrame }> {
    const storyboard = await this.requireDetail(storyboardId);
    const frame = storyboard.frames.find((candidate) => candidate.id === frameId);
    if (!frame) throw new Error('Frame not found.');
    const prompt = this.ai.regenerateStoryboardPrompt
      ? await this.ai.regenerateStoryboardPrompt({ promptType, frame, storyboard })
      : this.fallbackPrompt(promptType, frame, storyboard);

    const updates: UpdateStoryboardFrameTextDto =
      promptType === 'narration' ? { narration: prompt } :
      promptType === 'mainImage' ? { mainImagePrompt: prompt } :
      promptType === 'backgroundImage' ? { backgroundImagePrompt: prompt } :
      { bgmPrompt: prompt };
    const updated = await this.updateFrameText(storyboardId, frameId, updates);
    return { prompt, frame: updated };
  }

  async generateFrameAsset(storyboardId: string, frameId: string, dto: GenerateStoryboardFrameAssetDto): Promise<StoryboardFrame> {
    const frame = await this.requireFrame(storyboardId, frameId);
    const url = await this.generateAssetUrl(frame, dto.assetType);
    return this.attachFrameAsset(storyboardId, frameId, { assetType: dto.assetType, url });
  }

  async attachFrameAsset(storyboardId: string, frameId: string, dto: AttachStoryboardFrameAssetDto): Promise<StoryboardFrame> {
    const frame = await this.requireFrame(storyboardId, frameId);
    if (dto.assetType === 'mainImage') {
      await this.clips.update(frame.clipId!, { imageUrl: dto.url });
    } else if (dto.assetType === 'backgroundImage') {
      await this.scenes.update(frame.sceneId, { backgroundImageUrl: dto.url });
    } else if (dto.assetType === 'narrationAudio') {
      await this.clips.update(frame.clipId!, { narrationAudioUrl: dto.url });
    } else {
      await this.scenes.update(frame.sceneId, { bgmUrl: dto.url });
    }
    return this.requireFrame(storyboardId, frameId);
  }

  async reorderFrame(storyboardId: string, frameId: string, dto: ReorderStoryboardFrameDto): Promise<StoryboardDetail> {
    const story = await this.requireStoryboard(storyboardId);
    const frames = await this.listFrames(story.id);
    const index = frames.findIndex((frame) => frame.id === frameId);
    if (index === -1) throw new Error('Frame not found.');
    const targetIndex = dto.direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= frames.length) return this.getDetailForStory(story);

    const current = frames[index];
    const target = frames[targetIndex];
    await this.scenes.update(current.sceneId, { orderIndex: target.orderIndex });
    await this.scenes.update(target.sceneId, { orderIndex: current.orderIndex });
    return this.getDetailForStory(story);
  }

  async deleteFrame(storyboardId: string, frameId: string): Promise<StoryboardDetail> {
    const story = await this.requireStoryboard(storyboardId);
    const frame = await this.requireFrame(story.id, frameId);
    if (frame.clipId) await this.clips.delete(frame.clipId);
    await this.scenes.delete(frame.sceneId);
    await this.compactFrameOrder(story.id);
    return this.getDetailForStory(story);
  }

  async updateTransition(storyboardId: string, frameId: string, dto: UpdateStoryboardTransitionDto): Promise<StoryboardFrame> {
    const frame = await this.requireFrame(storyboardId, frameId);
    await this.scenes.update(frame.sceneId, {
      transitionTypeAfter: dto.transitionTypeAfter,
      transitionDurationMs: dto.transitionDurationMs,
    });
    return this.requireFrame(storyboardId, frameId);
  }

  async exportUnifiedVideo(storyboardId: string, outputPath: string): Promise<StoryboardExportResult> {
    if (!this.videoExporter) throw new Error('Storyboard video exporter is not configured.');
    const detail = await this.requireDetail(storyboardId);
    if (detail.frames.length === 0) throw new Error('Storyboard must have at least one frame before export.');
    const missing = detail.frames.find((frame) => !frame.mainImageUrl || !frame.narrationAudioUrl);
    if (missing) throw new Error('Storyboard frames require main image and narration audio before export.');

    const clipVideos = [] as { videoPath: string; durationMs: number }[];
    for (const frame of detail.frames) {
      const durationMs = frame.durationMs ?? 5000;
      const result = await this.videoExporter.exportClip({
        imageUrl: frame.mainImageUrl,
        narrationUrl: frame.narrationAudioUrl,
        durationMs,
        outputPath: `${outputPath}-${frame.orderIndex}.mp4`,
      });
      clipVideos.push({ videoPath: result.videoPath, durationMs });
    }

    const exported = await this.videoExporter.exportStory({
      clips: clipVideos,
      bgmUrl: detail.frames.find((frame) => frame.bgmUrl)?.bgmUrl,
      outputPath,
    });
    return exported;
  }

  private toSummary(story: Story, frameCount: number): StoryboardSummary {
    return {
      id: story.id,
      name: story.title,
      description: story.description,
      frameCount,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    };
  }

  private async getDetailForStory(story: Story): Promise<StoryboardDetail> {
    const frames = await this.listFrames(story.id);
    return { ...this.toSummary(story, frames.length), frames };
  }

  private async requireDetail(storyboardId: string): Promise<StoryboardDetail> {
    const detail = await this.get(storyboardId);
    if (!detail) throw new Error('Storyboard not found.');
    return detail;
  }

  private async requireStoryboard(storyboardId: string): Promise<Story> {
    const story = await this.stories.findById(storyboardId);
    if (!story || story.creativeId !== STORYBOARD_MAKER_CREATIVE_ID) throw new Error('Storyboard not found.');
    return story;
  }

  private async requireFrame(storyboardId: string, frameId: string): Promise<StoryboardFrame> {
    const frames = await this.listFrames(storyboardId);
    const frame = frames.find((candidate) => candidate.id === frameId || candidate.sceneId === frameId || candidate.clipId === frameId);
    if (!frame) throw new Error('Frame not found.');
    return frame;
  }

  private async listFrames(storyId: string): Promise<StoryboardFrame[]> {
    const scenes = await this.scenes.findByStoryId(storyId);
    const rows = await Promise.all(scenes.map(async (scene) => {
      const [clip] = await this.clips.findBySceneId(scene.id);
      return this.toFrame(scene, clip);
    }));
    return rows.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  private toFrame(scene: Scene, clip?: Clip): StoryboardFrame {
    return {
      id: scene.id,
      storyboardId: scene.storyId,
      sceneId: scene.id,
      clipId: clip?.id,
      orderIndex: scene.orderIndex,
      title: scene.description,
      narration: clip?.narrationText ?? clip?.content ?? '',
      mainImagePrompt: clip?.mainImagePrompt ?? clip?.content ?? '',
      backgroundImagePrompt: scene.backgroundImagePrompt ?? '',
      bgmPrompt: scene.bgmPrompt ?? '',
      mainImageUrl: clip?.imageUrl,
      backgroundImageUrl: scene.backgroundImageUrl,
      bgmUrl: scene.bgmUrl,
      narrationAudioUrl: clip?.narrationAudioUrl,
      durationMs: scene.durationMs ?? clip?.durationMs,
      transitionTypeAfter: scene.transitionTypeAfter ?? 'none',
      transitionDurationMs: scene.transitionDurationMs ?? 1000,
      createdAt: scene.createdAt,
      updatedAt: scene.updatedAt,
    };
  }

  private async createFrameFromDraft(storyId: string, orderIndex: number, draft: GeneratedStoryboardFrameDraft): Promise<StoryboardFrame> {
    const scene = await this.scenes.create({
      storyId,
      orderIndex,
      description: draft.title,
      durationMs: draft.durationMs ?? 5000,
      backgroundImagePrompt: draft.backgroundImagePrompt,
      bgmPrompt: draft.bgmPrompt,
      transitionTypeAfter: 'none',
      transitionDurationMs: 1000,
    });
    const clip = await this.clips.create({
      sceneId: scene.id,
      orderIndex: 0,
      type: 'image',
      content: draft.narration,
      narrationText: draft.narration,
      durationMs: draft.durationMs ?? 5000,
      mainImagePrompt: draft.mainImagePrompt,
    });
    return this.toFrame(scene, clip);
  }

  private async compactFrameOrder(storyId: string): Promise<void> {
    const frames = await this.listFrames(storyId);
    for (let i = 0; i < frames.length; i++) {
      if (frames[i].orderIndex !== i) await this.scenes.update(frames[i].sceneId, { orderIndex: i });
    }
  }

  private createFallbackDrafts(prompt: string, count: number): GeneratedStoryboardFrameDraft[] {
    return Array.from({ length: count }, (_, index) => ({
      title: `Frame ${index + 1}`,
      narration: `${prompt} — beat ${index + 1}.`,
      mainImagePrompt: `Main subject image for: ${prompt}, beat ${index + 1}`,
      backgroundImagePrompt: `Cinematic background for: ${prompt}, beat ${index + 1}`,
      bgmPrompt: `Background music for: ${prompt}, beat ${index + 1}`,
      durationMs: 5000,
    }));
  }

  private assertDraft(draft: GeneratedStoryboardFrameDraft): void {
    if (!draft.narration || !draft.mainImagePrompt || !draft.backgroundImagePrompt || !draft.bgmPrompt) {
      throw new Error('Generated storyboard frame is invalid.');
    }
  }

  private async generateAssetUrl(frame: StoryboardFrame, assetType: StoryboardAssetType): Promise<string> {
    if (assetType === 'mainImage') {
      if (!this.imageGen) throw new Error('Image generation is not configured.');
      return (await this.imageGen.generateImage(frame.mainImagePrompt, undefined, { aspectRatio: '1:1' })).url;
    }
    if (assetType === 'backgroundImage') {
      if (!this.imageGen) throw new Error('Image generation is not configured.');
      return (await this.imageGen.generateImage(frame.backgroundImagePrompt, undefined, { aspectRatio: '16:9' })).url;
    }
    if (assetType === 'narrationAudio') {
      if (!this.narration) throw new Error('Narration generation is not configured.');
      return (await this.narration.synthesize(frame.narration, 'en-US-JennyNeural')).audioUrl;
    }
    if (!this.bgm) throw new Error('BGM generation is not configured.');
    return (await this.bgm.generate(frame.bgmPrompt, Math.max(1, Math.round((frame.durationMs ?? 5000) / 1000)))).url;
  }

  private fallbackPrompt(promptType: StoryboardPromptType, frame: StoryboardFrame, storyboard: StoryboardDetail): string {
    const base = `${storyboard.name} frame ${frame.orderIndex + 1}: ${frame.title ?? frame.narration}`;
    if (promptType === 'narration') return `Concise narration for ${base}`;
    if (promptType === 'mainImage') return `Detailed main subject image prompt for ${base}`;
    if (promptType === 'backgroundImage') return `Cinematic background image prompt for ${base}`;
    return `Background music prompt for ${base}`;
  }
}

export function createStoryService(
  repos: { stories: IStoryRepository },
): StoryService {
  return new StoryService(repos.stories);
}

export function createSceneService(
  repos: { scenes: ISceneRepository },
): SceneService {
  return new SceneService(repos.scenes);
}

export function createClipService(
  repos: { clips: IClipRepository },
  gateways: {
    ai: IMarketingTextGenerationGateway;
    narration: INarrationAudioGateway;
    imageGen: IMarketingImageGenerationGateway;
  },
): ClipService {
  return new ClipService(repos.clips, gateways.ai, gateways.narration, gateways.imageGen);
}

export function createStoryboardService(
  repos: {
    stories: IStoryRepository;
    scenes: ISceneRepository;
    clips: IClipRepository;
  },
  gateways: {
    ai: IMarketingTextGenerationGateway;
    imageGen?: IMarketingImageGenerationGateway;
    narration?: INarrationAudioGateway;
    bgm?: IBackgroundMusicGateway;
    videoExporter?: IVideoExporter;
  },
): StoryboardService {
  return new StoryboardService(
    repos.stories,
    repos.scenes,
    repos.clips,
    gateways.ai,
    gateways.imageGen,
    gateways.narration,
    gateways.bgm,
    gateways.videoExporter,
  );
}
