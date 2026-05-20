import type {
  CustomerJourneyMap,
  CreateCustomerJourneyMapDto,
  UpdateCustomerJourneyMapDto,
} from '../../shared/marketing/index.js';
import type { ICustomerJourneyMapRepository, IProductRepository } from './ports.js';

export class CustomerJourneyMapService {
  constructor(
    private readonly journeyMaps: ICustomerJourneyMapRepository,
    private readonly products: IProductRepository,
  ) {}

  async list(): Promise<CustomerJourneyMap[]> {
    return this.journeyMaps.findAll();
  }

  async listByProduct(productId: string): Promise<CustomerJourneyMap[]> {
    return this.journeyMaps.findByProductId(productId);
  }

  async get(id: string): Promise<CustomerJourneyMap | null> {
    return this.journeyMaps.findById(id);
  }

  async create(dto: CreateCustomerJourneyMapDto): Promise<CustomerJourneyMap> {
    await this.assertProductExists(dto.productId);
    return this.journeyMaps.create(dto);
  }

  async update(id: string, dto: UpdateCustomerJourneyMapDto): Promise<CustomerJourneyMap> {
    if (dto.productId) await this.assertProductExists(dto.productId);
    return this.journeyMaps.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    return this.journeyMaps.delete(id);
  }

  private async assertProductExists(productId: string): Promise<void> {
    const product = await this.products.findById(productId);
    if (!product) throw new Error(`Product not found: ${productId}`);
  }
}

export function createCustomerJourneyMapService(repos: {
  customerJourneyMaps: ICustomerJourneyMapRepository;
  products: IProductRepository;
}): CustomerJourneyMapService {
  return new CustomerJourneyMapService(repos.customerJourneyMaps, repos.products);
}
