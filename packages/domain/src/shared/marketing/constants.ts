export const CreativeType = {
  text: 'text',
  image: 'image',
  video: 'video',
  landing_page: 'landing_page',
} as const;
export type CreativeType = (typeof CreativeType)[keyof typeof CreativeType];

export const VideoPlatform = {
  youtube: 'youtube',
  instagram: 'instagram',
  tiktok: 'tiktok',
  twitter: 'twitter',
  facebook: 'facebook',
  line: 'line',
} as const;
export type VideoPlatform = (typeof VideoPlatform)[keyof typeof VideoPlatform];

export const VideoFormat = {
  '16:9': '16:9',
  '9:16': '9:16',
  '1:1': '1:1',
  '4:5': '4:5',
} as const;
export type VideoFormat = (typeof VideoFormat)[keyof typeof VideoFormat];

export const VideoEmotion = {
  happy: 'happy',
  sad: 'sad',
  excited: 'excited',
  calm: 'calm',
  angry: 'angry',
  fearful: 'fearful',
  surprised: 'surprised',
  disgusted: 'disgusted',
} as const;
export type VideoEmotion = (typeof VideoEmotion)[keyof typeof VideoEmotion];

export const CampaignStatus = {
  draft: 'draft',
  active: 'active',
  paused: 'paused',
  completed: 'completed',
} as const;
export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

export const AgeRange = {
  '18-24': '18-24',
  '25-34': '25-34',
  '35-44': '35-44',
  '45-54': '45-54',
  '55-64': '55-64',
  '65+': '65+',
} as const;
export type AgeRange = (typeof AgeRange)[keyof typeof AgeRange];

export const Gender = {
  male: 'male',
  female: 'female',
  non_binary: 'non_binary',
  all: 'all',
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const CanvasAspectRatio = {
  '16:9': '16:9',
  '9:16': '9:16',
  '1:1': '1:1',
  '4:5': '4:5',
  custom: 'custom',
} as const;
export type CanvasAspectRatio = (typeof CanvasAspectRatio)[keyof typeof CanvasAspectRatio];

export const AppealFeature = {
  quality: 'quality',
  price: 'price',
  convenience: 'convenience',
  innovation: 'innovation',
  trust: 'trust',
  sustainability: 'sustainability',
  performance: 'performance',
  design: 'design',
  social_proof: 'social_proof',
  exclusivity: 'exclusivity',
} as const;
export type AppealFeature = (typeof AppealFeature)[keyof typeof AppealFeature];
