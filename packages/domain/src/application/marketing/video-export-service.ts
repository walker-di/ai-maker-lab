import type { IClipRepository, IStoryRepository, ISceneRepository, IVideoExporter } from './ports.js';

export class VideoExportService {
  constructor(
    private readonly clips: IClipRepository,
    private readonly scenes: ISceneRepository,
    private readonly stories: IStoryRepository,
    private readonly exporter: IVideoExporter,
  ) {}

  async exportClip(
    clipId: string,
    outputPath: string,
  ): Promise<{ videoPath: string }> {
    const clip = await this.clips.findById(clipId);
    if (!clip) throw new Error(`Clip not found: ${clipId}`);
    return this.exporter.exportClip({
      imageUrl: clip.imageUrl,
      narrationUrl: clip.narrationAudioUrl,
      durationMs: clip.durationMs ?? 5000,
      outputPath,
    });
  }

  async exportStory(
    storyId: string,
    outputPath: string,
  ): Promise<{ videoPath: string; durationMs: number }> {
    const story = await this.stories.findById(storyId);
    if (!story) throw new Error(`Story not found: ${storyId}`);

    const scenes = await this.scenes.findByStoryId(storyId);
    const clipEntries: { videoPath: string; durationMs: number }[] = [];

    for (const scene of scenes) {
      const sceneClips = await this.clips.findBySceneId(scene.id);
      for (const clip of sceneClips) {
        const result = await this.exporter.exportClip({
          imageUrl: clip.imageUrl,
          narrationUrl: clip.narrationAudioUrl,
          durationMs: clip.durationMs ?? 5000,
          outputPath: `${outputPath}/clip-${clip.id}.mp4`,
        });
        clipEntries.push({ videoPath: result.videoPath, durationMs: clip.durationMs ?? 5000 });
      }
    }

    const bgmUrl = story.audioSettings.bgmId ?? undefined;
    return this.exporter.exportStory({ clips: clipEntries, bgmUrl, outputPath });
  }
}

export function createVideoExportService(
  repos: {
    clips: IClipRepository;
    scenes: ISceneRepository;
    stories: IStoryRepository;
  },
  gateways: { videoExporter: IVideoExporter },
): VideoExportService {
  return new VideoExportService(repos.clips, repos.scenes, repos.stories, gateways.videoExporter);
}
