import { json } from '@sveltejs/kit';
import { Racing } from 'domain/application';
import {
	BuiltInRacingCatalogSource,
	getDb,
	SurrealDbAdapter,
	SurrealLapResultRepository,
	SurrealRacingSessionRepository,
	SurrealRacingSetupRepository
} from 'domain/infrastructure';
import { getAppDbConfig } from './db-config.js';

interface RacingServiceBundle {
	sessions: SurrealRacingSessionRepository;
	laps: SurrealLapResultRepository;
	setups: SurrealRacingSetupRepository;
	useCases: {
		startSession: Racing.StartSessionUseCase;
		recordLap: Racing.RecordLapUseCase;
		getBestLap: Racing.GetBestLapUseCase;
		getSetup: Racing.GetSetupUseCase;
		setSetup: Racing.SetSetupUseCase;
	};
}

const catalog = new BuiltInRacingCatalogSource();
let bundlePromise: Promise<RacingServiceBundle> | undefined;

export function getRacingCatalog(): BuiltInRacingCatalogSource {
	return catalog;
}

export function getRacingServices(): Promise<RacingServiceBundle> {
	if (!bundlePromise) {
		bundlePromise = (async () => {
			try {
				const surreal = await getDb(getAppDbConfig());
				const adapter = new SurrealDbAdapter(surreal);
				const sessions = new SurrealRacingSessionRepository(adapter);
				const laps = new SurrealLapResultRepository(adapter);
				const setups = new SurrealRacingSetupRepository(adapter);
				const useCases = {
					startSession: Racing.createStartSession(sessions),
					recordLap: Racing.createRecordLap(laps),
					getBestLap: Racing.createGetBestLap(laps),
					getSetup: Racing.createGetSetup(setups),
					setSetup: Racing.createSetSetup(setups)
				};
				return { sessions, laps, setups, useCases };
			} catch (error) {
				bundlePromise = undefined;
				throw error;
			}
		})();
	}
	return bundlePromise;
}

export function toRacingErrorResponse(error: unknown) {
	const message = error instanceof Error ? error.message : 'Unknown error';
	const lowered = message.toLowerCase();
	const status = lowered.includes('not found')
		? 404
		: lowered.includes('invalid') || lowered.includes('cannot')
			? 400
			: 500;
	return json({ error: message }, { status });
}
