import { describe, expect, test, vi } from 'vitest';
import { createNewTemplatePageModel } from './canvas-template-new-page.svelte';
import type { MarketingTransport } from '$lib/adapters/marketing/create-marketing-transport';

function createTransportStub() {
	const catalog = {
		createCanvasTemplate: vi.fn(async (data: object) => ({
			id: 't-new',
			...data,
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z',
		})),
	};

	const transport = { catalog } as unknown as MarketingTransport;
	return { catalog, transport };
}

describe('new canvas template page model', () => {
	test('isValid is false when name is empty', () => {
		const { transport } = createTransportStub();
		const model = createNewTemplatePageModel({ transport });

		expect(model.isValid).toBe(false);
	});

	test('isValid is true when name is set', () => {
		const { transport } = createTransportStub();
		const model = createNewTemplatePageModel({ transport });
		model.name = 'My Template';

		expect(model.isValid).toBe(true);
	});

	test('save() fails with error when name is empty', async () => {
		const { catalog, transport } = createTransportStub();
		const model = createNewTemplatePageModel({ transport });

		const result = await model.save();

		expect(result).toBe(false);
		expect(model.errorMessage).toBe('Template name is required.');
		expect(catalog.createCanvasTemplate).not.toHaveBeenCalled();
	});

	test('save() calls createCanvasTemplate with correct DTO', async () => {
		const { catalog, transport } = createTransportStub();
		const model = createNewTemplatePageModel({ transport });
		model.name = 'Intro Template';
		model.description = 'A nice template';
		model.aspectRatio = '16:9';
		model.updateCanvasData('{"objects":[]}');

		const result = await model.save();

		expect(result).toBe(true);
		expect(catalog.createCanvasTemplate).toHaveBeenCalledWith({
			name: 'Intro Template',
			description: 'A nice template',
			aspectRatio: '16:9',
			canvasData: '{"objects":[]}',
			tags: [],
		});
	});

	test('save() sets errorMessage on transport failure', async () => {
		const { catalog, transport } = createTransportStub();
		catalog.createCanvasTemplate.mockRejectedValueOnce(new Error('Server error'));
		const model = createNewTemplatePageModel({ transport });
		model.name = 'Test';

		const result = await model.save();

		expect(result).toBe(false);
		expect(model.errorMessage).toBe('Server error');
	});
});
