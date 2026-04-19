import { createSettingsTransport } from '$lib/adapters/settings/create-settings-transport';
import { createSettingsPageModel } from './settings-page.svelte.ts';

export function createSettingsPage() {
	const model = createSettingsPageModel({
		transport: createSettingsTransport(),
	});

	if (model.mode === 'desktop') {
		void model.load();
	}

	return model;
}
