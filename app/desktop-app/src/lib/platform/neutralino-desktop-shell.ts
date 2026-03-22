import type { DesktopRuntimeSnapshot, DesktopShell } from './desktop-shell';

type NeutralinoLibrary = typeof import('@neutralinojs/lib');

const getNeutralinoGlobal = (key: string) => (globalThis as Record<string, unknown>)[key];

let libraryPromise: Promise<NeutralinoLibrary> | undefined;

function isWindows() {
	return String(getNeutralinoGlobal('NL_OS') ?? '').toLowerCase() === 'windows';
}

async function loadLibrary() {
	libraryPromise ??= import('@neutralinojs/lib');
	return libraryPromise;
}

async function ensureInitialized() {
	const library = await loadLibrary();
	await Promise.resolve(library.init());
	return library;
}

function getMode() {
	return String(getNeutralinoGlobal('NL_MODE') ?? 'window');
}

export function isNeutralinoRuntime() {
	return typeof getNeutralinoGlobal('NL_VERSION') === 'string';
}

export function createNeutralinoDesktopShell(): DesktopShell {
	return {
		kind: 'neutralino',
		async init() {
			await ensureInitialized();
		},
		async getRuntimeSnapshot() {
			const library = await ensureInitialized();
			const config = await library.app.getConfig();
			const homeDirectory = await library.os
				.getEnv(isWindows() ? 'USERPROFILE' : 'HOME')
				.catch(() => 'Unavailable');

			return {
				host: 'neutralino',
				hostLabel: 'Neutralino desktop shell',
				appId: String(getNeutralinoGlobal('NL_APPID') ?? config.applicationId ?? 'lab.ai-maker.desktop'),
				appVersion: String(getNeutralinoGlobal('NL_APPVERSION') ?? config.version ?? '0.0.1'),
				mode: getMode(),
				os: String(getNeutralinoGlobal('NL_OS') ?? 'Unknown'),
				arch: String(getNeutralinoGlobal('NL_ARCH') ?? 'Unknown'),
				homeDirectory,
				nativeApiEnabled: true,
				windowControlsEnabled: getMode() === 'window'
			};
		},
		async minimizeWindow() {
			if (getMode() !== 'window') {
				return;
			}

			const library = await ensureInitialized();
			await library.window.minimize();
		},
		async exit() {
			const library = await ensureInitialized();
			await library.app.exit();
		}
	};
}
