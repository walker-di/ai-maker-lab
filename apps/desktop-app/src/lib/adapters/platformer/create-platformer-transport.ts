import type { PlatformerTransport, PlatformerRuntimeMode } from './PlatformerTransport';
import { createWebPlatformerTransport } from './web-platformer-transport';

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

export function resolvePlatformerRuntimeMode(): PlatformerRuntimeMode {
  return hasElectrobunBridge() ? 'desktop' : 'web';
}

/**
 * For now the desktop bridge falls through to the web transport.
 * The vertical slice exposes the platformer service over the same Hono
 * server that already powers `dev:web` and the bundled `views://mainview`
 * static path; the Electrobun RPC route can be added later without
 * touching consumers because this factory always returns a stable
 * `PlatformerTransport`.
 */
export function createPlatformerTransport(
  _mode: PlatformerRuntimeMode = resolvePlatformerRuntimeMode(),
): PlatformerTransport {
  return createWebPlatformerTransport();
}
