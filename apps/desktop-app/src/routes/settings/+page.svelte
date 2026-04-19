<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import {
		Button,
		SettingsProviderKeyList,
		SettingsRestartHint,
		Tooltip,
		type SettingsCopy,
		type SettingsProviderId,
		type SettingsProviderLabel,
	} from 'ui/source';
	import { createSettingsPage } from './settings-page.composition';

	const model = createSettingsPage();

	const providers: SettingsProviderLabel[] = [
		{
			provider: 'openai',
			label: m.settings_provider_openai_label(),
			description: m.settings_provider_openai_description(),
		},
		{
			provider: 'anthropic',
			label: m.settings_provider_anthropic_label(),
			description: m.settings_provider_anthropic_description(),
		},
		{
			provider: 'gemini',
			label: m.settings_provider_gemini_label(),
			description: m.settings_provider_gemini_description(),
		},
	];

	const copy = $derived<SettingsCopy>({
		placeholder: m.settings_input_placeholder(),
		showLabel: m.settings_show(),
		hideLabel: m.settings_hide(),
		clearLabel: m.settings_clear(),
		statusSetInFile: m.settings_status_set_in_file(),
		statusSetInShell: m.settings_status_set_in_shell(),
		statusUnset: m.settings_status_unset(),
		validationOk: m.settings_validation_ok(),
		validationInvalid: m.settings_validation_invalid(),
		validationUnverified: m.settings_validation_unverified(),
		shellOverrideHint: m.settings_shell_override_hint(),
	});

	const isWeb = $derived(model.mode === 'web');
	const saveLabel = $derived(model.isSaving ? m.settings_saving() : m.settings_save());
	const outcomeMessage = $derived.by(() => {
		const outcome = model.lastSaveOutcome;
		if (!outcome) return null;
		switch (outcome.kind) {
			case 'success':
				return { tone: 'success' as const, text: m.settings_saved() };
			case 'mixed':
				return { tone: 'warning' as const, text: m.settings_saved_with_invalid() };
			case 'failed':
				return { tone: 'error' as const, text: outcome.reason || m.settings_save_failed() };
			default:
				return null;
		}
	});

	function onChange(provider: SettingsProviderId, value: string) {
		model.setDraft(provider, value);
	}

	function onClear(provider: SettingsProviderId) {
		model.clearDraft(provider);
	}

	function onSave() {
		void model.save();
	}
</script>

<svelte:head>
	<title>{m.settings_page_title()}</title>
</svelte:head>

<Tooltip.Provider>
	<div class="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-10 lg:px-8">
		<section class="space-y-3">
			<p class="text-muted-foreground text-sm font-medium uppercase tracking-wide">
				{m.settings_section_label()}
			</p>
			<h1 class="text-3xl font-semibold tracking-tight">{m.settings_page_title()}</h1>
			<p class="text-muted-foreground text-base leading-7">{m.settings_intro()}</p>
		</section>

		{#if isWeb}
			<SettingsRestartHint
				title={m.settings_web_mode_title()}
				description={m.settings_web_mode_description()}
			/>
		{:else}
			{#if model.errorMessage}
				<div
					class="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
					role="alert"
				>
					<span>{model.errorMessage}</span>
					<Button variant="ghost" size="sm" onclick={() => model.dismissError()}>
						{m.settings_dismiss()}
					</Button>
				</div>
			{/if}

			{#if outcomeMessage}
				<div
					class="rounded-xl border px-4 py-3 text-sm {outcomeMessage.tone === 'success'
						? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
						: outcomeMessage.tone === 'warning'
							? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200'
							: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300'}"
					role="status"
					data-testid="settings-save-outcome"
				>
					{outcomeMessage.text}
				</div>
			{/if}

			<section class="rounded-2xl border p-6">
				{#if model.isLoading && !model.hasLoaded}
					<p class="text-muted-foreground text-sm">{m.settings_loading()}</p>
				{:else}
					<SettingsProviderKeyList
						{providers}
						statuses={model.statuses}
						drafts={model.drafts}
						validations={model.validations}
						{copy}
						isSaving={model.isSaving}
						{onChange}
						{onClear}
					/>
				{/if}
			</section>

			<div class="flex justify-end gap-2">
				<Button onclick={onSave} disabled={!model.hasDirtyDraft || model.isSaving}>
					{saveLabel}
				</Button>
			</div>
		{/if}
	</div>
</Tooltip.Provider>
