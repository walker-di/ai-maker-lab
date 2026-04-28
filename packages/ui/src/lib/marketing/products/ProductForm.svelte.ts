import type { Product, CreateProductInput, UpdateProductInput } from '../types.js';

export interface ProductFormErrors {
	name?: string;
	description?: string;
	targetAudience?: string;
	features?: string;
	benefits?: string;
	server?: string;
}

export interface ProductFormModel {
	name: string;
	description: string;
	targetAudience: string;
	features: string[];
	benefits: string[];
	errors: ProductFormErrors;
	isValid: boolean;
	reset: () => void;
	addFeature: () => void;
	removeFeature: (index: number) => void;
	setFeature: (index: number, value: string) => void;
	addBenefit: () => void;
	removeBenefit: (index: number) => void;
	setBenefit: (index: number, value: string) => void;
	validate: () => boolean;
	toCreateInput: () => CreateProductInput;
	toUpdateInput: () => UpdateProductInput;
}

export function createProductFormModel(initial?: Product): ProductFormModel {
	let name = $state(initial?.name ?? '');
	let description = $state(initial?.description ?? '');
	let targetAudience = $state(initial?.targetAudience ?? '');
	let features = $state<string[]>(initial?.features ? [...initial.features] : ['']);
	let benefits = $state<string[]>(initial?.benefits ? [...initial.benefits] : ['']);
	let errors = $state<ProductFormErrors>({});

	function validate(): boolean {
		const newErrors: ProductFormErrors = {};
		if (!name.trim()) newErrors.name = 'Product name is required';
		if (!description.trim()) newErrors.description = 'Description is required';
		if (!targetAudience.trim()) newErrors.targetAudience = 'Target audience is required';
		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	function reset() {
		name = initial?.name ?? '';
		description = initial?.description ?? '';
		targetAudience = initial?.targetAudience ?? '';
		features = initial?.features ? [...initial.features] : [''];
		benefits = initial?.benefits ? [...initial.benefits] : [''];
		errors = {};
	}

	function addFeature() {
		features = [...features, ''];
	}

	function removeFeature(index: number) {
		features = features.filter((_, i) => i !== index);
		if (features.length === 0) features = [''];
	}

	function setFeature(index: number, value: string) {
		features = features.map((f, i) => (i === index ? value : f));
	}

	function addBenefit() {
		benefits = [...benefits, ''];
	}

	function removeBenefit(index: number) {
		benefits = benefits.filter((_, i) => i !== index);
		if (benefits.length === 0) benefits = [''];
	}

	function setBenefit(index: number, value: string) {
		benefits = benefits.map((b, i) => (i === index ? value : b));
	}

	function toCreateInput(): CreateProductInput {
		return {
			name: name.trim(),
			description: description.trim(),
			targetAudience: targetAudience.trim(),
			features: features.filter((f) => f.trim()),
			benefits: benefits.filter((b) => b.trim()),
		};
	}

	function toUpdateInput(): UpdateProductInput {
		return {
			name: name.trim() || undefined,
			description: description.trim() || undefined,
			targetAudience: targetAudience.trim() || undefined,
			features: features.filter((f) => f.trim()),
			benefits: benefits.filter((b) => b.trim()),
		};
	}

	return {
		get name() { return name; },
		set name(v) { name = v; },
		get description() { return description; },
		set description(v) { description = v; },
		get targetAudience() { return targetAudience; },
		set targetAudience(v) { targetAudience = v; },
		get features() { return features; },
		get benefits() { return benefits; },
		get errors() { return errors; },
		set errors(v) { errors = v; },
		get isValid() { return Object.keys(errors).length === 0; },
		reset,
		addFeature,
		removeFeature,
		setFeature,
		addBenefit,
		removeBenefit,
		setBenefit,
		validate,
		toCreateInput,
		toUpdateInput,
	};
}
