import type { Voxsim as DomainVoxsim } from 'domain/shared';
import type { VoxsimTransport } from '$lib/adapters/voxsim/VoxsimTransport';

type ResolvedArenaEntry = DomainVoxsim.ResolvedArenaEntry;

export interface VoxsimArenaPageDeps {
	transport: VoxsimTransport;
}

export function createVoxsimArenaPageModel({ transport }: VoxsimArenaPageDeps) {
	let catalog = $state<ResolvedArenaEntry[]>([]);
	let selectedId = $state<string | null>(null);
	let selectedArena = $state<ResolvedArenaEntry | null>(null);
	let isLoading = $state(false);
	let errorMessage = $state<string | null>(null);

	async function bootstrap() {
		isLoading = true;
		errorMessage = null;
		try {
			catalog = await transport.listArenas();
			if (!selectedId && catalog.length > 0) {
				await selectArena(catalog[0]!.id);
			}
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to load arenas';
		} finally {
			isLoading = false;
		}
	}

	async function selectArena(id: string) {
		selectedId = id;
		const known = catalog.find((entry) => entry.id === id);
		if (known) {
			selectedArena = known;
			return;
		}
		try {
			selectedArena = await transport.getArena(id);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to load arena';
		}
	}

	function clearSelection() {
		selectedId = null;
		selectedArena = null;
	}

	return {
		get catalog() {
			return catalog;
		},
		get selectedId() {
			return selectedId;
		},
		get selectedArena() {
			return selectedArena;
		},
		get isLoading() {
			return isLoading;
		},
		get errorMessage() {
			return errorMessage;
		},
		bootstrap,
		selectArena,
		clearSelection
	};
}

export type VoxsimArenaPageModel = ReturnType<typeof createVoxsimArenaPageModel>;
