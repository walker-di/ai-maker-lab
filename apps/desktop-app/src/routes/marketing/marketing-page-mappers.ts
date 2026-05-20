import type { Marketing } from 'domain/shared';
import type { Product, Persona, CustomerJourneyMap } from 'ui/source';

export function toUiProduct(product: Marketing.Product): Product {
	return {
		id: product.id,
		name: product.name,
		description: product.description ?? '',
		imageUrl: product.imageUrl,
		features: product.features ?? [],
		benefits: product.benefits ?? [],
		targetAudience: product.targetAudience ?? '',
		createdAt: product.createdAt,
		updatedAt: product.updatedAt,
	};
}

export function toUiPersona(persona: Marketing.Persona): Persona {
	return {
		id: persona.id,
		productId: persona.productId,
		name: persona.name,
		age: persona.age ?? 0,
		ageRange: persona.ageRange,
		gender: persona.gender,
		occupation: persona.occupation ?? '',
		interests: persona.interests ?? [],
		painPoints: persona.painPoints ?? [],
		motivations: persona.motivations ?? [],
		description: persona.description ?? '',
		avatarUrl: persona.avatarUrl,
		createdAt: persona.createdAt,
		updatedAt: persona.updatedAt,
	};
}

export function toUiCustomerJourneyMap(journeyMap: Marketing.CustomerJourneyMap): CustomerJourneyMap {
	return {
		id: journeyMap.id,
		productId: journeyMap.productId,
		personaId: journeyMap.personaId,
		campaignId: journeyMap.campaignId,
		creativeId: journeyMap.creativeId,
		name: journeyMap.name,
		description: journeyMap.description,
		scenario: journeyMap.scenario,
		goals: journeyMap.goals ?? [],
		status: journeyMap.status ?? 'draft',
		tags: journeyMap.tags ?? [],
		stages: journeyMap.stages ?? [],
		lanes: journeyMap.lanes ?? [],
		cells: journeyMap.cells ?? [],
		touchpoints: journeyMap.touchpoints ?? [],
		emotionPoints: journeyMap.emotionPoints ?? [],
		opportunities: journeyMap.opportunities ?? [],
		createdAt: journeyMap.createdAt,
		updatedAt: journeyMap.updatedAt,
	};
}
