import type { Campaign, CreateCampaignDto, UpdateCampaignDto } from '../../shared/marketing/index.js';
import type { ICampaignRepository } from './ports.js';

export class CampaignService {
  constructor(private readonly campaigns: ICampaignRepository) {}

  async list(): Promise<Campaign[]> {
    return this.campaigns.findAll();
  }

  async listByProduct(productId: string): Promise<Campaign[]> {
    return this.campaigns.findByProductId(productId);
  }

  async get(id: string): Promise<Campaign | null> {
    return this.campaigns.findById(id);
  }

  async create(dto: CreateCampaignDto): Promise<Campaign> {
    return this.campaigns.create(dto);
  }

  async update(id: string, dto: UpdateCampaignDto): Promise<Campaign> {
    return this.campaigns.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    return this.campaigns.delete(id);
  }
}

export function createCampaignService(
  repos: { campaigns: ICampaignRepository },
): CampaignService {
  return new CampaignService(repos.campaigns);
}
