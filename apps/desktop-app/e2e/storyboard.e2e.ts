import { expect, test } from '@playwright/test';

const now = '2026-01-01T00:00:00.000Z';

test.describe('AI Storyboard Maker', () => {
	test('creates a storyboard and runs a mocked frame workflow', async ({ page }) => {
		let storyboard = {
			id: 'story-1',
			name: 'Launch storyboard',
			frameCount: 0,
			createdAt: now,
			updatedAt: now,
			frames: [] as Array<Record<string, unknown>>,
		};

		await page.route('**/api/marketing/storyboards', async (route, request) => {
			if (request.method() === 'GET') {
				return route.fulfill({ json: storyboard.frames.length ? [{ ...storyboard, frames: undefined }] : [] });
			}
			const body = await request.postDataJSON();
			storyboard = { ...storyboard, name: body.name };
			return route.fulfill({ status: 201, json: { ...storyboard, frames: undefined } });
		});

		await page.route('**/api/marketing/storyboards/story-1', async (route) => {
			return route.fulfill({ json: storyboard });
		});

		await page.route('**/api/marketing/storyboards/story-1/frames/generate', async (route) => {
			storyboard = {
				...storyboard,
				frameCount: 1,
				frames: [{
					id: 'frame-1', storyboardId: 'story-1', sceneId: 'frame-1', orderIndex: 0,
					title: 'Opening', narration: 'Open on the product', durationMs: 2000, mainImagePrompt: 'Hero product',
					backgroundImagePrompt: 'Studio background', bgmPrompt: 'Upbeat music',
					transitionTypeAfter: 'none', transitionDurationMs: 1000, createdAt: now, updatedAt: now,
				}],
			};
			return route.fulfill({ status: 201, json: storyboard });
		});

		await page.route('**/api/marketing/storyboards/story-1/frames/frame-1/transition', async (route) => {
			storyboard.frames[0] = { ...storyboard.frames[0], transitionTypeAfter: 'fade', transitionDurationMs: 1500 };
			return route.fulfill({ json: storyboard.frames[0] });
		});

		await page.route('**/api/marketing/storyboards/story-1/frames/frame-1/generate-asset', async (route) => {
			storyboard.frames[0] = { ...storyboard.frames[0], mainImageUrl: '/mock-image.png' };
			return route.fulfill({ json: storyboard.frames[0] });
		});

		await page.route('**/api/marketing/storyboards/story-1/export-video', async (route) => {
			return route.fulfill({ json: { videoPath: '/mock-video.mp4', durationMs: 5000 } });
		});

		await page.goto('/experiments/storyboard');
		await expect(page.getByRole('heading', { name: 'AI Storyboard Maker' })).toBeVisible();
		await page.getByRole('button', { name: 'Create storyboard' }).click();
		await page.getByLabel('Name').fill('Launch storyboard');
		await page.getByRole('button', { name: 'Create', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Launch storyboard' })).toBeVisible();

		await page.getByRole('button', { name: 'Generate frames' }).first().click();
		await page.getByLabel('Prompt').fill('Launch a new product');
		await page.getByRole('button', { name: 'Generate', exact: true }).click();
		await expect(page.getByText('1 frames')).toBeVisible();
		await expect(page.getByText('Frame 1')).toBeVisible();
		await expect(page.getByLabel('Title')).toHaveValue('Opening');
		await expect(page.getByLabel('Narration')).toHaveValue('Open on the product');
		await expect(page.getByLabel('Main image prompt')).toHaveValue('Hero product');
		await expect(page.getByText('No frames yet')).toHaveCount(0);
		await expect(page.getByText(/Missing 'title'/)).toHaveCount(0);
		await page.screenshot({ path: 'e2e/.tmp/storyboard-generate-frames-success.png', fullPage: true });

		await page.getByRole('button', { name: 'Generate main image' }).click();
		await expect(page.getByAltText('Main frame')).toBeVisible();

		await page.getByLabel('Transition after frame').fill('fade');
		await page.getByLabel('Duration ms').fill('1500');
		await page.getByRole('button', { name: 'Save transition' }).click();

		await page.getByRole('button', { name: 'Export video' }).click();
		await expect(page.getByText('Export complete.')).toBeVisible();
	});
});
