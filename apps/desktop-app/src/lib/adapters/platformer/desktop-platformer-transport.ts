import type {
	PlatformerTransport,
	SaveUserMapInput,
	RecordRunResultInput,
} from './PlatformerTransport';
import type { DesktopWebviewRpc } from '../runtime/desktop-runtime';
import { normalizeList, normalizeRecord } from '../runtime/surreal-id-normalizer';

export function createDesktopPlatformerTransport(rpc: DesktopWebviewRpc): PlatformerTransport {
	return {
		async listMaps(options) {
			return normalizeList(await rpc.request.listPlatformerMaps(options));
		},

		async getMap(id: string) {
			const map = await rpc.request.getPlatformerMap({ id });
			return map ? normalizeRecord(map) : null;
		},

		async saveUserMap(input: SaveUserMapInput) {
			return normalizeRecord(await rpc.request.savePlatformerUserMap(input));
		},

		async deleteUserMap(id: string) {
			await rpc.request.deletePlatformerUserMap({ id });
		},

		async duplicateBuiltIn(builtInId: string, metadata = {}) {
			return normalizeRecord(
				await rpc.request.duplicatePlatformerBuiltIn({ builtInId, metadata }),
			);
		},

		async recordRunResult(input: RecordRunResultInput) {
			return await rpc.request.recordPlatformerRunResult(input);
		},

		async loadPlayerProfile(playerId: string) {
			return await rpc.request.loadPlatformerPlayerProfile({ playerId });
		},
	};
}
