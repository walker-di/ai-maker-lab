import type { CanvasAspectRatio } from './constants.js';

export interface CanvasTemplate {
  id: string;
  name: string;
  description?: string;
  aspectRatio: CanvasAspectRatio;
  canvasData: string;
  previewUrl?: string;
  tags: string[];
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}
