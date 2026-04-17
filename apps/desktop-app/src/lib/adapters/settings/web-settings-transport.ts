import { SettingsUnsupportedInWebError, type SettingsTransport } from './SettingsTransport';

export function createWebSettingsTransport(): SettingsTransport {
	return {
		mode: 'web',
		async getProviderKeyStatus() {
			return [];
		},
		async setProviderKeys() {
			throw new SettingsUnsupportedInWebError();
		},
	};
}
