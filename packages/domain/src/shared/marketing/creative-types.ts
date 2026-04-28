import type { CreativeType, VideoPlatform, VideoFormat } from './constants.js';

export interface CreativeBase {
  id: string;
  productId: string;
  personaId?: string;
  campaignId?: string;
  type: CreativeType;
  name: string;
  status: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TextCreative extends CreativeBase {
  type: 'text';
  content: string;
  tone?: string;
  callToAction?: string;
}

export interface ImageCreative extends CreativeBase {
  type: 'image';
  imageUrl?: string;
  prompt?: string;
  style?: string;
  imageWidth?: number;
  imageHeight?: number;
  isSvg?: boolean;
}

export interface VideoCreative extends CreativeBase {
  type: 'video';
  platform: VideoPlatform;
  format: VideoFormat;
  duration?: number;
  storyId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
}

export interface LandingPageCreative extends CreativeBase {
  type: 'landing_page';
  htmlContent?: string;
  metaTitle?: string;
  metaDescription?: string;
}

export type Creative = TextCreative | ImageCreative | VideoCreative | LandingPageCreative;
