import type { Platformer } from 'domain/shared';
import type {
  PlatformerTransport,
  SaveUserMapInput,
  RecordRunResultInput,
  PlayerProgressRecord,
} from './PlatformerTransport';

type MapMetadata = Platformer.MapMetadata;
type ResolvedMapEntry = Platformer.ResolvedMapEntry;

type ApiError = { error?: string };

async function parseJson<T>(response: Response): Promise<T> {
  if (response.ok) return (await response.json()) as T;
  const payload = (await response.json().catch(() => ({}))) as ApiError;
  throw new Error(payload.error ?? `Platformer request failed with status ${response.status}`);
}

function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function createWebPlatformerTransport(): PlatformerTransport {
  return {
    async listMaps(options) {
      const params = new URLSearchParams();
      if (options?.source) params.set('source', options.source);
      if (options?.playerId) params.set('playerId', options.playerId);
      const query = params.toString();
      const url = `/api/platformer/maps${query ? `?${query}` : ''}`;
      return parseJson<ResolvedMapEntry[]>(await fetch(url));
    },

    async getMap(id: string) {
      const res = await fetch(`/api/platformer/maps/${encodeURIComponent(id)}`);
      if (res.status === 404) return null;
      return parseJson<ResolvedMapEntry>(res);
    },

    async saveUserMap(input: SaveUserMapInput) {
      return parseJson<ResolvedMapEntry>(await postJson('/api/platformer/maps', input));
    },

    async deleteUserMap(id: string) {
      const res = await fetch(`/api/platformer/maps/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as ApiError;
        throw new Error(payload.error ?? `Delete failed with status ${res.status}`);
      }
    },

    async duplicateBuiltIn(builtInId: string, metadata: Partial<MapMetadata> = {}) {
      return parseJson<ResolvedMapEntry>(
        await postJson('/api/platformer/maps/duplicate', { builtInId, metadata }),
      );
    },

    async recordRunResult(input: RecordRunResultInput) {
      return parseJson<PlayerProgressRecord>(await postJson('/api/platformer/runs', input));
    },

    async loadPlayerProfile(playerId: string) {
      const res = await fetch(`/api/platformer/players/${encodeURIComponent(playerId)}`);
      if (res.status === 404) return null;
      return parseJson<PlayerProgressRecord>(res);
    },
  };
}
