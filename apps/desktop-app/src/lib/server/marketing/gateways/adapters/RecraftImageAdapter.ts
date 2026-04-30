import type { ImageGenerationRequest, ReplicateImageModelAdapter } from './types.js';

export class RecraftImageAdapter implements ReplicateImageModelAdapter {
  readonly supportedModels = ['recraft-ai/recraft-v3'];

  buildInput(request: ImageGenerationRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      size: this.aspectRatioToSize(request.aspectRatio),
      style: 'realistic_image',
    };
  }

  private aspectRatioToSize(ratio?: string): string {
    switch (ratio) {
      case '16:9': return '1365x1024';
      case '9:16': return '1024x1365';
      case '4:5': return '1024x1280';
      case '5:4': return '1280x1024';
      case '1:1':
      default: return '1024x1024';
    }
  }
}
