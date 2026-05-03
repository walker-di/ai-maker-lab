import type { Racing } from 'domain/shared';

type LapResult = Racing.LapResult;
type RacingSession = Racing.RacingSession;
type SectorTime = Racing.SectorTime;
type SetupValues = Racing.SetupValues;
type BestLapKey = Racing.BestLapKey;
type VehiclePreset = Racing.VehiclePreset;
type TrackPreset = Racing.TrackPreset;

export type RacingRuntimeMode = 'desktop' | 'web';

export interface StartSessionInput {
	trackId: string;
	vehicleId: string;
	sessionId?: string;
}

export interface RecordLapInput {
	sessionId: string;
	trackId: string;
	vehicleId: string;
	lapMs: number;
	sectors?: ReadonlyArray<SectorTime>;
	finishedAt?: string;
}

export interface RacingTransport {
	listVehicles(): Promise<VehiclePreset[]>;
	listTracks(): Promise<TrackPreset[]>;
	startSession(input: StartSessionInput): Promise<RacingSession>;
	recordLap(input: RecordLapInput): Promise<LapResult>;
	getBestLap(key: BestLapKey): Promise<LapResult | null>;
	getSetup(userId: string): Promise<SetupValues | null>;
	setSetup(userId: string, setup: SetupValues): Promise<void>;
}
