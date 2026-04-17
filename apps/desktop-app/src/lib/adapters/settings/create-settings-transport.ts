import type { SettingsRuntimeMode, SettingsTransport } from './SettingsTransport';
import { createWebSettingsTransport } from './web-settings-transport';

type ElectrobunWindow = Window & {
	__electrobun?: unknown;
	__electrobunWebviewId?: number;
	__electrobunRpcSocketPort?: number;
};

function hasElectrobunBridge(): boolean {
	if (typeof window === 'undefined') return false;
	const electrobunWindow = window as ElectrobunWindow;
	return (
		typeof electrobunWindow.__electrobun !== 'undefined' ||
		typeof electrobunWindow.__electrobunWebviewId === 'number' ||
		typeof electrobunWindow.__electrobunRpcSocketPort === 'number'
	);
}

export function resolveSettingsRuntimeMode(): SettingsRuntimeMode {
	return hasElectrobunBridge() ? 'desktop' : 'web';
}

async function loadDesktopSettingsTransport(): Promise<SettingsTransport> {
	const { getDesktopRuntime } = await import('../runtime/desktop-runtime');
	return getDesktopRuntime().settingsTransport;
}

export function createSettingsTransport(
	mode: SettingsRuntimeMode = resolveSettingsRuntimeMode(),
): SettingsTransport {
	if (mode === 'web') return createWebSettingsTransport();

	let cached: SettingsTransport | undefined;
	const get = async () => (cached ??= await loadDesktopSettingsTransport());

	return new Proxy({} as SettingsTransport, {
		get(_target, prop) {
			if (prop === 'mode') return 'desktop';
			return async (...args: unknown[]) => {
				const transport = await get();
				const fn = transport[prop as keyof SettingsTransport] as (
					...a: unknown[]
				) => unknown;
				return fn.apply(transport, args);
			};
		},
	});
}
