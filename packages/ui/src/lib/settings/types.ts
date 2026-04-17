export type SettingsProviderId = 'openai' | 'anthropic' | 'gemini';

export const SETTINGS_PROVIDER_IDS: readonly SettingsProviderId[] = ['openai', 'anthropic', 'gemini'];

export type SettingsKeySource = 'shell' | 'file' | 'unset';

export interface SettingsProviderKeyStatus {
	provider: SettingsProviderId;
	isSet: boolean;
	source: SettingsKeySource;
	preview: string | null;
}

export type SettingsValidationStatus = 'idle' | 'ok' | 'invalid' | 'unverified';

export interface SettingsProviderValidation {
	status: SettingsValidationStatus;
	message?: string;
}

export interface SettingsProviderLabel {
	provider: SettingsProviderId;
	label: string;
	description?: string;
}

export interface SettingsCopy {
	placeholder: string;
	showLabel: string;
	hideLabel: string;
	clearLabel: string;
	statusSetInFile: string;
	statusSetInShell: string;
	statusUnset: string;
	validationOk: string;
	validationInvalid: string;
	validationUnverified: string;
	shellOverrideHint: string;
}
