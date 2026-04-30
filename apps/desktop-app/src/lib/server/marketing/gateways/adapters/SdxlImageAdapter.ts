import type { ImageGenerationRequest, ReplicateImageModelAdapter } from './types.js';
import { aspectRatioToDimensions } from './aspect-ratio-utils.js';

export class SdxlImageAdapter implements ReplicateImageModelAdapter {
  readonly supportedModels = ['stability-ai/sdxl'];

  buildInput(request: ImageGenerationRequest): Record<string, unknown> {
    const { width, height } = aspectRatioToDimensions(request.aspectRatio);
    return {
      prompt: request.prompt,
      width,
      height,
      num_outputs: 1,
      scheduler: 'K_EULER',
      num_inference_steps: 25,
      guidance_scale: 7.5,
      refine: 'expert_ensemble_refiner',
      high_noise_frac: 0.8,
    };
  }
}
