import type { LapResult } from '../../../shared/racing/index.js';
import type { ILapResultRepository, RecordLapInput } from '../RacingTransport.js';

export interface RecordLapUseCase {
  execute(input: RecordLapInput): Promise<LapResult>;
}

export function createRecordLap(laps: ILapResultRepository): RecordLapUseCase {
  return {
    async execute(input) {
      if (!Number.isFinite(input.lapMs) || input.lapMs <= 0) {
        throw new Error(`Invalid lap time: ${input.lapMs}`);
      }
      const result: LapResult = {
        id: `lap-${input.sessionId}-${Date.now()}`,
        sessionId: input.sessionId,
        trackId: input.trackId,
        vehicleId: input.vehicleId,
        lapMs: input.lapMs,
        sectors: input.sectors ?? [],
        finishedAt: input.finishedAt ?? new Date().toISOString(),
      };
      return laps.record(result);
    },
  };
}
