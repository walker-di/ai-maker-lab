import type { Racing } from 'domain/shared';
import type {
	RacingTransport,
	RecordLapInput,
	StartSessionInput
} from './RacingTransport';

type ApiError = { error?: string };

async function parseJson<T>(response: Response): Promise<T> {
	if (response.ok) return (await response.json()) as T;
	const payload = (await response.json().catch(() => ({}))) as ApiError;
	throw new Error(payload.error ?? `Racing request failed with status ${response.status}`);
}

function postJson(url: string, body: unknown): Promise<Response> {
	return fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

function putJson(url: string, body: unknown): Promise<Response> {
	return fetch(url, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

export function createWebRacingTransport(): RacingTransport {
	return {
		async listVehicles() {
			return parseJson<Racing.VehiclePreset[]>(await fetch('/api/racing/vehicles'));
		},
		async listTracks() {
			return parseJson<Racing.TrackPreset[]>(await fetch('/api/racing/tracks'));
		},
		async startSession(input: StartSessionInput) {
			return parseJson<Racing.RacingSession>(await postJson('/api/racing/sessions', input));
		},
		async recordLap(input: RecordLapInput) {
			const url = `/api/racing/laps/${encodeURIComponent(input.trackId)}/${encodeURIComponent(input.vehicleId)}`;
			return parseJson<Racing.LapResult>(await postJson(url, input));
		},
		async getBestLap({ trackId, vehicleId }) {
			const url = `/api/racing/laps/${encodeURIComponent(trackId)}/${encodeURIComponent(vehicleId)}`;
			const res = await fetch(url);
			if (res.status === 404) return null;
			return parseJson<Racing.LapResult | null>(res);
		},
		async getSetup(userId) {
			const res = await fetch(`/api/racing/setup/${encodeURIComponent(userId)}`);
			if (res.status === 404) return null;
			return parseJson<Racing.SetupValues | null>(res);
		},
		async setSetup(userId, setup) {
			const res = await putJson(`/api/racing/setup/${encodeURIComponent(userId)}`, setup);
			if (!res.ok) {
				const payload = (await res.json().catch(() => ({}))) as ApiError;
				throw new Error(payload.error ?? `Setup save failed with status ${res.status}`);
			}
		}
	};
}
