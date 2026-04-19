import type { Voxsim } from 'domain/shared';
import type {
  AgentDetail,
  CreateAgentInput,
  DuplicateBuiltInArenaInput,
  MutateAgentInput,
  NeatGenomeDetail,
  RecordEpisodeInput,
  RecordNeatGenomeInput,
  RecordNeatInnovationLogInput,
  RecordNeatSpeciesSnapshotInput,
  RecordReplayInput,
  RecordWeightCheckpointInput,
  ReplayDetail,
  SaveUserArenaInput,
  StartTrainingRunInput,
  UpdateAgentDnaInput,
  UpdateUserArenaInput,
  VoxsimTransport,
  WeightCheckpointDetail,
} from './VoxsimTransport';

type ResolvedArenaEntry = Voxsim.ResolvedArenaEntry;
type AgentSummary = Voxsim.AgentSummary;
type LineageNode = Voxsim.LineageNode;
type EpisodeSummary = Voxsim.EpisodeSummary;
type TrainingRunSummary = Voxsim.TrainingRunSummary;
type NeatGenomeSummary = Voxsim.NeatGenomeSummary;
type NeatSpeciesSummary = Voxsim.NeatSpeciesSummary;
type NeatInnovationLogEntry = Voxsim.NeatInnovationLogEntry;

type ApiError = { error?: string };

async function parseJson<T>(response: Response): Promise<T> {
  if (response.ok) return (await response.json()) as T;
  const payload = (await response.json().catch(() => ({}))) as ApiError;
  throw new Error(payload.error ?? `Voxsim request failed with status ${response.status}`);
}

function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body, jsonReplacer),
  });
}

function patchJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body, jsonReplacer),
  });
}

function deleteRequest(url: string): Promise<Response> {
  return fetch(url, { method: 'DELETE' });
}

/**
 * JSON serialization helper that converts `Uint8Array` to a tagged base64
 * envelope so binary payloads round-trip through the REST layer.
 */
function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return { __bin__: 'base64', data: bytesToBase64(value) };
  }
  return value;
}

function jsonReviver(_key: string, value: unknown): unknown {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as { __bin__?: unknown }).__bin__ === 'base64' &&
    typeof (value as { data?: unknown }).data === 'string'
  ) {
    return base64ToBytes((value as { data: string }).data);
  }
  return value;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]!);
  return btoa(out);
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(b64, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function parseJsonWithBytes<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiError;
    throw new Error(payload.error ?? `Voxsim request failed with status ${response.status}`);
  }
  const text = await response.text();
  return JSON.parse(text, jsonReviver) as T;
}

