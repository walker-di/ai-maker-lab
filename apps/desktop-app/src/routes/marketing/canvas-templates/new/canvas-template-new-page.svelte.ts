import type { MarketingTransport } from '$lib/adapters/marketing/create-marketing-transport.js';
import type { CanvasAspectRatio } from 'domain/shared';

interface CreateNewTemplatePageModelInput {
	transport: MarketingTransport;
}

export function createNewTemplatePageModel({ transport }: CreateNewTemplatePageModelInput) {
	let name = $state('');
	let description = $state('');
	let aspectRatio = $state<CanvasAspectRatio>('16:9');
	let canvasJson = $state<string | null>(null);
	let isSaving = $state(false);
	let errorMessage = $state<string | null>(null);

	const isValid = $derived(name.trim().length > 0);

	function updateCanvasData(json: string) {
		canvasJson = json;
	}

	async function save(): Promise<boolean> {
		if (!isValid) {
			errorMessage = 'Template name is required.';
			return false;
		}

		try {
			isSaving = true;
			errorMessage = null;
			await transport.catalog.createCanvasTemplate({
				name: name.trim(),
				description: description.trim() || undefined,
				aspectRatio,
				canvasData: canvasJson ?? '{}',
				tags: [],
			});
			return true;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to save template.';
			console.error(error);
			return false;
		} finally {
			isSaving = false;
		}
	}

	return {
		get name() { return name; },
		set name(v: string) { name = v; },
		get description() { return description; },
		set description(v: string) { description = v; },
		get aspectRatio() { return aspectRatio; },
		set aspectRatio(v: CanvasAspectRatio) { aspectRatio = v; },
		get canvasJson() { return canvasJson; },
		get isSaving() { return isSaving; },
		get isValid() { return isValid; },
		get errorMessage() { return errorMessage; },
		updateCanvasData,
		save,
	};
}
