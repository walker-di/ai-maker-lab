import type { CanvasTemplate, CreateCanvasTemplateDto, UpdateCanvasTemplateDto } from '../../shared/marketing/index.js';
import type { ICanvasTemplateRepository } from './ports.js';

export class CanvasTemplateService {
  constructor(private readonly templates: ICanvasTemplateRepository) {}

  async list(): Promise<CanvasTemplate[]> {
    return this.templates.findAll();
  }

  async get(id: string): Promise<CanvasTemplate | null> {
    return this.templates.findById(id);
  }

  async create(dto: CreateCanvasTemplateDto): Promise<CanvasTemplate> {
    return this.templates.create(dto);
  }

  async update(id: string, dto: UpdateCanvasTemplateDto): Promise<CanvasTemplate> {
    return this.templates.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    return this.templates.delete(id);
  }

  async duplicate(id: string, newName?: string): Promise<CanvasTemplate> {
    const original = await this.templates.findById(id);
    if (!original) throw new Error(`CanvasTemplate not found: ${id}`);
    return this.templates.create({
      name: newName ?? `${original.name} (copy)`,
      description: original.description,
      aspectRatio: original.aspectRatio,
      canvasData: original.canvasData,
      previewUrl: original.previewUrl,
      tags: [...original.tags],
      isDefault: false,
    });
  }
}

export function createCanvasTemplateService(
  repos: { templates: ICanvasTemplateRepository },
): CanvasTemplateService {
  return new CanvasTemplateService(repos.templates);
}
