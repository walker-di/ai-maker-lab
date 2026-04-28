import type { CampaignStatus } from './constants.js';

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  productId?: string;
  status: CampaignStatus;
  startDate?: string;
  endDate?: string;
  goals?: string;
  budget?: number;
  targetRegions: string[];
  createdAt: string;
  updatedAt: string;
}
