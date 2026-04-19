<script lang="ts">
	import SettingsProviderKeyList from '../SettingsProviderKeyList.svelte';
	import SettingsRestartHint from '../SettingsRestartHint.svelte';
	import type {
		SettingsCopy,
		SettingsProviderId,
		SettingsProviderKeyStatus,
		SettingsProviderLabel,
		SettingsProviderValidation,
	} from '../types.js';

	const copy: SettingsCopy = {
		placeholder: 'Paste API key',
		showLabel: 'Show value',
		hideLabel: 'Hide value',
		clearLabel: 'Clear value',
		statusSetInFile: 'Set (file)',
		statusSetInShell: 'Set (shell)',
		statusUnset: 'Not set',
		validationOk: 'Valid',
		validationInvalid: 'Invalid',
		validationUnverified: 'Unverified',
		shellOverrideHint:
			'This key is exported by your shell and overrides any value stored in the secrets file.',
	};

	const providers: SettingsProviderLabel[] = [
		{ provider: 'openai', label: 'OpenAI', description: 'Used for GPT-4.1, GPT-5 models.' },
		{ provider: 'anthropic', label: 'Anthropic', description: 'Used for Claude models.' },
		{ provider: 'gemini', label: 'Google Gemini', description: 'Used for Gemini 2.5 / 3.1 models.' },
	];

	const statuses: SettingsProviderKeyStatus[] = [
		{ provider: 'openai', isSet: true, source: 'file', preview: 'sk-...abcd' },
		{ provider: 'anthropic', isSet: true, source: 'shell', preview: 'sk-...wxyz' },
		{ provider: 'gemini', isSet: false, source: 'unset', preview: null },
	];

	let drafts = $state<Partial<Record<SettingsProviderId, string>>>({});
	let validations = $state<Partial<Record<SettingsProviderId, SettingsProviderValidation>>>({
		openai: { status: 'invalid', message: 'API returned 401 Unauthorized' },
	});

	function onChange(provider: SettingsProviderId, value: string) {
		drafts = { ...drafts, [provider]: value };
	}

	function onClear(provider: SettingsProviderId) {
		const next = { ...drafts };
		delete next[provider];
		drafts = next;
	}
</script>

<div
	class="dark bg-background text-foreground space-y-6 p-6"
	data-testid="settings-fixture"
	style="width: 420px; font-family: system-ui, sans-serif;"
>
	<SettingsProviderKeyList
		{providers}
		{statuses}
		{drafts}
		{validations}
		{copy}
		onChange={onChange}
		onClear={onClear}
	/>

	<SettingsRestartHint
		title="Web mode is read-only"
		description="Settings can only be edited from the desktop app."
	/>
</div>
