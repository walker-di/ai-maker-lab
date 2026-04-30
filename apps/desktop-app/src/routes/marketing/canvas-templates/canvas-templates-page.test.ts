import { describe, expect, test, vi } from 'vitest';
import { createCanvasTemplatesPageModel } from './canvas-templates-page.svelte';
import type { MarketingTransport } from '$lib/adapters/marketing/create-marketing-transport';
import type { CanvasTemplate } from '$lib/adapters/marketing/MarketingTransport';

function makeTemplate(id: string, name: string): CanvasTemplate {
	const now = '2026-01-01T00:00:00.000Z';
	return {
		id,
		name,
		description: `${name} template`,
		aspectRatio: '16:9',
		canvasData: '{}',
		previewUrl: undefined,
		tags: [],
		isDefault: false,
		createdAt: now,
		updatedAt: now,
	};
}

function createTransportStub(templates: CanvasTemplate[] = [makeTemplate('t-1', 'Intro')]) {
	const state = { templates: [...templates] };

	const catalog = {
		listCanvasTemplates: vi.fn(async () => [...state.templates]),
		deleteCanvasTemplate: vi.fn(async (id: string) => {
			state.templates = state.templates.filter((t) => t.id !== id);
		}),
		duplicateCanvasTemplate: vi.fn(async (id: string) => {
			const original = state.templates.find((t) => t.id === id);
			if (!original) throw new Error('Not found');
			const copy = makeTemplate(`t-${state.templates.length + 1}`, `${original.name} (copy)`);
			state.templates.push(copy);
			return copy;
		}),
	};

	const transport = { catalog } as unknown as MarketingTransport;
	return { state, catalog, transport };
}

describe('canvas templates page model', () => {
	test('loadInitial() populates templates', async () => {
		const { transport } = createTransportStub([makeTemplate('t-1', 'A'), makeTemplate('t-2', 'B')]);
		const model = createCanvasTemplatesPageModel({ transport });

		await model.loadInitial();

		expect(model.templates).toHaveLength(2);
		expect(model.hasTemplates).toBe(true);
		expect(model.hasLoaded).toBe(true);
	});

	test('deleteTemplate() removes and refreshes', async () => {
		const { catalog, transport } = createTransportStub([makeTemplate('t-1', 'A'), makeTemplate('t-2', 'B')]);
		const model = createCanvasTemplatesPageModel({ transport });
		await model.loadInitial();

		await model.deleteTemplate('t-1');

		expect(catalog.deleteCanvasTemplate).toHaveBeenCalledWith('t-1');
		expect(model.templates.map((t) => t.id)).toEqual(['t-2']);
	});

	test('duplicateTemplate() calls transport and refreshes', async () => {
		const { catalog, transport } = createTransportStub([makeTemplate('t-1', 'A')]);
		const model = createCanvasTemplatesPageModel({ transport });
		await model.loadInitial();

		await model.duplicateTemplate('t-1');

		expect(catalog.duplicateCanvasTemplate).toHaveBeenCalledWith('t-1');
		expect(model.templates).toHaveLength(2);
	});

	test('loadInitial() error sets errorMessage', async () => {
		const { catalog, transport } = createTransportStub();
		catalog.listCanvasTemplates.mockRejectedValueOnce(new Error('Network error'));
		const model = createCanvasTemplatesPageModel({ transport });

		await model.loadInitial();

		expect(model.errorMessage).toBe('Network error');
		expect(model.hasLoaded).toBe(true);
	});
});
