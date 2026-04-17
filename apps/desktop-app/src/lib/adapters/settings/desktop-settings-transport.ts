import type { DesktopWebviewRpc } from '../runtime/desktop-runtime';
import type { SettingsTransport } from './SettingsTransport';
import type { SetProviderKeysParams } from './electrobun-settings-rpc';

export function createDesktopSettingsTransport(rpc: DesktopWebviewRpc): SettingsTransport {
	return {
		mode: 'desktop',
		async getProviderKeyStatus() {
			return rpc.request.getProviderKeyStatus();
		},
		async setProviderKeys(params: SetProviderKeysParams) {
			return rpc.request.setProviderKeys(params);
		},
	};
}
