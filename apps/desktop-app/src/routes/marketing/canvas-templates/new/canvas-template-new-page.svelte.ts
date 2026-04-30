import type { MarketingTransport } from '$lib/adapters/marketing/create-marketing-transport.js';
import type { CanvasAspectRatio } from 'domain/shared';

interface CreateNewTemplatePageModelInput {
	transport: MarketingTransport;
}

export function createNewTemplatePageModel({ transport }: CreateNewTemplatePageModelInput) {
	let name = '';
	let description = '';
	let aspectRatio: CanvasAspectRatio = '16:9';
	let canvasJson: string | null = null;
	let isSaving = false;
	let errorMessage: string | null = null;

	function updateCanvasData(json: string) {
		canvasJson = json;
	}

	async function save(): Promise<boolean> {
		if (name.trim().length === 0) {
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
		get isValid() { return name.trim().length > 0; },
		get errorMessage() { return errorMessage; },
		updateCanvasData,
		save,
	};
}
