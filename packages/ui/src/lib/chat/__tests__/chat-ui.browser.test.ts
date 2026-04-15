import { render } from 'vitest-browser-svelte';
import { describe, expect, test } from 'vitest';
import ComposerFixture from './ComposerFixture.svelte';
import MessageFixture from './MessageFixture.svelte';
import ConversationFixture from './ConversationFixture.svelte';
import ThreadListFixture from './ThreadListFixture.svelte';
import AgentPanelFixture from './AgentPanelFixture.svelte';

describe('ChatComposer', () => {
	test('default state with placeholder and toolbar', async () => {
		const screen = render(ComposerFixture);

		await expect.element(screen.getByRole('textbox')).toBeVisible();
		await expect(screen.getByTestId('composer-fixture')).toMatchScreenshot(
			'composer-default',
		);
	});

	test('with typed draft and send enabled', async () => {
		const screen = render(ComposerFixture, {
			draft: 'Help me write a sorting function',
			canSend: true,
		});

		await expect.element(screen.getByRole('textbox')).toHaveValue(
			'Help me write a sorting function',
		);
		await expect(screen.getByTestId('composer-fixture')).toMatchScreenshot(
			'composer-with-draft',
		);
	});

	test('disabled while streaming', async () => {
		const screen = render(ComposerFixture, {
			draft: '',
			isSending: true,
			canSend: false,
		});

		await expect.element(screen.getByRole('textbox')).toBeVisible();
		await expect(screen.getByTestId('composer-fixture')).toMatchScreenshot(
			'composer-sending',
		);
	});

	test('agent selector shows agent name', async () => {
		const screen = render(ComposerFixture, {
			selectedAgentName: 'Coder',
		});

		await expect.element(screen.getByText('Coder')).toBeVisible();
		await expect(screen.getByTestId('composer-fixture')).toMatchScreenshot(
			'composer-agent-selected',
		);
	});

	test('agent dropdown opens on click', async () => {
		const screen = render(ComposerFixture);

		const agentButton = screen.getByText('Auto');
		await agentButton.click();

		await expect.element(screen.getByText('GPT-4o')).toBeVisible();
		await expect(screen.getByTestId('composer-fixture')).toMatchScreenshot(
			'composer-agent-dropdown-open',
		);
	});
});

describe('ChatMessageBubble', () => {
	test('user message', async () => {
		const screen = render(MessageFixture, { variant: 'user' });

		await expect.element(
			screen.getByText('Hello! Can you help me write a function that sorts an array?'),
		).toBeVisible();
		await expect(screen.getByTestId('messages-fixture')).toMatchScreenshot(
			'message-user',
		);
	});

	test('assistant message with agent chip', async () => {
		const screen = render(MessageFixture, { variant: 'assistant' });

		await expect.element(screen.getByText('Coder')).toBeVisible();
		await expect(screen.getByTestId('messages-fixture')).toMatchScreenshot(
			'message-assistant',
		);
	});

	test('streaming message with cursor', async () => {
		const screen = render(MessageFixture, { variant: 'streaming' });

		await expect.element(screen.getByText(/Let me think/)).toBeVisible();
		await expect(screen.getByTestId('messages-fixture')).toMatchScreenshot(
			'message-streaming',
		);
	});

	test('failed message', async () => {
		const screen = render(MessageFixture, { variant: 'failed' });

		await expect.element(screen.getByText('Message failed to send.')).toBeVisible();
		await expect(screen.getByTestId('messages-fixture')).toMatchScreenshot(
			'message-failed',
		);
	});

	test('message with attachments', async () => {
		const screen = render(MessageFixture, { variant: 'with-attachments' });

		await expect.element(screen.getByText('screenshot.png')).toBeVisible();
		await expect.element(screen.getByText('report.pdf')).toBeVisible();
		await expect(screen.getByTestId('messages-fixture')).toMatchScreenshot(
			'message-with-attachments',
		);
	});
});

describe('conversation thread', () => {
	test('multi-turn conversation renders correctly', async () => {
		const screen = render(ConversationFixture);

		await expect.element(
			screen.getByText('Hello! Can you help me write a function that sorts an array?'),
		).toBeVisible();
		await expect.element(screen.getByText(/custom comparator/)).toBeVisible();
		await expect(screen.getByTestId('conversation-fixture')).toMatchScreenshot(
			'conversation-multi-turn',
		);
	});
});

describe('ChatThreadListItem', () => {
	test('thread list with active item', async () => {
		const screen = render(ThreadListFixture);

		await expect.element(screen.getByText('Sorting algorithm help')).toBeVisible();
		await expect.element(screen.getByText('Design system review')).toBeVisible();
		await expect.element(screen.getByText('API integration questions')).toBeVisible();
		await expect(screen.getByTestId('thread-list-fixture')).toMatchScreenshot(
			'thread-list',
		);
	});
});

describe('ChatAgentListItem & ChatAgentCard', () => {
	test('agent roster list', async () => {
		const screen = render(AgentPanelFixture);

		await expect.element(screen.getByText('Auto', { exact: true })).toBeVisible();
		await expect.element(screen.getByText('My Research Bot')).toBeVisible();
		await expect(screen.getByTestId('agent-panel-fixture')).toMatchScreenshot(
			'agent-list',
		);
	});

	test('agent roster with detail card', async () => {
		const screen = render(AgentPanelFixture, { showCard: true });

		await expect.element(screen.getByText('Use')).toBeVisible();
		await expect.element(screen.getByText('Duplicate')).toBeVisible();
		await expect(screen.getByTestId('agent-panel-fixture')).toMatchScreenshot(
			'agent-list-with-card',
		);
	});
});
