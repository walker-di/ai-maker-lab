import type { ReplicateImageModelAdapter } from './types.js';
import { FluxImageAdapter } from './FluxImageAdapter.js';
import { SdxlImageAdapter } from './SdxlImageAdapter.js';
import { RecraftImageAdapter } from './RecraftImageAdapter.js';

export type { ImageGenerationRequest, ReplicateImageModelAdapter } from './types.js';
export { FluxImageAdapter } from './FluxImageAdapter.js';
export { SdxlImageAdapter } from './SdxlImageAdapter.js';
export { RecraftImageAdapter } from './RecraftImageAdapter.js';
export { aspectRatioToDimensions } from './aspect-ratio-utils.js';

const adapters: ReplicateImageModelAdapter[] = [
  new FluxImageAdapter(),
  new SdxlImageAdapter(),
  new RecraftImageAdapter(),
];

export function getAdapterForModel(modelId: string): ReplicateImageModelAdapter {
  const adapter = adapters.find((a) => a.supportedModels.some((m) => modelId.includes(m)));
  if (!adapter) {
    return new FluxImageAdapter();
  }
  return adapter;
}
