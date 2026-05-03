import type { RacingSession } from '../../../shared/racing/index.js';
import type {
  IRacingSessionRepository,
  StartSessionInput,
} from '../RacingTransport.js';

export interface StartSessionUseCase {
  execute(input: StartSessionInput): Promise<RacingSession>;
}

export function createStartSession(
  sessions: IRacingSessionRepository,
): StartSessionUseCase {
  return {
    async execute(input) {
      const id = input.sessionId ?? `session-${input.trackId}-${input.vehicleId}-${Date.now()}`;
      const session: RacingSession = {
        id,
        trackId: input.trackId,
        vehicleId: input.vehicleId,
        startedAt: new Date().toISOString(),
      };
      return sessions.create(session);
    },
  };
}
