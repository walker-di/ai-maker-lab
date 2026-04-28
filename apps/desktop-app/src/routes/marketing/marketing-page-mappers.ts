import type { Marketing } from 'domain/shared';
import type { Product, Persona } from 'ui/source';

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
