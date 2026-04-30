import { describe, expect, test, vi } from 'vitest';
import { createEditTemplatePageModel } from './canvas-template-edit-page.svelte';
import type { MarketingTransport } from '$lib/adapters/marketing/create-marketing-transport';
import type { CanvasTemplate } from '$lib/adapters/marketing/MarketingTransport';

function makeTemplate(overrides: Partial<CanvasTemplate> = {}): CanvasTemplate {
	return {
		id: 't-1',
		name: 'Existing Template',
		description: 'Desc',
		aspectRatio: '16:9',
		canvasData: '{"objects":[]}',
		previewUrl: undefined,
		tags: ['marketing'],
		isDefault: false,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...overrides,
	};
}

function createTransportStub(template = makeTemplate()) {
	const catalog = {
		getCanvasTemplate: vi.fn(async () => template),
		updateCanvasTemplate: vi.fn(async (id: string, data: object) => ({
			...template,
			...data,
			updatedAt: '2026-01-02T00:00:00.000Z',
		})),
	};
	const transport = { catalog } as unknown as MarketingTransport;
	return { catalog, transport };
}

describe('edit canvas template page model', () => {
	test('loadTemplate() populates state from transport', async () => {
		const { transport } = createTransportStub();
		const model = createEditTemplatePageModel({ transport });

		await model.loadTemplate('t-1');

		expect(model.name).toBe('Existing Template');
		expect(model.description).toBe('Desc');
		expect(model.aspectRatio).toBe('16:9');
		expect(model.canvasData).toBe('{"objects":[]}');
		expect(model.isLoading).toBe(false);
	});

	test('loadTemplate() sets error on failure', async () => {
		const { catalog, transport } = createTransportStub();
		catalog.getCanvasTemplate.mockRejectedValueOnce(new Error('Not found'));
		const model = createEditTemplatePageModel({ transport });

		await model.loadTemplate('t-invalid');

		expect(model.errorMessage).toBe('Not found');
	});

	test('save() calls updateCanvasTemplate with correct DTO', async () => {
		const { catalog, transport } = createTransportStub();
		const model = createEditTemplatePageModel({ transport });
		await model.loadTemplate('t-1');
		model.name = 'Updated Name';
		model.updateCanvasData('{"objects":[{"type":"rect"}]}');

		const result = await model.save();

		expect(result).toBe(true);
		expect(catalog.updateCanvasTemplate).toHaveBeenCalledWith('t-1', {
			name: 'Updated Name',
			description: 'Desc',
			aspectRatio: '16:9',
			canvasData: '{"objects":[{"type":"rect"}]}',
			tags: ['marketing'],
		});
	});

	test('save() fails with error when name is empty', async () => {
		const { catalog, transport } = createTransportStub();
		const model = createEditTemplatePageModel({ transport });
		await model.loadTemplate('t-1');
		model.name = '';

		const result = await model.save();

		expect(result).toBe(false);
		expect(model.errorMessage).toBe('Template name is required.');
		expect(catalog.updateCanvasTemplate).not.toHaveBeenCalled();
	});
});
