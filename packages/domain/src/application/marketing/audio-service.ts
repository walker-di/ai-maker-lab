import type { BgmFile, Scene, CreateBgmFileDto, UpdateBgmFileDto } from '../../shared/marketing/index.js';
import type {
  IBgmRepository,
  INarrationAudioGateway,
  IBackgroundMusicGateway,
} from './ports.js';

export class NarrationService {
  constructor(private readonly narration: INarrationAudioGateway) {}

  async synthesize(
    text: string,
    voice: string,
    lang?: string,
  ): Promise<{ audioUrl: string; durationMs: number }> {
    return this.narration.synthesize(text, voice, lang);
  }

  async listVoices(): Promise<{ id: string; name: string; lang: string; gender: string }[]> {
    return this.narration.listVoices();
  }
}

export class BgmService {
  constructor(
    private readonly bgmFiles: IBgmRepository,
    private readonly bgmGateway: IBackgroundMusicGateway,
  ) {}

  async list(): Promise<BgmFile[]> {
    return this.bgmFiles.findAll();
  }

  async get(id: string): Promise<BgmFile | null> {
    return this.bgmFiles.findById(id);
  }

  async create(dto: CreateBgmFileDto): Promise<BgmFile> {
    return this.bgmFiles.create(dto);
  }

  async update(id: string, dto: UpdateBgmFileDto): Promise<BgmFile> {
    return this.bgmFiles.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    return this.bgmFiles.delete(id);
  }

  async generate(prompt: string, durationSecs: number, name: string): Promise<BgmFile> {
    const { url } = await this.bgmGateway.generate(prompt, durationSecs);
    return this.bgmFiles.create({
      name,
      fileUrl: url,
      duration: durationSecs,
      tags: [],
    });
  }

  async suggestForScene(scene: Scene): Promise<string> {
    const description = scene.description ?? 'marketing video scene';
    return `upbeat background music for: ${description}`;
  }

  async autoSelectForScene(scene: Scene): Promise<BgmFile | null> {
    const all = await this.bgmFiles.findAll();
    return all[0] ?? null;
  }
}

export function createNarrationService(
  gateways: { narration: INarrationAudioGateway },
): NarrationService {
  return new NarrationService(gateways.narration);
}

export function createBgmService(
  repos: { bgmFiles: IBgmRepository },
  gateways: { bgm: IBackgroundMusicGateway },
): BgmService {
  return new BgmService(repos.bgmFiles, gateways.bgm);
}
