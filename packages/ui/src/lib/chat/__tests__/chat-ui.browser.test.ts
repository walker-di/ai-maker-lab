import { render } from 'vitest-browser-svelte';
import { describe, expect, test } from 'vitest';
import ComposerFixture from './ComposerFixture.svelte';
import MessageFixture from './MessageFixture.svelte';
import ConversationFixture from './ConversationFixture.svelte';
import ThreadListFixture from './ThreadListFixture.svelte';
import AgentPanelFixture from './AgentPanelFixture.svelte';
import ToolInvocationFixture from './ToolInvocationFixture.svelte';
import SubthreadFixture from './SubthreadFixture.svelte';

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

		await expect.element(screen.getByRole('button', { name: 'Coder' })).toBeVisible();
		await expect(screen.getByTestId('composer-fixture')).toMatchScreenshot(
			'composer-agent-selected',
		);
	});

	test('agent dropdown opens on click', async () => {
		const screen = render(ComposerFixture);

		const agentButton = screen.getByRole('button', { name: 'Auto' });
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

	test('assistant message renders markdown content', async () => {
		const screen = render(MessageFixture, { variant: 'assistant-markdown' });

		await expect.element(screen.getByRole('heading', { name: 'Build plan' })).toBeVisible();
		await expect.element(screen.getByRole('link', { name: 'Cursor' })).toBeVisible();
		await expect.element(screen.getByText('bun test')).toBeVisible();
		await expect(screen.getByTestId('messages-fixture')).toMatchScreenshot(
			'message-assistant-markdown',
		);
	});

	test('assistant message renders generated image parts', async () => {
		const screen = render(MessageFixture, { variant: 'assistant-rich' });

		await expect.element(screen.getByText("Here's the generated image.")).toBeVisible();
		await expect.element(screen.getByAltText('Generated eyecatch')).toBeVisible();
	});

	test('assistant message keeps long content contained', async () => {
		const screen = render(MessageFixture, { variant: 'assistant-overflow' });

		await expect.element(screen.getByText(/Visit https:\/\/example\.com/)).toBeVisible();
		await expect(screen.getByTestId('messages-fixture')).toMatchScreenshot(
			'message-assistant-overflow',
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

	test('attachment pills become buttons when preview is enabled', async () => {
		const screen = render(MessageFixture, { variant: 'with-attachments', previewable: true });

		await expect.element(
			screen.getByRole('button', { name: 'Preview screenshot.png' }),
		).toBeVisible();
	});

	test('assistant message renders tool invocation pills', async () => {
		const screen = render(ToolInvocationFixture);

		await expect.element(screen.getByRole('button', { name: /Inspect Web Search/i })).toBeVisible();
		await expect.element(screen.getByText('1 result')).toBeVisible();
	});

	test('tool invocation dialog renders tool-specific sections', async () => {
		const screen = render(ToolInvocationFixture, { openDialog: true });

		await expect.element(screen.getByRole('heading', { name: 'Web Search' })).toBeVisible();
		await expect.element(screen.getByRole('link', { name: 'https://wise.com' })).toBeVisible();
		await expect.element(screen.getByText('"results": [').nth(0)).toBeVisible();

		await screen.getByTestId('tool-dialog-raw-toggle').click();
		await expect.element(screen.getByText('"toolName": "web_search"').nth(0)).toBeVisible();
	});

	test('image generation dialog renders preview from persisted base64 output payloads', async () => {
		const screen = render(ToolInvocationFixture, {
			openDialog: true,
			variant: 'image-generation',
		});

		await expect.element(screen.getByRole('heading', { name: 'Image Generation' })).toBeVisible();
		const preview = screen.getByRole('img', { name: 'Image Generation preview' });
		await expect.element(preview).toBeVisible();
		await expect.element(screen.getByText('[image/png base64 payload omitted (92 chars)]').nth(0)).toBeVisible();

		await screen.getByTestId('tool-dialog-raw-toggle').click();
		await expect.element(screen.getByText('"toolName": "image_generation"').nth(0)).toBeVisible();
	});

	test('tool invocation dialog in error state surfaces the tool error banner and error badge', async () => {
		const screen = render(ToolInvocationFixture, {
			openDialog: true,
			variant: 'error',
		});

		await expect.element(screen.getByRole('heading', { name: 'Image Generation' })).toBeVisible();
		await expect.element(screen.getByText('Tool error')).toBeVisible();
		await expect.element(
			screen.getByText('Image generation failed: policy violation.').nth(0),
		).toBeVisible();
		await expect.element(screen.getByText('error', { exact: true }).nth(0)).toBeVisible();
	});

	test('tool invocation dialog in approval-requested state shows the needs-approval badge', async () => {
		const screen = render(ToolInvocationFixture, {
			openDialog: true,
			variant: 'approval-requested',
		});

		await expect.element(screen.getByRole('heading', { name: 'Web Fetch' })).toBeVisible();
		await expect.element(screen.getByText('needs approval', { exact: true })).toBeVisible();
		await expect.element(
			screen.getByRole('link', { name: 'https://internal.example.com/reports/q1' }),
		).toBeVisible();
	});

	test('non-image tool dialog renders Query, Sources, and readable Output/Raw JSON', async () => {
		const screen = render(ToolInvocationFixture, { openDialog: true });

		await expect.element(screen.getByRole('heading', { name: 'Web Search' })).toBeVisible();
		await expect.element(screen.getByText('current dollar real rate').nth(0)).toBeVisible();
		await expect.element(
			screen.getByRole('link', { name: 'https://wise.com' }),
		).toBeVisible();
		await expect.element(
			screen.getByText('USD to BRL market rate overview.').nth(0),
		).toBeVisible();
		await expect.element(screen.getByTestId('tool-dialog-output')).toBeVisible();
		await screen.getByTestId('tool-dialog-raw-toggle').click();
		await expect.element(screen.getByTestId('tool-dialog-raw')).toBeVisible();
		await expect.element(screen.getByText('"title": "Wise exchange rate"').nth(0)).toBeVisible();
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

describe('subthread UI', () => {
	test('thread preview renders reply count and latest reply text', async () => {
		const screen = render(SubthreadFixture, { variant: 'preview' });

		await expect.element(screen.getByText('3 replies')).toBeVisible();
		await expect.element(screen.getByText(/split the deployment step/i)).toBeVisible();
	});

	test('thread panel renders empty state', async () => {
		const screen = render(SubthreadFixture, { variant: 'panel-empty' });

		await expect.element(screen.getByText('No replies yet')).toBeVisible();
		await expect.element(screen.getByText('Reply composer goes here')).toBeVisible();
	});

	test('thread panel renders the parent message, replies, and count when variant=panel-replies', async () => {
		const screen = render(SubthreadFixture, { variant: 'panel-replies' });

		await expect.element(
			screen.getByText('Can you review the deployment pipeline changes?'),
		).toBeVisible();
		await expect.element(
			screen.getByText(/separate build and deploy/i),
		).toBeVisible();
		await expect.element(
			screen.getByText(/I.{1,5}ll break that out/i),
		).toBeVisible();
		await expect.element(screen.getByText('2 replies')).toBeVisible();
		await expect.element(screen.getByText('Research Analyst')).toBeVisible();
		await expect.element(screen.getByText('Reply composer goes here')).toBeVisible();
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
