import type { Creative, CreativeType } from '../types.js';

export interface CreativeFormErrors {
	name?: string;
	type?: string;
	productId?: string;
	tone?: string;
	callToAction?: string;
	platform?: string;
	format?: string;
	durationSeconds?: string;
	style?: string;
	server?: string;
}

export interface CreativeFormModel {
	name: string;
	type: CreativeType | '';
	productId: string;
	personaId: string;
	tags: string[];
	status: string;
	tone: string;
	callToAction: string;
	platform: string;
	format: string;
	durationSeconds: string;
	imageStyle: string;
	errors: CreativeFormErrors;
	isValid: boolean;
	validate: () => boolean;
	toInput: () => Record<string, unknown>;
}

export function createCreativeFormModel(initial?: Creative): CreativeFormModel {
	let name = $state(initial?.name ?? '');
	let type = $state<CreativeType | ''>(initial?.type ?? '');
	let productId = $state(initial?.productId ?? '');
	let personaId = $state(initial?.personaId ?? '');
	let tags = $state<string[]>(initial?.tags ?? []);
	let status = $state(initial?.status ?? 'draft');
	let tone = $state('');
	let callToAction = $state('');
	let platform = $state('');
	let format = $state('');
	let durationSeconds = $state('');
	let imageStyle = $state('');
	let errors = $state<CreativeFormErrors>({});

	function validate(): boolean {
		const e: CreativeFormErrors = {};
		if (!name.trim()) e.name = 'Name is required';
		if (!type) e.type = 'Please select a creative type';
		if (!productId) e.productId = 'Please select a product';
		errors = e;
		return Object.keys(e).length === 0;
	}

	function toInput(): Record<string, unknown> {
		return {
			name: name.trim(),
			type,
			productId,
			personaId: personaId || undefined,
			tags,
			status,
			tone: tone || undefined,
			callToAction: callToAction || undefined,
			platform: platform || undefined,
			format: format || undefined,
			durationSeconds: durationSeconds ? Number(durationSeconds) : undefined,
			imageStyle: imageStyle || undefined,
		};
	}

	return {
		get name() { return name; },
		set name(v) { name = v; },
		get type() { return type; },
		set type(v) { type = v; },
		get productId() { return productId; },
		set productId(v) { productId = v; },
		get personaId() { return personaId; },
		set personaId(v) { personaId = v; },
		get tags() { return tags; },
		set tags(v) { tags = v; },
		get status() { return status; },
		set status(v) { status = v; },
		get tone() { return tone; },
		set tone(v) { tone = v; },
		get callToAction() { return callToAction; },
		set callToAction(v) { callToAction = v; },
		get platform() { return platform; },
		set platform(v) { platform = v; },
		get format() { return format; },
		set format(v) { format = v; },
		get durationSeconds() { return durationSeconds; },
		set durationSeconds(v) { durationSeconds = v; },
		get imageStyle() { return imageStyle; },
		set imageStyle(v) { imageStyle = v; },
		get errors() { return errors; },
		set errors(v) { errors = v; },
		get isValid() { return Object.keys(errors).length === 0; },
		validate,
		toInput,
	};
}
