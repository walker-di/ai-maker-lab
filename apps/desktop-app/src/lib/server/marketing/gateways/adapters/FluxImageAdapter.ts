import type { ImageGenerationRequest, ReplicateImageModelAdapter } from './types.js';

export class FluxImageAdapter implements ReplicateImageModelAdapter {
  readonly supportedModels = [
    'black-forest-labs/flux-1.1-pro',
    'black-forest-labs/flux-schnell',
    'black-forest-labs/flux-dev',
  ];

  buildInput(request: ImageGenerationRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      aspect_ratio: request.aspectRatio ?? '1:1',
      output_format: 'jpg',
      output_quality: 80,
      safety_tolerance: 2,
      prompt_upsampling: true,
    };
  }
}
