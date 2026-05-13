# application/marketing

Application layer for the Marketing domain — ports (interfaces) and use-case services.

## Responsibility
- **`ports.ts`** — Repository and gateway interfaces that the application depends on. All infrastructure implementations must satisfy these contracts.
- **`*-service.ts`** — Use-case orchestration (CRUD, AI generation, video export). Services depend only on ports; no infrastructure imports.

## Services
| File | Responsibility |
|---|---|
| `product-service.ts` | Product CRUD + AI description generation. Rejects deletion when child Personas exist. |
| `persona-service.ts` | Persona CRUD + AI generation. Verifies the owning Product exists before create. Rolls back partial Personas on generation failure. |
| `campaign-service.ts` | Campaign CRUD. |
| `creative-service.ts` | Creative CRUD + AI text/image generation. |
| `story-service.ts` | Story CRUD. |
| `storyboard-service.ts` | Storyboard frame management and asset generation. |
| `canvas-template-service.ts` | Canvas template CRUD. |
| `strategy-service.ts` | Strategy CRUD + AI generation. |
| `audio-service.ts` | BGM file management. |
| `video-export-service.ts` | Video export via `IVideoExporter`. |

## Dependency rules
- Services import from `../../shared/marketing` (types/DTOs) and `./ports` only.
- No direct imports from `infrastructure/` — dependency injection via constructor.
- The composition root (`apps/desktop-app/src/lib/server/marketing-service.ts`) wires concrete implementations.

## Key invariants
- `PersonaService.create` always verifies the owning Product exists via `IProductRepository.findById`.
- `ProductService.delete` rejects with an error if `IPersonaRepository.findByProductId` returns any results.
- `PersonaService.generateForProduct` rolls back any already-persisted Personas on mid-loop failure.
