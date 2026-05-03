import type { BestLapKey, LapResult } from '../../../shared/racing/index.js';
import type { ILapResultRepository } from '../RacingTransport.js';

export interface GetBestLapUseCase {
  execute(key: BestLapKey): Promise<LapResult | null>;
}

export function createGetBestLap(laps: ILapResultRepository): GetBestLapUseCase {
  return {
    async execute(key) {
      return laps.bestFor(key);
    },
  };
}
