import type { Voxsim as DomainVoxsim } from 'domain/shared';
import type {
	ReplayDetail,
	VoxsimTransport,
	WeightCheckpointDetail
} from '$lib/adapters/voxsim/VoxsimTransport';

type EpisodeSummary = DomainVoxsim.EpisodeSummary;
type TrainingRunSummary = DomainVoxsim.TrainingRunSummary;

export interface VoxsimReplayPageDeps {
	transport: VoxsimTransport;
	runId: string;
}

export function createVoxsimReplayPageModel({ transport, runId }: VoxsimReplayPageDeps) {
	let run = $state<TrainingRunSummary | null>(null);
	let episodes = $state<EpisodeSummary[]>([]);
	let selectedEpisodeId = $state<string | null>(null);
	let replay = $state<ReplayDetail | null>(null);
	let checkpoints = $state<WeightCheckpointDetail[]>([]);
	let isLoading = $state(false);
	let errorMessage = $state<string | null>(null);

	async function bootstrap() {
		isLoading = true;
		errorMessage = null;
		try {
			const [runs, episodeList, checkpointList] = await Promise.all([
				transport.listTrainingRuns(),
				transport.listEpisodes({ runId }),
				transport.listCheckpoints({ runId })
			]);
			run = runs.find((r) => r.id === runId) ?? null;
			episodes = episodeList;
			checkpoints = checkpointList;
			if (!selectedEpisodeId && episodes.length > 0) {
				await selectEpisode(episodes[0]!.id);
			}
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to load replay data';
		} finally {
			isLoading = false;
		}
	}

	async function selectEpisode(id: string) {
		selectedEpisodeId = id;
		replay = null;
		const episode = episodes.find((e) => e.id === id);
		const replayId = episode?.replayRef?.id;
		if (!replayId) return;
		try {
			replay = await transport.loadReplay(replayId);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to load replay';
		}
	}

	return {
		get run() {
			return run;
		},
		get episodes() {
			return episodes;
		},
		get selectedEpisodeId() {
			return selectedEpisodeId;
		},
		get replay() {
			return replay;
		},
		get checkpoints() {
			return checkpoints;
		},
		get isLoading() {
			return isLoading;
		},
		get errorMessage() {
			return errorMessage;
		},
		bootstrap,
		selectEpisode
	};
}

export type VoxsimReplayPageModel = ReturnType<typeof createVoxsimReplayPageModel>;
