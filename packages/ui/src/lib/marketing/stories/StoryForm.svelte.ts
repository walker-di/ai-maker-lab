import type { Story } from '../types.js';

export interface StoryFormErrors {
	title?: string;
	bgmVolume?: string;
	server?: string;
}

export interface StoryFormModel {
	title: string;
	description: string;
	narrationVoice: string;
	narrationLang: string;
	bgmVolume: number;
	errors: StoryFormErrors;
	isValid: boolean;
	validate: () => boolean;
	toInput: () => Partial<Story> & { narrationVoice?: string; narrationLang?: string; bgmVolume?: number };
}

export function createStoryFormModel(initial?: Story): StoryFormModel {
	let title = $state(initial?.title ?? '');
	let description = $state(initial?.description ?? '');
	let narrationVoice = $state('');
	let narrationLang = $state('en');
	let bgmVolume = $state(50);
	let errors = $state<StoryFormErrors>({});

	function validate(): boolean {
		const e: StoryFormErrors = {};
		if (!title.trim()) e.title = 'Title is required';
		errors = e;
		return Object.keys(e).length === 0;
	}

	function toInput() {
		return {
			title: title.trim(),
			description: description.trim() || undefined,
			narrationVoice: narrationVoice || undefined,
			narrationLang,
			bgmVolume,
		};
	}

	return {
		get title() { return title; },
		set title(v) { title = v; },
		get description() { return description; },
		set description(v) { description = v; },
		get narrationVoice() { return narrationVoice; },
		set narrationVoice(v) { narrationVoice = v; },
		get narrationLang() { return narrationLang; },
		set narrationLang(v) { narrationLang = v; },
		get bgmVolume() { return bgmVolume; },
		set bgmVolume(v) { bgmVolume = v; },
		get errors() { return errors; },
		set errors(v) { errors = v; },
		get isValid() { return Object.keys(errors).length === 0; },
		validate,
		toInput,
	};
}
