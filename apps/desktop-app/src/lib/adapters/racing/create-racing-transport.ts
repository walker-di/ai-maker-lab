import type { RacingRuntimeMode, RacingTransport } from './RacingTransport';
import { createWebRacingTransport } from './web-racing-transport';

type ElectrobunWindow = Window & {
	__electrobun?: unknown;
	__electrobunWebviewId?: number;
	__electrobunRpcSocketPort?: number;
};

function hasElectrobunBridge(): boolean {
	if (typeof window === 'undefined') return false;
	const w = window as ElectrobunWindow;
	return (
		typeof w.__electrobun !== 'undefined' ||
		typeof w.__electrobunWebviewId === 'number' ||
		typeof w.__electrobunRpcSocketPort === 'number'
	);
}

export function resolveRacingRuntimeMode(): RacingRuntimeMode {
	return hasElectrobunBridge() ? 'desktop' : 'web';
}

/**
 * Mirrors the platformer/rts pattern: today the desktop bridge falls
 * through to the web transport since both run against the same Hono app.
 * Swap this out for an Electrobun RPC implementation later without touching
 * page composition code.
 */
export function createRacingTransport(
	_mode: RacingRuntimeMode = resolveRacingRuntimeMode()
): RacingTransport {
	return createWebRacingTransport();
}
