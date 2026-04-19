import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { json } from '@sveltejs/kit';
import { Voxsim } from 'domain/application';
import {
	getDb,
	SurrealAgentRepository,
	SurrealDbAdapter,
	SurrealEpisodeRepository,
	SurrealNeatGenomeRepository,
	SurrealNeatInnovationLogRepository,
	SurrealNeatSpeciesRepository,
	SurrealReplayRepository,
	SurrealTrainingRunRepository,
	SurrealUserArenaRepository,
	SurrealWeightCheckpointRepository,
	Voxsim as VoxsimInfra
} from 'domain/infrastructure';

export interface VoxsimServices {
	arenaCatalog: Voxsim.ArenaCatalogService;
	agentCatalog: Voxsim.AgentCatalogService;
	users: Voxsim.IUserArenaRepository;
	builtIns: Voxsim.IBuiltInArenaSource;
	agents: Voxsim.IAgentRepository;
	runs: Voxsim.ITrainingRunRepository;
	episodes: Voxsim.IEpisodeRepository;
	replays: Voxsim.IReplayRepository;
	checkpoints: Voxsim.IWeightCheckpointRepository;
	neatGenomes: Voxsim.INeatGenomeRepository;
	neatSpecies: Voxsim.INeatSpeciesRepository;
	neatInnovations: Voxsim.INeatInnovationLogRepository;
}

let voxsimServicesPromise: Promise<VoxsimServices> | undefined;

function getDefaultEmbeddedHost(): string {
	const dbPath = fileURLToPath(
		new URL('../../../../../data/surrealdb/desktop-web.db', import.meta.url)
	);
	mkdirSync(dirname(dbPath), { recursive: true });
	return `surrealkv://${dbPath}`;
}

export function getVoxsimServices(): Promise<VoxsimServices> {
	if (!voxsimServicesPromise) {
		voxsimServicesPromise = (async () => {
			const surreal = await getDb({
				host: process.env.SURREAL_HOST ?? getDefaultEmbeddedHost(),
				namespace: process.env.SURREAL_NS ?? 'app',
				database: process.env.SURREAL_DB ?? 'desktop',
				username: process.env.SURREAL_USER,
				password: process.env.SURREAL_PASS,
				token: process.env.SURREAL_TOKEN
			});
			const adapter = new SurrealDbAdapter(surreal);
			const builtIns = new VoxsimInfra.JsonBuiltInArenaSource();
			const users = new SurrealUserArenaRepository(adapter);
			const agents = new SurrealAgentRepository(adapter);
			return {
				arenaCatalog: new Voxsim.ArenaCatalogService({ builtIns, users }),
				agentCatalog: new Voxsim.AgentCatalogService({ agents }),
				users,
				builtIns,
				agents,
				runs: new SurrealTrainingRunRepository(adapter),
				episodes: new SurrealEpisodeRepository(adapter),
				replays: new SurrealReplayRepository(adapter),
				checkpoints: new SurrealWeightCheckpointRepository(adapter),
				neatGenomes: new SurrealNeatGenomeRepository(adapter),
				neatSpecies: new SurrealNeatSpeciesRepository(adapter),
				neatInnovations: new SurrealNeatInnovationLogRepository(adapter)
			} satisfies VoxsimServices;
		})();
	}
	return voxsimServicesPromise;
}

export function toVoxsimErrorResponse(error: unknown) {
	const message = error instanceof Error ? error.message : 'Unknown error';
	const lower = message.toLowerCase();
	const status = lower.includes('not found')
		? 404
		: lower.includes('invalid') || lower.includes('cannot') || lower.includes('validation')
			? 400
			: 500;
	return json({ error: message }, { status });
}
