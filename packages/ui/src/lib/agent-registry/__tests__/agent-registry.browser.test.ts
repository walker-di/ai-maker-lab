import { render } from 'vitest-browser-svelte';
import { describe, expect, test } from 'vitest';
import AgentRegistryFixture from './AgentRegistryFixture.svelte';

describe('Agent registry UI', () => {
	test('renders filters, duplicated badge, warnings, and actions', async () => {
		const screen = render(AgentRegistryFixture);

		await expect.element(screen.getByPlaceholder('Search by name or description')).toBeVisible();
		await expect.element(screen.getByRole('heading', { name: 'Research Copy' })).toBeVisible();

		const editableSection = screen.getByTestId('editable-agent-section');
		await expect.element(editableSection.getByText('Detached copy of a system agent.')).toBeVisible();
		await expect.element(
			editableSection.getByText('Some hosted tools may fall back depending on runtime support.'),
		).toBeVisible();

		await expect.element(screen.getByText('Use in Chat')).toBeVisible();
		await expect.element(screen.getByText('Save Changes')).toBeVisible();
	});

	test('editable agent shows tool toggle switches with on/off labels', async () => {
		const screen = render(AgentRegistryFixture);

		const section = screen.getByTestId('editable-agent-section');
		const enabledToggle = section.getByTestId('tool-toggle-web_search');
		const disabledToggle = section.getByTestId('tool-toggle-web_fetch');

		await expect.element(enabledToggle).toBeVisible();
		await expect.element(disabledToggle).toBeVisible();

		await expect.element(enabledToggle.getByText('On')).toBeVisible();
		await expect.element(disabledToggle.getByText('Off')).toBeVisible();

		const enabledSwitch = enabledToggle.getByRole('switch');
		const disabledSwitch = disabledToggle.getByRole('switch');

		await expect.element(enabledSwitch).not.toBeDisabled();
		await expect.element(disabledSwitch).not.toBeDisabled();
	});

	test('read-only agent renders tool switches as disabled', async () => {
		const screen = render(AgentRegistryFixture);

		const readonlySection = screen.getByTestId('readonly-agent-section');
		const switches = readonlySection.getByRole('switch');

		await expect.element(switches.first()).toBeDisabled();
	});
});
