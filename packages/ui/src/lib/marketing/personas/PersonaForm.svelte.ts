import type { Persona, CreatePersonaInput, AgeRange, Gender, Product } from '../types.js';

export interface PersonaFormErrors {
	name?: string;
	age?: string;
	ageRange?: string;
	gender?: string;
	occupation?: string;
	description?: string;
	server?: string;
}

export interface PersonaFormModel {
	name: string;
	age: number;
	ageRange: AgeRange;
	gender: Gender;
	occupation: string;
	interests: string[];
	painPoints: string[];
	motivations: string[];
	description: string;
	productId: string;
	errors: PersonaFormErrors;
	isValid: boolean;
	validate: () => boolean;
	addInterest: (v: string) => void;
	removeInterest: (i: number) => void;
	addPainPoint: (v: string) => void;
	removePainPoint: (i: number) => void;
	addMotivation: (v: string) => void;
	removeMotivation: (i: number) => void;
	toCreateInput: () => CreatePersonaInput;
}

export function createPersonaFormModel(
	products: Product[],
	initial?: Persona
): PersonaFormModel {
	let name = $state(initial?.name ?? '');
	let age = $state(initial?.age ?? 30);
	let ageRange = $state<AgeRange>(initial?.ageRange ?? '25-34');
	let gender = $state<Gender>(initial?.gender ?? 'all');
	let occupation = $state(initial?.occupation ?? '');
	let interests = $state<string[]>(initial?.interests ? [...initial.interests] : []);
	let painPoints = $state<string[]>(initial?.painPoints ? [...initial.painPoints] : []);
	let motivations = $state<string[]>(initial?.motivations ? [...initial.motivations] : []);
	let description = $state(initial?.description ?? '');
	let productId = $state(initial?.productId ?? (products[0]?.id ?? ''));
	let errors = $state<PersonaFormErrors>({});

	function validate(): boolean {
		const newErrors: PersonaFormErrors = {};
		if (!name.trim()) newErrors.name = 'Persona name is required';
		if (!age || age < 1 || age > 120) newErrors.age = 'Please enter a valid age (1–120)';
		if (!occupation.trim()) newErrors.occupation = 'Occupation is required';
		if (!description.trim()) newErrors.description = 'Description is required';
		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	function addInterest(v: string) {
		const trimmed = v.trim();
		if (trimmed && !interests.includes(trimmed)) interests = [...interests, trimmed];
	}

	function removeInterest(i: number) {
		interests = interests.filter((_, idx) => idx !== i);
	}

	function addPainPoint(v: string) {
		const trimmed = v.trim();
		if (trimmed && !painPoints.includes(trimmed)) painPoints = [...painPoints, trimmed];
	}

	function removePainPoint(i: number) {
		painPoints = painPoints.filter((_, idx) => idx !== i);
	}

	function addMotivation(v: string) {
		const trimmed = v.trim();
		if (trimmed && !motivations.includes(trimmed)) motivations = [...motivations, trimmed];
	}

	function removeMotivation(i: number) {
		motivations = motivations.filter((_, idx) => idx !== i);
	}

	function toCreateInput(): CreatePersonaInput {
		return {
			name: name.trim(),
			age,
			ageRange,
			gender,
			occupation: occupation.trim(),
			interests: [...interests],
			painPoints: [...painPoints],
			motivations: [...motivations],
			description: description.trim(),
			productId: productId || undefined,
		};
	}

	return {
		get name() { return name; },
		set name(v) { name = v; },
		get age() { return age; },
		set age(v) { age = v; },
		get ageRange() { return ageRange; },
		set ageRange(v) { ageRange = v; },
		get gender() { return gender; },
		set gender(v) { gender = v; },
		get occupation() { return occupation; },
		set occupation(v) { occupation = v; },
		get interests() { return interests; },
		get painPoints() { return painPoints; },
		get motivations() { return motivations; },
		get description() { return description; },
		set description(v) { description = v; },
		get productId() { return productId; },
		set productId(v) { productId = v; },
		get errors() { return errors; },
		set errors(v) { errors = v; },
		get isValid() { return Object.keys(errors).length === 0; },
		validate,
		addInterest,
		removeInterest,
		addPainPoint,
		removePainPoint,
		addMotivation,
		removeMotivation,
		toCreateInput,
	};
}
