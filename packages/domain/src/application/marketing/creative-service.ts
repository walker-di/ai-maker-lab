import type {
  Creative,
  TextCreative,
  ImageCreative,
  Product,
  Persona,
  CreativeType,
  CreateCreativeDto,
  UpdateCreativeDto,
} from '../../shared/marketing/index.js';
import type {
  ICreativeRepository,
  IMarketingTextGenerationGateway,
  IMarketingImageGenerationGateway,
  IMarketingAssetStorage,
} from './ports.js';

export class CreativeService {
  constructor(
    private readonly creatives: ICreativeRepository,
    private readonly ai: IMarketingTextGenerationGateway,
    private readonly imageGen: IMarketingImageGenerationGateway,
    private readonly storage: IMarketingAssetStorage,
  ) {}

  async listByProduct(productId: string): Promise<Creative[]> {
    return this.creatives.findByProductId(productId);
  }

  async get(id: string): Promise<Creative | null> {
    return this.creatives.findById(id);
  }

  async create(dto: CreateCreativeDto): Promise<Creative> {
    return this.creatives.create(dto);
  }

  async update(id: string, dto: UpdateCreativeDto): Promise<Creative> {
    return this.creatives.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    return this.creatives.delete(id);
  }

  async generateText(
    product: Product,
    persona: Persona,
    type: CreativeType,
  ): Promise<TextCreative> {
    const content = await this.ai.generateCreativeText(product, persona, type);
    const creative = await this.creatives.create({
      productId: product.id,
      personaId: persona.id,
      type: 'text',
      name: `${type} for ${persona.name}`,
      status: 'draft',
      tags: [],
    });
    return this.creatives.update(creative.id, { type: 'text' } as UpdateCreativeDto) as Promise<TextCreative>;
  }

  async generateImage(
    creative: ImageCreative,
    prompt: string,
  ): Promise<ImageCreative> {
    const { url } = await this.imageGen.generateImage(prompt, creative.style);
    return this.creatives.update(creative.id, { type: 'image' } as UpdateCreativeDto) as Promise<ImageCreative>;
  }
}

export function createCreativeService(
  repos: { creatives: ICreativeRepository },
  gateways: {
    ai: IMarketingTextGenerationGateway;
    imageGen: IMarketingImageGenerationGateway;
    storage: IMarketingAssetStorage;
  },
): CreativeService {
  return new CreativeService(repos.creatives, gateways.ai, gateways.imageGen, gateways.storage);
}
