import type { Generation } from '../../../shared/rts/index.js';
import { MapGenerator, type GenerateResult } from '../generation/MapGenerator.js';

export interface GenerateMapUseCase {
  execute(params: Generation.MapGenerationParams): Promise<GenerateResult>;
}

export function createGenerateMap(generator: MapGenerator = new MapGenerator()): GenerateMapUseCase {
  return {
    async execute(params) {
      return generator.generate(params);
    },
  };
}
