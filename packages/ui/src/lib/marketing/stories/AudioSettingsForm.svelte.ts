export interface AudioSettings {
	narrationVoice?: string;
	narrationLang?: string;
	bgmVolume?: number;
}

export interface AudioSettingsFormErrors {
	server?: string;
}

export interface AudioSettingsFormModel {
	narrationVoice: string;
	narrationLang: string;
	bgmVolume: number;
	errors: AudioSettingsFormErrors;
	toSettings: () => AudioSettings;
}

export function createAudioSettingsFormModel(initial?: AudioSettings): AudioSettingsFormModel {
	let narrationVoice = $state(initial?.narrationVoice ?? '');
	let narrationLang = $state(initial?.narrationLang ?? 'en');
	let bgmVolume = $state(initial?.bgmVolume ?? 50);
	let errors = $state<AudioSettingsFormErrors>({});

	function toSettings(): AudioSettings {
		return {
			narrationVoice: narrationVoice || undefined,
			narrationLang,
			bgmVolume,
		};
	}

	return {
		get narrationVoice() { return narrationVoice; },
		set narrationVoice(v) { narrationVoice = v; },
		get narrationLang() { return narrationLang; },
		set narrationLang(v) { narrationLang = v; },
		get bgmVolume() { return bgmVolume; },
		set bgmVolume(v) { bgmVolume = v; },
		get errors() { return errors; },
		set errors(v) { errors = v; },
		toSettings,
	};
}
