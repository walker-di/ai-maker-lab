import type { Campaign, CreateCampaignInput, CampaignStatus, Product } from '../types.js';

export interface CampaignFormErrors {
	name?: string;
	description?: string;
	productId?: string;
	goals?: string;
	server?: string;
}

export interface CampaignFormModel {
	name: string;
	description: string;
	productId: string;
	status: CampaignStatus;
	startDate: string;
	endDate: string;
	goals: string;
	errors: CampaignFormErrors;
	isValid: boolean;
	validate: () => boolean;
	toCreateInput: () => CreateCampaignInput;
}

export function createCampaignFormModel(
	products: Product[],
	initial?: Campaign
): CampaignFormModel {
	let name = $state(initial?.name ?? '');
	let description = $state(initial?.description ?? '');
	let productId = $state(initial?.productId ?? (products[0]?.id ?? ''));
	let status = $state<CampaignStatus>(initial?.status ?? 'draft');
	let startDate = $state(initial?.startDate ? initial.startDate.slice(0, 10) : '');
	let endDate = $state(initial?.endDate ? initial.endDate.slice(0, 10) : '');
	let goals = $state(initial?.goals ?? '');
	let errors = $state<CampaignFormErrors>({});

	function validate(): boolean {
		const newErrors: CampaignFormErrors = {};
		if (!name.trim()) newErrors.name = 'Campaign name is required';
		if (!productId) newErrors.productId = 'Please select a product';
		if (!goals.trim()) newErrors.goals = 'Campaign goals are required';
		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	function toCreateInput(): CreateCampaignInput {
		return {
			name: name.trim(),
			description: description.trim(),
			productId,
			goals: goals.trim(),
		};
	}

	return {
		get name() { return name; },
		set name(v) { name = v; },
		get description() { return description; },
		set description(v) { description = v; },
		get productId() { return productId; },
		set productId(v) { productId = v; },
		get status() { return status; },
		set status(v) { status = v; },
		get startDate() { return startDate; },
		set startDate(v) { startDate = v; },
		get endDate() { return endDate; },
		set endDate(v) { endDate = v; },
		get goals() { return goals; },
		set goals(v) { goals = v; },
		get errors() { return errors; },
		set errors(v) { errors = v; },
		get isValid() { return Object.keys(errors).length === 0; },
		validate,
		toCreateInput,
	};
}
