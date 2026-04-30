import type { MarketingTransport } from '$lib/adapters/marketing/create-marketing-transport.js';
import type { CanvasTemplate, UpdateCanvasTemplateDto } from '$lib/adapters/marketing/MarketingTransport.js';
import type { CanvasAspectRatio } from 'domain/shared';

interface CreateEditTemplatePageModelInput {
	transport: MarketingTransport;
}

export function createEditTemplatePageModel({ transport }: CreateEditTemplatePageModelInput) {
	let template = $state<CanvasTemplate | null>(null);
	let name = $state('');
	let description = $state('');
	let aspectRatio = $state<CanvasAspectRatio>('16:9');
	let canvasJson = $state<string | null>(null);
	let isLoading = $state(false);
	let isSaving = $state(false);
	let errorMessage = $state<string | null>(null);

	const isValid = $derived(name.trim().length > 0);

	async function load(id: string) {
		try {
			isLoading = true;
			errorMessage = null;
			const loaded = await transport.catalog.getCanvasTemplate(id);
			template = loaded;
			name = loaded.name;
			description = loaded.description ?? '';
			aspectRatio = loaded.aspectRatio;
			canvasJson = loaded.canvasData;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to load template.';
			console.error(error);
		} finally {
			isLoading = false;
		}
	}

	function updateCanvasData(json: string) {
		canvasJson = json;
	}

	async function save(): Promise<boolean> {
		if (!template || !isValid) {
			errorMessage = 'Template name is required.';
			return false;
		}

		try {
			isSaving = true;
			errorMessage = null;
			const dto: UpdateCanvasTemplateDto = {
				name: name.trim(),
				description: description.trim() || undefined,
				aspectRatio,
				canvasData: canvasJson ?? template.canvasData,
			};
			await transport.catalog.updateCanvasTemplate(template.id, dto);
			return true;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to update template.';
			console.error(error);
			return false;
		} finally {
			isSaving = false;
		}
	}

	return {
		get template() { return template; },
		get name() { return name; },
		set name(v: string) { name = v; },
		get description() { return description; },
		set description(v: string) { description = v; },
		get aspectRatio() { return aspectRatio; },
		set aspectRatio(v: CanvasAspectRatio) { aspectRatio = v; },
		get canvasJson() { return canvasJson; },
		get isLoading() { return isLoading; },
		get isSaving() { return isSaving; },
		get isValid() { return isValid; },
		get errorMessage() { return errorMessage; },
		load,
		updateCanvasData,
		save,
	};
}
