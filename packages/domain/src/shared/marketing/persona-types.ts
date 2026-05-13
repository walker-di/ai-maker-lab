import type { AgeRange, Gender } from './constants.js';

export interface Persona {
  id: string;
  productId: string;
  name: string;
  age?: number;
  ageRange: AgeRange;
  gender: Gender;
  occupation?: string;
  income?: string;
  interests: string[];
  painPoints: string[];
  motivations: string[];
  description?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}
