<script lang="ts">
	import SettingsProviderKeyField from './SettingsProviderKeyField.svelte';
	import type {
		SettingsCopy,
		SettingsProviderId,
		SettingsProviderKeyStatus,
		SettingsProviderLabel,
		SettingsProviderValidation,
	} from './types.js';

	interface Props {
		providers: readonly SettingsProviderLabel[];
		statuses: readonly SettingsProviderKeyStatus[];
		drafts: Partial<Record<SettingsProviderId, string>>;
		validations: Partial<Record<SettingsProviderId, SettingsProviderValidation>>;
		copy: SettingsCopy;
		isSaving?: boolean;
		onChange: (provider: SettingsProviderId, value: string) => void;
		onClear: (provider: SettingsProviderId) => void;
	}

	let {
		providers,
		statuses,
		drafts,
		validations,
		copy,
		isSaving = false,
		onChange,
		onClear,
	}: Props = $props();

	function statusFor(provider: SettingsProviderId): SettingsProviderKeyStatus {
		return (
			statuses.find((s) => s.provider === provider) ?? {
				provider,
				isSet: false,
				source: 'unset',
				preview: null,
			}
		);
	}

	function validationFor(provider: SettingsProviderId): SettingsProviderValidation {
		return validations[provider] ?? { status: 'idle' };
	}
</script>

<div class="space-y-6">
	{#each providers as item (item.provider)}
		<SettingsProviderKeyField
			provider={item.provider}
			label={item.label}
			description={item.description}
			status={statusFor(item.provider)}
			draft={drafts[item.provider]}
			validation={validationFor(item.provider)}
			{copy}
			{isSaving}
			onChange={(value) => onChange(item.provider, value)}
			onClear={() => onClear(item.provider)}
		/>
	{/each}
</div>
