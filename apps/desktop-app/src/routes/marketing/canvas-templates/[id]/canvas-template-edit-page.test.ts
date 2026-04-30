import { describe, expect, test, vi } from 'vitest';
import { createEditTemplatePageModel } from './canvas-template-edit-page.svelte';
import type { MarketingTransport } from '$lib/adapters/marketing/create-marketing-transport';
import type { CanvasTemplate } from '$lib/adapters/marketing/MarketingTransport';

function makeTemplate(): CanvasTemplate {
	return {
		id: 't-1',
		name: 'Original',
		description: 'Original desc',
		aspectRatio: '16:9',
		canvasData: '{"objects":[]}',
		previewUrl: undefined,
		tags: [],
		isDefault: false,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
	};
}

function createTransportStub() {
	const template = makeTemplate();

	const catalog = {
		getCanvasTemplate: vi.fn(async () => ({ ...template })),
		updateCanvasTemplate: vi.fn(async (id: string, data: object) => ({
			...template,
			...data,
			id,
			updatedAt: '2026-01-02T00:00:00.000Z',
		})),
	};

	const transport = { catalog } as unknown as MarketingTransport;
	return { catalog, transport };
}

describe('edit canvas template page model', () => {
	test('load() fetches template and populates state', async () => {
		const { transport } = createTransportStub();
		const model = createEditTemplatePageModel({ transport });

		await model.load('t-1');

		expect(model.template).not.toBeNull();
		expect(model.name).toBe('Original');
		expect(model.description).toBe('Original desc');
		expect(model.aspectRatio).toBe('16:9');
		expect(model.canvasJson).toBe('{"objects":[]}');
		expect(model.isLoading).toBe(false);
	});

	test('load() sets errorMessage on failure', async () => {
		const { catalog, transport } = createTransportStub();
		catalog.getCanvasTemplate.mockRejectedValueOnce(new Error('Not found'));
		const model = createEditTemplatePageModel({ transport });

		await model.load('t-99');

		expect(model.errorMessage).toBe('Not found');
		expect(model.template).toBeNull();
	});

	test('save() calls updateCanvasTemplate with correct DTO', async () => {
		const { catalog, transport } = createTransportStub();
		const model = createEditTemplatePageModel({ transport });
		await model.load('t-1');

		model.name = 'Updated Name';
		model.description = 'Updated desc';
		model.updateCanvasData('{"objects":[{"type":"rect"}]}');

		const result = await model.save();

		expect(result).toBe(true);
		expect(catalog.updateCanvasTemplate).toHaveBeenCalledWith('t-1', {
			name: 'Updated Name',
			description: 'Updated desc',
			aspectRatio: '16:9',
			canvasData: '{"objects":[{"type":"rect"}]}',
		});
	});

	test('save() fails when name is empty', async () => {
		const { catalog, transport } = createTransportStub();
		const model = createEditTemplatePageModel({ transport });
		await model.load('t-1');

		model.name = '   ';
		const result = await model.save();

		expect(result).toBe(false);
		expect(model.errorMessage).toBe('Template name is required.');
		expect(catalog.updateCanvasTemplate).not.toHaveBeenCalled();
	});

	test('save() sets errorMessage on transport failure', async () => {
		const { catalog, transport } = createTransportStub();
		catalog.updateCanvasTemplate.mockRejectedValueOnce(new Error('Update failed'));
		const model = createEditTemplatePageModel({ transport });
		await model.load('t-1');
		model.name = 'Valid';

		const result = await model.save();

		expect(result).toBe(false);
		expect(model.errorMessage).toBe('Update failed');
	});
});
