import type { Voxsim as DomainVoxsim } from 'domain/shared';
import type { VoxsimTransport } from '$lib/adapters/voxsim/VoxsimTransport';

type ResolvedArenaEntry = DomainVoxsim.ResolvedArenaEntry;
type AgentSummary = DomainVoxsim.AgentSummary;
type TrainingRunSummary = DomainVoxsim.TrainingRunSummary;

export interface VoxsimLabPageDeps {
	transport: VoxsimTransport;
}

export function createVoxsimLabPageModel({ transport }: VoxsimLabPageDeps) {
	let arenas = $state<ResolvedArenaEntry[]>([]);
	let agents = $state<AgentSummary[]>([]);
	let runs = $state<TrainingRunSummary[]>([]);
	let isLoading = $state(false);
	let errorMessage = $state<string | null>(null);

	async function bootstrap() {
		if (isLoading) return;
		isLoading = true;
		errorMessage = null;
		try {
			const [arenaList, agentList, runList] = await Promise.all([
				transport.listArenas(),
				transport.listAgents(),
				transport.listTrainingRuns()
			]);
			arenas = arenaList;
			agents = agentList;
			runs = runList;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to load voxsim catalog';
		} finally {
			isLoading = false;
		}
	}

	async function refreshAgents() {
		try {
			agents = await transport.listAgents();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to refresh agents';
		}
	}

	async function refreshArenas() {
		try {
			arenas = await transport.listArenas();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to refresh arenas';
		}
	}

	async function refreshRuns() {
		try {
			runs = await transport.listTrainingRuns();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to refresh runs';
		}
	}

	return {
		get arenas() {
			return arenas;
		},
		get agents() {
			return agents;
		},
		get runs() {
			return runs;
		},
		get isLoading() {
			return isLoading;
		},
		get errorMessage() {
			return errorMessage;
		},
		bootstrap,
		refreshAgents,
		refreshArenas,
		refreshRuns
	};
}

export type VoxsimLabPageModel = ReturnType<typeof createVoxsimLabPageModel>;
