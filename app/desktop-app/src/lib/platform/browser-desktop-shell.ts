import type { DesktopRuntimeSnapshot, DesktopShell } from './desktop-shell';

function getBrowserPlatform() {
	return navigator.platform ?? 'Browser';
}

function createSnapshot(): DesktopRuntimeSnapshot {
	return {
		host: 'browser',
		hostLabel: 'Browser preview',
		appId: 'browser-preview',
		appVersion: 'dev',
		mode: 'browser',
		os: getBrowserPlatform(),
		arch: 'n/a',
		homeDirectory: 'Unavailable outside Neutralino',
		nativeApiEnabled: false,
		windowControlsEnabled: false
	};
}

export function createBrowserDesktopShell(): DesktopShell {
	return {
		kind: 'browser',
		async init() {},
		async getRuntimeSnapshot() {
			return createSnapshot();
		},
		async minimizeWindow() {},
		async exit() {}
	};
}
