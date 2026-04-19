import { render } from 'vitest-browser-svelte';
import { describe, expect, test } from 'vitest';
import SettingsFixture from './SettingsFixture.svelte';

describe('Settings UI', () => {
	test('renders one row per provider with the correct source badge', async () => {
		const screen = render(SettingsFixture);

		const openaiStatus = screen.getByTestId('settings-status-openai');
		const anthropicStatus = screen.getByTestId('settings-status-anthropic');
		const geminiStatus = screen.getByTestId('settings-status-gemini');

		await expect.element(openaiStatus.getByText('Set (file)')).toBeVisible();
		await expect.element(anthropicStatus.getByText('Set (shell)')).toBeVisible();
		await expect.element(geminiStatus.getByText('Not set')).toBeVisible();

		await expect(screen.getByTestId('settings-fixture')).toMatchScreenshot(
			'settings-providers-default',
		);
	});

	test('shell-set keys disable the input and show the override hint', async () => {
		const screen = render(SettingsFixture);

		const anthropicInput = screen.getByTestId('settings-input-anthropic');
		await expect.element(anthropicInput).toBeDisabled();

		await expect
			.element(
				screen.getByText(
					'This key is exported by your shell and overrides any value stored in the secrets file.',
				),
			)
			.toBeVisible();

		await expect(screen.getByTestId('settings-fixture')).toMatchScreenshot(
			'settings-shell-locked',
		);
	});

	test('show/hide toggle flips the input type between password and text', async () => {
		const screen = render(SettingsFixture);

		const openaiInput = screen.getByTestId('settings-input-openai');
		const reveal = screen.getByTestId('settings-reveal-openai');

		await expect.element(openaiInput).toHaveAttribute('type', 'password');
		await reveal.click();
		await expect.element(openaiInput).toHaveAttribute('type', 'text');

		await expect(screen.getByTestId('settings-fixture')).toMatchScreenshot(
			'settings-key-revealed',
		);

		await reveal.click();
		await expect.element(openaiInput).toHaveAttribute('type', 'password');
	});

	test('invalid validation surfaces a destructive badge and message', async () => {
		const screen = render(SettingsFixture);

		const validationBadge = screen.getByTestId('settings-validation-openai');
		await expect.element(validationBadge.getByText('Invalid')).toBeVisible();
		await expect.element(screen.getByText('API returned 401 Unauthorized')).toBeVisible();

		await expect(screen.getByTestId('settings-fixture')).toMatchScreenshot(
			'settings-validation-invalid',
		);
	});

	test('restart hint card renders for the web-mode notice', async () => {
		const screen = render(SettingsFixture);
		await expect.element(screen.getByText('Web mode is read-only')).toBeVisible();

		await expect(screen.getByTestId('settings-fixture')).toMatchScreenshot(
			'settings-restart-hint',
		);
	});
});
