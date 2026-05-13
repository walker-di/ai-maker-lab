# shared/marketing

Browser-safe shared contracts for the Marketing domain.

## Responsibility
- TypeScript interfaces (`Product`, `Persona`, `Campaign`, …) shared between frontend and backend.
- Zod DTO schemas for validated API boundaries (`CreateProductDtoSchema`, `CreatePersonaDtoSchema`, …).
- Constants and enums (`CampaignStatus`, `AgeRange`, `Gender`, …).

## Dependency rules
- **No runtime side-effects.** This package must remain importable in browser contexts.
- **No imports from `application/` or `infrastructure/`.** Types flow outward only.
- All public exports are re-exported from `index.ts` and namespaced as `Marketing` in `packages/domain/src/shared/index.ts`.

## Key invariants
- `Persona.productId` is **required** — a Persona always belongs to exactly one Product.
- `CreatePersonaDtoSchema.productId` is `z.string().min(1)` (not optional).
- `CreateProductDtoSchema.name` is `z.string().min(1)`.
