import type { SetupValues } from '../../../shared/racing/index.js';
import { clampSetup } from '../../../shared/racing/index.js';
import type { IRacingSetupRepository } from '../RacingTransport.js';

export interface GetSetupUseCase {
  execute(userId: string): Promise<SetupValues | null>;
}

export interface SetSetupUseCase {
  execute(userId: string, setup: SetupValues): Promise<void>;
}

export function createGetSetup(repo: IRacingSetupRepository): GetSetupUseCase {
  return {
    async execute(userId) {
      const v = await repo.get(userId);
      return v ? clampSetup(v) : null;
    },
  };
}

export function createSetSetup(repo: IRacingSetupRepository): SetSetupUseCase {
  return {
    async execute(userId, setup) {
      await repo.set(userId, clampSetup(setup));
    },
  };
}
