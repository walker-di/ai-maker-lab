import type { Product, CreateProductDto, UpdateProductDto } from '../../shared/marketing/index.js';
import type { IProductRepository, IPersonaRepository, IMarketingTextGenerationGateway } from './ports.js';

export class ProductService {
  constructor(
    private readonly products: IProductRepository,
    private readonly personas: IPersonaRepository,
    private readonly ai: IMarketingTextGenerationGateway,
  ) {}

  async list(): Promise<Product[]> {
    return this.products.findAll();
  }

  async get(id: string): Promise<Product | null> {
    return this.products.findById(id);
  }

  async create(dto: CreateProductDto): Promise<Product> {
    return this.products.create(dto);
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    return this.products.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    const children = await this.personas.findByProductId(id);
    if (children.length > 0) {
      throw new Error('Cannot delete product with existing personas');
    }
    return this.products.delete(id);
  }

  async generateFromName(name: string): Promise<Product> {
    const description = await this.ai.generateProductDescription({ name });
    return this.products.create({
      name,
      description,
      features: [],
      benefits: [],
    });
  }
}

export function createProductService(
  repos: { products: IProductRepository; personas: IPersonaRepository },
  gateways: { ai: IMarketingTextGenerationGateway },
): ProductService {
  return new ProductService(repos.products, repos.personas, gateways.ai);
}
