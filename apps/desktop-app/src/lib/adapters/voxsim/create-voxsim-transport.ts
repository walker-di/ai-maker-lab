import type { VoxsimTransport, VoxsimRuntimeMode } from './VoxsimTransport';
import { createWebVoxsimTransport } from './web-voxsim-transport';

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

export function resolveVoxsimRuntimeMode(): VoxsimRuntimeMode {
  return hasElectrobunBridge() ? 'desktop' : 'web';
}

/**
 * For now the desktop bridge falls through to the web transport, identical
 * to the platformer setup; the Hono server already serves the voxsim REST
 * routes for both `dev:web` and the bundled `views://mainview` path.
 */
export function createVoxsimTransport(
  _mode: VoxsimRuntimeMode = resolveVoxsimRuntimeMode(),
): VoxsimTransport {
  return createWebVoxsimTransport();
}
