<script lang="ts">
	import * as InputGroup from '$ui/components/ui/input-group/index.js';
	import * as Field from '$ui/components/ui/field/index.js';
	import { Button } from '$ui/components/ui/button/index.js';
	import { Badge } from '$ui/components/ui/badge/index.js';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import XIcon from '@lucide/svelte/icons/x';
	import type {
		SettingsCopy,
		SettingsProviderId,
		SettingsProviderKeyStatus,
		SettingsProviderValidation,
	} from './types.js';

	interface Props {
		provider: SettingsProviderId;
		label: string;
		description?: string;
		status: SettingsProviderKeyStatus;
		draft: string | undefined;
		validation: SettingsProviderValidation;
		copy: SettingsCopy;
		isSaving?: boolean;
		onChange: (value: string) => void;
		onClear: () => void;
	}

	let {
		provider,
		label,
		description,
		status,
		draft,
		validation,
		copy,
		isSaving = false,
		onChange,
		onClear,
	}: Props = $props();

	let isRevealed = $state(false);

	const inputId = $derived(`settings-key-${provider}`);
	const isShellLocked = $derived(status.source === 'shell');
	const hasDraft = $derived(draft !== undefined);
	const inputValue = $derived(hasDraft ? (draft ?? '') : '');
	const placeholder = $derived(
		status.preview && !hasDraft ? `${status.preview} ${copy.placeholder}` : copy.placeholder,
	);

	const sourceBadge = $derived.by((): { label: string; variant: 'secondary' | 'outline' | 'destructive' } => {
		if (status.source === 'shell') return { label: copy.statusSetInShell, variant: 'secondary' };
		if (status.source === 'file') return { label: copy.statusSetInFile, variant: 'secondary' };
		return { label: copy.statusUnset, variant: 'outline' };
	});

	const validationBadge = $derived.by((): { label: string; variant: 'secondary' | 'outline' | 'destructive' } | null => {
		switch (validation.status) {
			case 'ok':
				return { label: copy.validationOk, variant: 'secondary' };
			case 'invalid':
				return { label: copy.validationInvalid, variant: 'destructive' };
			case 'unverified':
				return { label: copy.validationUnverified, variant: 'outline' };
			default:
				return null;
		}
	});
</script>

<Field.Field>
	<div class="flex items-center justify-between gap-2">
		<Field.Label for={inputId}>{label}</Field.Label>
		<div class="flex items-center gap-2" data-testid="settings-status-{provider}">
			<Badge variant={sourceBadge.variant}>{sourceBadge.label}</Badge>
			{#if validationBadge}
				<Badge variant={validationBadge.variant} data-testid="settings-validation-{provider}">
					{validationBadge.label}
				</Badge>
			{/if}
		</div>
	</div>

	<InputGroup.Root>
		<InputGroup.Input
			id={inputId}
			type={isRevealed ? 'text' : 'password'}
			autocomplete="off"
			spellcheck={false}
			disabled={isShellLocked || isSaving}
			value={inputValue}
			{placeholder}
			oninput={(event) => onChange(event.currentTarget.value)}
			data-testid="settings-input-{provider}"
		/>
		<InputGroup.Addon align="inline-end">
			{#if hasDraft && (draft ?? '').length > 0}
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					aria-label={copy.clearLabel}
					disabled={isShellLocked || isSaving}
					onclick={onClear}
				>
					<XIcon class="h-3.5 w-3.5" />
				</Button>
			{/if}
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				aria-label={isRevealed ? copy.hideLabel : copy.showLabel}
				aria-pressed={isRevealed}
				disabled={isShellLocked || isSaving}
				onclick={() => (isRevealed = !isRevealed)}
				data-testid="settings-reveal-{provider}"
			>
				{#if isRevealed}
					<EyeOffIcon class="h-3.5 w-3.5" />
				{:else}
					<EyeIcon class="h-3.5 w-3.5" />
				{/if}
			</Button>
		</InputGroup.Addon>
	</InputGroup.Root>

	{#if description}
		<Field.Description>{description}</Field.Description>
	{/if}
	{#if isShellLocked}
		<Field.Description>{copy.shellOverrideHint}</Field.Description>
	{/if}
	{#if validation.status === 'invalid' && validation.message}
		<Field.Error>{validation.message}</Field.Error>
	{/if}
</Field.Field>
