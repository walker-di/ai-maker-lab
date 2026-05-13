export interface Product {
  id: string;
  name: string;
  description?: string;
  targetAudience?: string;
  features: string[];
  benefits: string[];
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}
