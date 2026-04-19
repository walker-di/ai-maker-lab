import type { Voxsim as DomainVoxsim } from 'domain/shared';
import type { VoxsimTransport } from '$lib/adapters/voxsim/VoxsimTransport';

type ResolvedArenaEntry = DomainVoxsim.ResolvedArenaEntry;
type ArenaMetadata = DomainVoxsim.ArenaMetadata;
type ArenaDefinition = DomainVoxsim.ArenaDefinition;

export interface VoxsimEditorPageDeps {
	transport: VoxsimTransport;
}

export function createVoxsimEditorPageModel({ transport }: VoxsimEditorPageDeps) {
	let userArenas = $state<ResolvedArenaEntry[]>([]);
	let editing = $state<ResolvedArenaEntry | null>(null);
	let saving = $state(false);
	let errorMessage = $state<string | null>(null);

	async function bootstrap() {
		try {
			const all = await transport.listArenas();
			userArenas = all.filter((entry) => entry.source === 'user');
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to list user arenas';
		}
	}

	function selectForEdit(entry: ResolvedArenaEntry | null) {
		editing = entry;
	}

	async function saveEdited(metadata: ArenaMetadata, definition: ArenaDefinition) {
		if (!editing) return;
		saving = true;
		errorMessage = null;
		try {
			const updated = await transport.updateUserArena({
				id: editing.id,
				metadata,
				definition
			});
			editing = updated;
			await bootstrap();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to save arena';
		} finally {
			saving = false;
		}
	}

	async function createNewArena(metadata: ArenaMetadata, definition: ArenaDefinition) {
		saving = true;
		errorMessage = null;
		try {
			const entry = await transport.saveUserArena({ metadata, definition });
			editing = entry;
			await bootstrap();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to create arena';
		} finally {
			saving = false;
		}
	}

	async function duplicateBuiltIn(builtInId: string, title: string) {
		saving = true;
		errorMessage = null;
		try {
			const entry = await transport.duplicateBuiltInArena({
				builtInId,
				metadata: { title }
			});
			editing = entry;
			await bootstrap();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to duplicate arena';
		} finally {
			saving = false;
		}
	}

	async function deleteArena(id: string) {
		try {
			await transport.deleteUserArena(id);
			if (editing?.id === id) editing = null;
			await bootstrap();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to delete arena';
		}
	}

	return {
		get userArenas() {
			return userArenas;
		},
		get editing() {
			return editing;
		},
		get saving() {
			return saving;
		},
		get errorMessage() {
			return errorMessage;
		},
		bootstrap,
		selectForEdit,
		saveEdited,
		createNewArena,
		duplicateBuiltIn,
		deleteArena
	};
}

export type VoxsimEditorPageModel = ReturnType<typeof createVoxsimEditorPageModel>;
