export interface DesktopRuntimeSnapshot {
	host: 'neutralino' | 'browser';
	hostLabel: string;
	appId: string;
	appVersion: string;
	mode: string;
	os: string;
	arch: string;
	homeDirectory: string;
	nativeApiEnabled: boolean;
	windowControlsEnabled: boolean;
}

export interface DesktopShell {
	readonly kind: DesktopRuntimeSnapshot['host'];
	init(): Promise<void>;
	getRuntimeSnapshot(): Promise<DesktopRuntimeSnapshot>;
	minimizeWindow(): Promise<void>;
	exit(): Promise<void>;
}