export function createWebVoxsimTransport(): VoxsimTransport {
  return {
    async listArenas() {
      return parseJson<ResolvedArenaEntry[]>(await fetch('/api/voxsim/arenas'));
    },
    async getArena(id) {
      const res = await fetch(`/api/voxsim/arenas/${encodeURIComponent(id)}`);
      if (res.status === 404) return null;
      return parseJson<ResolvedArenaEntry>(res);
    },
    async saveUserArena(input: SaveUserArenaInput) {
      return parseJson<ResolvedArenaEntry>(await postJson('/api/voxsim/arenas', input));
    },
    async updateUserArena(input: UpdateUserArenaInput) {
      return parseJson<ResolvedArenaEntry>(
        await patchJson(`/api/voxsim/arenas/${encodeURIComponent(input.id)}`, input),
      );
    },
    async deleteUserArena(id) {
      const res = await deleteRequest(`/api/voxsim/arenas/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`Delete failed with status ${res.status}`);
    },
    async duplicateBuiltInArena(input: DuplicateBuiltInArenaInput) {
      return parseJson<ResolvedArenaEntry>(
        await postJson('/api/voxsim/arenas/duplicate', input),
      );
    },

    async listAgents(filter) {
      const params = new URLSearchParams();
      if (filter?.kind) params.set('kind', filter.kind);
      if (filter?.bodyDnaId) params.set('bodyDnaId', filter.bodyDnaId);
      if (filter?.lineageRootId) params.set('lineageRootId', filter.lineageRootId);
      if (filter?.since) params.set('since', filter.since);
      if (filter?.limit) params.set('limit', String(filter.limit));
      const query = params.toString();
      const url = `/api/voxsim/agents${query ? `?${query}` : ''}`;
      return parseJson<AgentSummary[]>(await fetch(url));
    },
    async getAgent(id) {
      const res = await fetch(`/api/voxsim/agents/${encodeURIComponent(id)}`);
      if (res.status === 404) return null;
      return parseJson<AgentDetail>(res);
    },
    async createAgent(input: CreateAgentInput) {
      return parseJson<AgentSummary>(await postJson('/api/voxsim/agents', input));
    },
    async updateAgentDna(input: UpdateAgentDnaInput) {
      return parseJson<AgentSummary>(
        await patchJson(`/api/voxsim/agents/${encodeURIComponent(input.id)}`, input),
      );
    },
    async mutateAgent(input: MutateAgentInput) {
      return parseJson<AgentSummary>(
        await postJson(`/api/voxsim/agents/${encodeURIComponent(input.id)}/mutate`, input),
      );
    },
    async deleteAgent(id) {
      const res = await deleteRequest(`/api/voxsim/agents/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`Delete failed with status ${res.status}`);
    },
    async listLineage(rootAgentId) {
      return parseJson<LineageNode[]>(
        await fetch(`/api/voxsim/agents/${encodeURIComponent(rootAgentId)}/lineage`),
      );
    },

    async listTrainingRuns(filter) {
      const params = new URLSearchParams();
      if (filter?.agentId) params.set('agentId', filter.agentId);
      if (filter?.status) params.set('status', filter.status);
      if (filter?.since) params.set('since', filter.since);
      if (filter?.limit) params.set('limit', String(filter.limit));
      const query = params.toString();
      const url = `/api/voxsim/training-runs${query ? `?${query}` : ''}`;
      return parseJson<TrainingRunSummary[]>(await fetch(url));
    },
    async startTrainingRun(input: StartTrainingRunInput) {
      return parseJson<TrainingRunSummary>(await postJson('/api/voxsim/training-runs', input));
    },
    async pauseTrainingRun(runId) {
      return parseJson<TrainingRunSummary>(
        await postJson(`/api/voxsim/training-runs/${encodeURIComponent(runId)}/pause`, {}),
      );
    },
    async resumeTrainingRun(runId) {
      return parseJson<TrainingRunSummary>(
        await postJson(`/api/voxsim/training-runs/${encodeURIComponent(runId)}/resume`, {}),
      );
    },
    async stopTrainingRun(runId) {
      return parseJson<TrainingRunSummary>(
        await postJson(`/api/voxsim/training-runs/${encodeURIComponent(runId)}/stop`, {}),
      );
    },

    async listEpisodes(filter) {
      const params = new URLSearchParams();
      if (filter?.runId) params.set('runId', filter.runId);
      if (filter?.agentId) params.set('agentId', filter.agentId);
      if (filter?.arenaId) params.set('arenaId', filter.arenaId);
      if (filter?.outcome) params.set('outcome', filter.outcome);
      if (filter?.since) params.set('since', filter.since);
      if (filter?.limit) params.set('limit', String(filter.limit));
      const query = params.toString();
      const url = `/api/voxsim/episodes${query ? `?${query}` : ''}`;
      return parseJson<EpisodeSummary[]>(await fetch(url));
    },
    async recordEpisode(input: RecordEpisodeInput) {
      return parseJson<EpisodeSummary>(await postJson('/api/voxsim/episodes', input));
    },

    async loadReplay(id) {
      const res = await fetch(`/api/voxsim/replays/${encodeURIComponent(id)}`);
      if (res.status === 404) return null;
      return parseJsonWithBytes<ReplayDetail>(res);
    },
    async recordReplay(input: RecordReplayInput) {
      return parseJsonWithBytes<ReplayDetail>(await postJson('/api/voxsim/replays', input));
    },

    async listCheckpoints(filter) {
      const params = new URLSearchParams();
      if (filter?.agentId) params.set('agentId', filter.agentId);
      if (filter?.runId) params.set('runId', filter.runId);
      if (filter?.minScore !== undefined) params.set('minScore', String(filter.minScore));
      if (filter?.limit) params.set('limit', String(filter.limit));
      const query = params.toString();
      const url = `/api/voxsim/checkpoints${query ? `?${query}` : ''}`;
      return parseJsonWithBytes<WeightCheckpointDetail[]>(await fetch(url));
    },
    async loadCheckpoint(id) {
      const res = await fetch(`/api/voxsim/checkpoints/${encodeURIComponent(id)}`);
      if (res.status === 404) return null;
      return parseJsonWithBytes<WeightCheckpointDetail>(res);
    },
    async saveCheckpoint(input: RecordWeightCheckpointInput) {
      return parseJsonWithBytes<WeightCheckpointDetail>(
        await postJson('/api/voxsim/checkpoints', input),
      );
    },

    async listNeatGenomes(filter) {
      const params = new URLSearchParams();
      if (filter?.agentId) params.set('agentId', filter.agentId);
      if (filter?.runId) params.set('runId', filter.runId);
      if (filter?.speciesId !== undefined) params.set('speciesId', String(filter.speciesId));
      if (filter?.generation !== undefined) params.set('generation', String(filter.generation));
      if (filter?.minScore !== undefined) params.set('minScore', String(filter.minScore));
      if (filter?.limit) params.set('limit', String(filter.limit));
      const query = params.toString();
      const url = `/api/voxsim/neat/genomes${query ? `?${query}` : ''}`;
      return parseJson<NeatGenomeSummary[]>(await fetch(url));
    },
    async loadNeatGenome(id) {
      const res = await fetch(`/api/voxsim/neat/genomes/${encodeURIComponent(id)}`);
      if (res.status === 404) return null;
      return parseJson<NeatGenomeDetail>(res);
    },
    async recordNeatGenome(input: RecordNeatGenomeInput) {
      return parseJson<NeatGenomeSummary>(await postJson('/api/voxsim/neat/genomes', input));
    },
    async listNeatSpecies(filter) {
      const params = new URLSearchParams();
      params.set('runId', filter.runId);
      if (filter.generation !== undefined) params.set('generation', String(filter.generation));
      if (filter.limit) params.set('limit', String(filter.limit));
      return parseJson<NeatSpeciesSummary[]>(
        await fetch(`/api/voxsim/neat/species?${params.toString()}`),
      );
    },
    async recordNeatSpeciesSnapshot(input: RecordNeatSpeciesSnapshotInput) {
      return parseJson<NeatSpeciesSummary>(
        await postJson('/api/voxsim/neat/species', input),
      );
    },
    async listNeatInnovations(filter) {
      const params = new URLSearchParams();
      params.set('runId', filter.runId);
      if (filter.sinceGeneration !== undefined) {
        params.set('sinceGeneration', String(filter.sinceGeneration));
      }
      if (filter.limit) params.set('limit', String(filter.limit));
      return parseJson<NeatInnovationLogEntry[]>(
        await fetch(`/api/voxsim/neat/innovations?${params.toString()}`),
      );
    },
    async recordNeatInnovations(input: RecordNeatInnovationLogInput) {
      return parseJson<NeatInnovationLogEntry>(
        await postJson('/api/voxsim/neat/innovations', input),
      );
    },
  };
}

export { jsonReplacer, jsonReviver, bytesToBase64, base64ToBytes };
