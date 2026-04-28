import { render } from 'vitest-browser-svelte';
import { describe, expect, test, vi } from 'vitest';
import StoryboardList from '../StoryboardList.svelte';
import StoryboardFrameCard from '../StoryboardFrameCard.svelte';

const frame = {
	id: 'frame-1',
	storyboardId: 'story-1',
	sceneId: 'frame-1',
	orderIndex: 0,
	narration: 'Open on the product.',
	mainImagePrompt: 'Hero product image',
	backgroundImagePrompt: 'Studio background',
	bgmPrompt: 'Upbeat music',
	transitionTypeAfter: 'none' as const,
	transitionDurationMs: 1000,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Storyboard UI', () => {
	test('renders empty state with accessible create action', async () => {
		const onCreate = vi.fn();
		const screen = render(StoryboardList, { storyboards: [], onOpen: vi.fn(), onCreate });
		await expect.element(screen.getByText('No storyboards yet')).toBeVisible();
		await screen.getByRole('button', { name: 'Create storyboard' }).click();
		expect(onCreate).toHaveBeenCalledOnce();
	});

	test('renders frame controls with accessible labels', async () => {
		const screen = render(StoryboardFrameCard, {
			frame,
			onSaveText: vi.fn(),
			onReorder: vi.fn(),
			onDelete: vi.fn(),
			onRegeneratePrompt: vi.fn(),
			onGenerateAsset: vi.fn(),
			onUpdateTransition: vi.fn(),
		});
		await expect.element(screen.getByLabelText('Narration')).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Generate main image' })).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Save transition' })).toBeVisible();
	});
});
