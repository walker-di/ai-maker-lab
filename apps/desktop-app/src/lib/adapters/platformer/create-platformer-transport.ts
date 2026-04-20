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

async function loadDesktopPlatformerTransport(): Promise<PlatformerTransport> {
  const { getDesktopRuntime } = await import('../runtime/desktop-runtime');
  return getDesktopRuntime().platformerTransport;
}

/**
 * Returns a transport that talks to the map catalog over `/api/platformer/**`
 * in web builds, and over Electrobun RPC (prefixed `*Platformer*` methods on
 * the shared desktop channel) when the renderer is hosted inside the desktop
 * webview.
 */
export function createPlatformerTransport(
  mode: PlatformerRuntimeMode = resolvePlatformerRuntimeMode(),
): PlatformerTransport {
  if (mode === 'web') return createWebPlatformerTransport();

  let cached: PlatformerTransport | undefined;
  const get = async () => (cached ??= await loadDesktopPlatformerTransport());

  return {
    async listMaps(options) {
      return (await get()).listMaps(options);
    },
    async getMap(id) {
      return (await get()).getMap(id);
    },
    async saveUserMap(input) {
      return (await get()).saveUserMap(input);
    },
    async deleteUserMap(id) {
      return (await get()).deleteUserMap(id);
    },
    async duplicateBuiltIn(builtInId, metadata) {
      return (await get()).duplicateBuiltIn(builtInId, metadata);
    },
    async recordRunResult(input) {
      return (await get()).recordRunResult(input);
    },
    async loadPlayerProfile(playerId) {
      return (await get()).loadPlayerProfile(playerId);
    },
  };
}
