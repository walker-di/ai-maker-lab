import type {
	ProviderId,
	ProviderKeyStatus,
	SetProviderKeysParams,
	SetProviderKeysResponse,
} from './electrobun-settings-rpc';

export type SettingsRuntimeMode = 'desktop' | 'web';

/**
 * Adapter the Settings page model talks to. The desktop implementation forwards
 * to the bun side via RPC; the web implementation throws because secrets only
 * exist on the desktop file system.
 */
export interface SettingsTransport {
	readonly mode: SettingsRuntimeMode;
	getProviderKeyStatus(): Promise<ProviderKeyStatus[]>;
	setProviderKeys(params: SetProviderKeysParams): Promise<SetProviderKeysResponse>;
}

/**
 * Thrown by the web transport to make the "settings are desktop-only" branch
 * unmistakable when callers try to mutate secrets in the wrong runtime.
 */
export class SettingsUnsupportedInWebError extends Error {
	constructor(message = 'Settings are only configurable from the desktop app.') {
		super(message);
		this.name = 'SettingsUnsupportedInWebError';
	}
}

export type { ProviderId, ProviderKeyStatus, SetProviderKeysParams, SetProviderKeysResponse };
