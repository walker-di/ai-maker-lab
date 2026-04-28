import type { Strategy, Product, Campaign, CreateStrategyDto, UpdateStrategyDto } from '../../shared/marketing/index.js';
import type { IStrategyRepository, IMarketingTextGenerationGateway } from './ports.js';

export class StrategyService {
  constructor(
    private readonly strategies: IStrategyRepository,
    private readonly ai: IMarketingTextGenerationGateway,
  ) {}

  async list(): Promise<Strategy[]> {
    return this.strategies.findAll();
  }

  async listByProduct(productId: string): Promise<Strategy[]> {
    return this.strategies.findByProductId(productId);
  }

  async get(id: string): Promise<Strategy | null> {
    return this.strategies.findById(id);
  }

  async create(dto: CreateStrategyDto): Promise<Strategy> {
    return this.strategies.create(dto);
  }

  async update(id: string, dto: UpdateStrategyDto): Promise<Strategy> {
    return this.strategies.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    return this.strategies.delete(id);
  }

  async generate(product: Product, campaign?: Campaign): Promise<Strategy> {
    const content = await this.ai.generateMarketingStrategy(product, campaign);
    return this.strategies.create({
      productId: product.id,
      campaignId: campaign?.id,
      content,
      generatedBy: 'ai',
    });
  }
}

export function createStrategyService(
  repos: { strategies: IStrategyRepository },
  gateways: { ai: IMarketingTextGenerationGateway },
): StrategyService {
  return new StrategyService(repos.strategies, gateways.ai);
}
