import type { Platformer as PlatformerApp } from 'domain/application';
import type { Platformer as PlatformerShared } from 'domain/shared';

/**
 * Electrobun RPC surface for the platformer vertical slice. Request keys are
 * prefixed (`listPlatformerMaps`, etc.) so merging into `DesktopRpcSchema` does
 * not collide with chat/todo/settings handlers.
 */
export type PlatformerRpcSchema = {
	bun: {
		requests: {
			listPlatformerMaps: {
				params: PlatformerApp.ListMapsOptions | undefined;
				response: PlatformerShared.ResolvedMapEntry[];
			};
			getPlatformerMap: {
				params: { id: string };
				response: PlatformerShared.ResolvedMapEntry | null;
			};
			savePlatformerUserMap: {
				params: PlatformerApp.SaveUserMapInput;
				response: PlatformerShared.ResolvedMapEntry;
			};
			deletePlatformerUserMap: { params: { id: string }; response: void };
			duplicatePlatformerBuiltIn: {
				params: { builtInId: string; metadata?: Partial<PlatformerShared.MapMetadata> };
				response: PlatformerShared.ResolvedMapEntry;
			};
			recordPlatformerRunResult: {
				params: PlatformerApp.RecordRunResultInput;
				response: PlatformerApp.PlayerProgressRecord;
			};
			loadPlatformerPlayerProfile: {
				params: { playerId: string };
				response: PlatformerApp.PlayerProgressRecord | null;
			};
		};
		messages: {};
	};
	webview: {
		requests: {};
		messages: {};
	};
};
