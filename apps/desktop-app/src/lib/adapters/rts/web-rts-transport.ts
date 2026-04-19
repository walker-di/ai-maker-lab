import type {
  RtsTransport,
  StartMatchInput,
  SaveUserMapInput,
} from './RtsTransport';
import type { Rts } from 'domain/shared';

type ApiError = { error?: string };

async function parseJson<T>(response: Response): Promise<T> {
  if (response.ok) return (await response.json()) as T;
  const payload = (await response.json().catch(() => ({}))) as ApiError;
  throw new Error(payload.error ?? `RTS request failed with status ${response.status}`);
}

function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function createWebRtsTransport(): RtsTransport {
  return {
    async listMaps() {
      return parseJson<Rts.ResolvedRtsMap[]>(await fetch('/api/rts/maps'));
    },
    async getMap(id) {
      const res = await fetch(`/api/rts/maps/${encodeURIComponent(id)}`);
      if (res.status === 404) return null;
      return parseJson<Rts.ResolvedRtsMap>(res);
    },
    async generateMap(params) {
      return parseJson<{ map: Rts.MapDefinition; params: Rts.Generation.MapGenerationParams }>(
        await postJson('/api/rts/maps/generate', params),
      );
    },
    async saveUserMap(input: SaveUserMapInput) {
      return parseJson<Rts.UserMapRecord>(await postJson('/api/rts/user-maps', input));
    },
    async listUserMaps() {
      return parseJson<Rts.UserMapRecord[]>(await fetch('/api/rts/user-maps'));
    },
    async getUserMap(id) {
      const res = await fetch(`/api/rts/user-maps/${encodeURIComponent(id)}`);
      if (res.status === 404) return null;
      return parseJson<Rts.UserMapRecord>(res);
    },
    async deleteUserMap(id) {
      const res = await fetch(`/api/rts/user-maps/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as ApiError;
        throw new Error(payload.error ?? `Delete failed with status ${res.status}`);
      }
    },
    async startMatch(input: StartMatchInput) {
      return parseJson<{ match: Rts.MatchDefinition; map: Rts.ResolvedRtsMap }>(
        await postJson('/api/rts/matches/start', input),
      );
    },
    async recordMatchResult(result) {
      return parseJson<Rts.MatchResultRecord>(await postJson('/api/rts/matches/results', result));
    },
    async listMatchResults(filter = {}) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filter)) {
        if (value != null) params.set(key, String(value));
      }
      const url = `/api/rts/matches/results${params.toString() ? `?${params.toString()}` : ''}`;
      return parseJson<Rts.MatchResultRecord[]>(await fetch(url));
    },
  };
}
