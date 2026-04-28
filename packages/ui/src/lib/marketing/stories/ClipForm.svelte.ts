import type { Clip, CreateClipInput } from '../types.js';

export interface ClipFormErrors {
	type?: string;
	durationMs?: string;
	server?: string;
}

export interface ClipFormModel {
	type: 'image' | 'video' | 'text' | '';
	content: string;
	narrationText: string;
	durationMs: string;
	errors: ClipFormErrors;
	isValid: boolean;
	validate: () => boolean;
	toInput: (sceneId: string, orderIndex: number) => CreateClipInput;
}

export function createClipFormModel(initial?: Partial<Clip>): ClipFormModel {
	let type = $state<'image' | 'video' | 'text' | ''>(initial?.type ?? '');
	let content = $state(initial?.content ?? '');
	let narrationText = $state(initial?.narrationText ?? '');
	let durationMs = $state(initial?.durationMs?.toString() ?? '3000');
	let errors = $state<ClipFormErrors>({});

	function validate(): boolean {
		const e: ClipFormErrors = {};
		if (!type) e.type = 'Please select a clip type';
		const ms = Number(durationMs);
		if (durationMs && (isNaN(ms) || ms < 100)) {
			e.durationMs = 'Duration must be at least 100ms';
		}
		errors = e;
		return Object.keys(e).length === 0;
	}

	function toInput(sceneId: string, orderIndex: number): CreateClipInput {
		return {
			sceneId,
			orderIndex,
			type: type as 'image' | 'video' | 'text',
			content: content || undefined,
			narrationText: narrationText || undefined,
			durationMs: durationMs ? Number(durationMs) : undefined,
		};
	}

	return {
		get type() { return type; },
		set type(v) { type = v; },
		get content() { return content; },
		set content(v) { content = v; },
		get narrationText() { return narrationText; },
		set narrationText(v) { narrationText = v; },
		get durationMs() { return durationMs; },
		set durationMs(v) { durationMs = v; },
		get errors() { return errors; },
		set errors(v) { errors = v; },
		get isValid() { return Object.keys(errors).length === 0; },
		validate,
		toInput,
	};
}
