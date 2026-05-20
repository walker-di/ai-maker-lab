import type { CustomerJourneyMap, CreateCustomerJourneyMapInput, Product, CustomerJourneyMapStatus } from '../types.js';
import {
	defaultJourneyMapCells,
	defaultJourneyMapEmotionPoints,
	defaultJourneyMapLanes,
	defaultJourneyMapOpportunities,
	defaultJourneyMapStages,
	defaultJourneyMapTouchpoints,
} from './customer-journey-map-defaults.js';

export interface CustomerJourneyMapFormErrors {
	name?: string;
	productId?: string;
	server?: string;
}

export interface CustomerJourneyMapFormModel {
	name: string;
	description: string;
	scenario: string;
	productId: string;
	status: CustomerJourneyMapStatus;
	goals: string[];
	tags: string[];
	errors: CustomerJourneyMapFormErrors;
	isValid: boolean;
	validate: () => boolean;
	addGoal: (v: string) => void;
	removeGoal: (i: number) => void;
	addTag: (v: string) => void;
	removeTag: (i: number) => void;
	toCreateInput: () => CreateCustomerJourneyMapInput;
}

export function createCustomerJourneyMapFormModel(
	products: Product[],
	initial?: CustomerJourneyMap
): CustomerJourneyMapFormModel {
	let name = $state(initial?.name ?? '');
	let description = $state(initial?.description ?? '');
	let scenario = $state(initial?.scenario ?? '');
	let productId = $state(initial?.productId ?? (products[0]?.id ?? ''));
	let status = $state<CustomerJourneyMapStatus>(initial?.status ?? 'draft');
	let goals = $state<string[]>(initial?.goals ? [...initial.goals] : []);
	let tags = $state<string[]>(initial?.tags ? [...initial.tags] : []);
	let errors = $state<CustomerJourneyMapFormErrors>({});

	function validate(): boolean {
		const newErrors: CustomerJourneyMapFormErrors = {};
		if (!name.trim()) newErrors.name = 'Journey map name is required';
		if (!productId.trim()) newErrors.productId = 'Product is required';
		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	function addGoal(v: string) {
		const trimmed = v.trim();
		if (trimmed && !goals.includes(trimmed)) goals = [...goals, trimmed];
	}

	function removeGoal(i: number) {
		goals = goals.filter((_, idx) => idx !== i);
	}

	function addTag(v: string) {
		const trimmed = v.trim();
		if (trimmed && !tags.includes(trimmed)) tags = [...tags, trimmed];
	}

	function removeTag(i: number) {
		tags = tags.filter((_, idx) => idx !== i);
	}

	function toCreateInput(): CreateCustomerJourneyMapInput {
		return {
			name: name.trim(),
			description: description.trim() || undefined,
			scenario: scenario.trim() || undefined,
			productId: productId.trim(),
			status,
			goals: [...goals],
			tags: [...tags],
			stages: initial?.stages ?? defaultJourneyMapStages,
			lanes: initial?.lanes ?? defaultJourneyMapLanes,
			cells: initial?.cells ?? defaultJourneyMapCells,
			touchpoints: initial?.touchpoints ?? defaultJourneyMapTouchpoints,
			emotionPoints: initial?.emotionPoints ?? defaultJourneyMapEmotionPoints,
			opportunities: initial?.opportunities ?? defaultJourneyMapOpportunities,
		};
	}

	return {
		get name() { return name; },
		set name(v) { name = v; },
		get description() { return description; },
		set description(v) { description = v; },
		get scenario() { return scenario; },
		set scenario(v) { scenario = v; },
		get productId() { return productId; },
		set productId(v) { productId = v; },
		get status() { return status; },
		set status(v) { status = v; },
		get goals() { return goals; },
		get tags() { return tags; },
		get errors() { return errors; },
		set errors(v) { errors = v; },
		get isValid() { return Object.keys(errors).length === 0; },
		validate,
		addGoal,
		removeGoal,
		addTag,
		removeTag,
		toCreateInput,
	};
}
