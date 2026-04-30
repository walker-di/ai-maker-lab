export interface ImageGenerationRequest {
  prompt: string;
  aspectRatio?: string;
}

export interface ReplicateImageModelAdapter {
  readonly supportedModels: string[];
  buildInput(request: ImageGenerationRequest): Record<string, unknown>;
}
