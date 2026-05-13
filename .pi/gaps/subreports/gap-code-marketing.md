# Gap report: migrate-marketing-products-personas static implementation audit

## 1. Implementation areas inspected

- OpenSpec artifacts: `openspec/changes/migrate-marketing-products-personas/{proposal.md,design.md,tasks.md,specs/marketing-products-personas/spec.md}`.
- Domain/shared marketing types and validation: `packages/domain/src/shared/marketing/**` and `packages/domain/src/shared/index.ts`.
- Application services/ports: `packages/domain/src/application/marketing/**` and `packages/domain/src/application/index.ts`.
- SurrealDB infrastructure: `packages/domain/src/infrastructure/database/marketing/**`, AI/file infrastructure, and infrastructure barrels.
- Desktop server composition and SvelteKit API routes: `apps/desktop-app/src/lib/server/marketing-service.ts`, `apps/desktop-app/src/routes/api/marketing/**`.
- Frontend adapters/page models/routes: `apps/desktop-app/src/lib/adapters/marketing/**`, `apps/desktop-app/src/routes/marketing/**`, desktop home route navigation.
- Shared UI components: `packages/ui/src/lib/marketing/**`, `packages/ui/src/lib/index.ts`.
- i18n messages and tests: `apps/desktop-app/messages/*.json`, repo test file search.

Commands/evidence used:

- `find apps/desktop-app/src/routes -path '*marketing*' -type f | sort`
- `find packages/domain/src/shared/marketing packages/domain/src/application/marketing packages/domain/src/infrastructure/database/marketing apps/desktop-app/src/lib/server apps/desktop-app/src/lib/adapters/marketing packages/ui/src/lib/marketing -maxdepth 3 -type f | sort`
- `find packages/domain apps/desktop-app packages/ui ... -name '*.test.ts' ... | rg 'marketing|Product|Persona|products|personas'` returned no marketing tests.
- `rg -n "fetch\(|/api/marketing|/api/" apps/desktop-app/src/routes/marketing apps/desktop-app/src/lib/adapters/marketing packages/ui/src/lib/marketing` found raw `/api/marketing` only in adapter file.
- `rg -n "from 'domain|from \"domain|packages/domain" packages/ui/src/lib/marketing apps/desktop-app/src/routes/marketing apps/desktop-app/src/lib/adapters/marketing` found no `domain` import in `packages/ui`, only allowed app-side `domain/shared` imports.
- `bunx @fission-ai/openspec@latest validate migrate-marketing-products-personas --type change --no-interactive` succeeded: `Change 'migrate-marketing-products-personas' is valid`.

## 2. Relevant files and routes

Frontend routes:

- `/marketing` -> `apps/desktop-app/src/routes/marketing/+page.svelte`
- `/marketing/products` -> `apps/desktop-app/src/routes/marketing/products/+page.svelte`
- `/marketing/products/[productId]` -> `apps/desktop-app/src/routes/marketing/products/[productId]/+page.svelte`
- `/marketing/personas` -> `apps/desktop-app/src/routes/marketing/personas/+page.svelte`

Product/persona API routes in scope:

- `/api/marketing/products` -> `apps/desktop-app/src/routes/api/marketing/products/+server.ts`
- `/api/marketing/products/[productId]` -> `apps/desktop-app/src/routes/api/marketing/products/[productId]/+server.ts`
- `/api/marketing/products/[productId]/personas` -> `apps/desktop-app/src/routes/api/marketing/products/[productId]/personas/+server.ts`
- `/api/marketing/products/[productId]/personas/generate` -> `apps/desktop-app/src/routes/api/marketing/products/[productId]/personas/generate/+server.ts`
- `/api/marketing/personas` -> `apps/desktop-app/src/routes/api/marketing/personas/+server.ts`
- `/api/marketing/personas/[id]` -> `apps/desktop-app/src/routes/api/marketing/personas/[id]/+server.ts`

Additional public/API surface found beyond this OpenSpec slice:

- API routes for BGM, campaigns, canvas templates, clips, creatives, scenes, stories, strategies, uploads, transitions under `apps/desktop-app/src/routes/api/marketing/**`.
- UI shell nav to `/marketing/campaigns`, `/marketing/creatives`, `/marketing/canvas-templates`, `/marketing/bgm`, `/marketing/settings` in `packages/ui/src/lib/marketing/layout/MarketingShell.svelte`, but matching page routes were not found.

## 3. Implemented behavior found

- Browser-safe shared marketing exports exist via `export * as Marketing from './marketing/index.js'` in `packages/domain/src/shared/index.ts`; frontend adapter/page mapper imports use `domain/shared`.
- Product and Persona TypeScript interfaces and Zod DTO schemas exist in `packages/domain/src/shared/marketing/product-types.ts`, `persona-types.ts`, and `validation.ts`.
- Application ports and services exist for products/personas in `packages/domain/src/application/marketing/ports.ts`, `product-service.ts`, `persona-service.ts`, exported via `domain/application`.
- Surreal repositories exist for products/personas in `SurrealProductRepository.ts` and `SurrealPersonaRepository.ts`, normalize IDs through `normalizeRecordIdValue(String(record.id))`, and support CRUD/list-by-product.
- Server composition exists at `apps/desktop-app/src/lib/server/marketing-service.ts` and API routes obtain services through `getMarketingServices()` rather than constructing repositories inline.
- Frontend page models use a `MarketingTransport` adapter and do not construct raw `/api/**` URLs; raw URLs are isolated in `apps/desktop-app/src/lib/adapters/marketing/http-marketing-transport.ts`.
- Route-local `.svelte.ts` page models and composition helpers exist for products/personas/detail pages.
- Shared UI marketing components exist under `packages/ui/src/lib/marketing/**`; `packages/ui/src/lib/marketing/types.ts` intentionally mirrors domain types locally and does not import `domain`.
- Svelte 5 runes (`$state`, `$derived`, `$props`) are used in page models/forms; lucide icon imports are direct per-icon paths.
- Desktop home route includes a marketing entry card at `apps/desktop-app/src/routes/+page.svelte`.

## 4. Missing or partial behavior with evidence

- **Critical — API/domain validation is not enforced.** OpenSpec scenarios require invalid Product input to be rejected and no invalid Product persisted. API routes pass raw `request.json()` bodies directly to services (`apps/desktop-app/src/routes/api/marketing/products/+server.ts`, `personas/+server.ts`), and services call repositories directly (`ProductService.create`, `PersonaService.create`) without `CreateProductDtoSchema.parse` / `CreatePersonaDtoSchema.parse`. Zod schemas exist but are unused by the in-scope API/services/repositories. Missing required fields can reach persistence.
- **Critical — Persona product association is optional and unknown products are not rejected.** Spec scenarios require Personas associated with a Product and creation for unknown Product to fail. `Persona.productId?: string` in `packages/domain/src/shared/marketing/persona-types.ts`, `CreatePersonaDtoSchema` has `productId: z.string().optional()`, `PersonaService.create()` does not check product existence, `/api/marketing/personas` accepts unscoped creation, and product-scoped POST `/api/marketing/products/[productId]/personas` injects the route productId but does not verify the product exists.
- **High — Product deletion semantics with child Personas are undefined and untested.** Design/tasks require choosing/documenting/test deletion behavior when Personas exist. `SurrealProductRepository.delete()` blindly deletes the product and there is no cascade/reject logic, no README in `packages/domain/src/infrastructure/database/marketing/`, and no tests. This can orphan Personas.
- **High — Persona generation requires live provider configuration at runtime and lacks controlled failure mapping.** `apps/desktop-app/src/lib/server/marketing-service.ts` always instantiates `AiSdkMarketingTextGateway(parseTextModelConfig())`; default provider is Anthropic. `PersonaService.generateForProduct()` does not catch/map provider failures and persists each generated persona inside a loop, so a mid-loop failure can leave partial generated Personas. This conflicts with provider failure scenario: controlled use-case error and no partial invalid Persona persisted.
- **High — Automated tests required by the slice are absent.** Search for marketing test files returned no marketing `*.test.ts`, `*.spec.ts`, or `*.e2e.ts` in `packages/domain`, `apps/desktop-app`, or `packages/ui`. Missing coverage includes shared validation, application use cases, Surreal repositories with `mem://`, adapter/page models, API route smoke tests, and Product/Persona e2e flow.
- **Medium — Product update/delete not-found mapping is inconsistent.** `GET /api/marketing/products/[productId]` maps not-found to 404, but `PUT` uses repository `update()`; if update returns no record the repository throws `Product update failed for id: ...`, which `toMarketingErrorResponse()` likely maps to 500 because it does not contain `not found`. `DELETE` always returns `{ success: true }` after `db.delete`, even for unknown ids.
- **Medium — UI validation conflicts with domain validation and is not localized.** `ProductForm` requires `description` and `targetAudience` (`ProductForm.svelte.ts`), while shared schema makes them optional. `PersonaForm` requires `age`, `occupation`, `description`, while shared schema makes them optional; Product selection label says `Product (optional)` despite spec requiring Product association.
- **Medium — Generated Persona results are not directly displayed.** `product-detail-page.svelte.ts` calls `transport.ai.generatePersonas(productId, count)` and then refreshes; it does not retain/display the returned generated draft/result separately. The UI only shows refreshed cards if persistence succeeds.
- **Medium — Documentation tasks are missing.** Required boundary docs are absent: `packages/domain/src/shared/marketing/README.md`, `packages/domain/src/application/marketing/README.md`, and `packages/domain/src/infrastructure/database/marketing/README.md` do not exist.

## 5. Architecture/policy gaps

- **High — Over-migrated production surface beyond the narrow first slice.** OpenSpec non-goals reject migrating the entire marketing-manager route tree/source debug/test routes. The implementation adds broad APIs and services for campaigns, creatives, stories, clips, scenes, BGM, canvas templates, strategies, uploads, media generation, narration, Replicate, Azure Speech, and ffmpeg. This increases live-provider and security risk beyond Products/Personas.
- **High — Marketing shell navigation exposes unimplemented pages.** `MarketingShell.svelte` links to `/marketing/campaigns`, `/marketing/creatives`, `/marketing/canvas-templates`, `/marketing/bgm`, and `/marketing/settings`; `find apps/desktop-app/src/routes/marketing` found no corresponding page routes. Users can navigate to broken/404 pages from the marketing area.
- **High — i18n requirements are not met.** Marketing pages and shared marketing UI contain many inline English strings (`Marketing Products`, `New product`, form labels, validation errors, shell nav labels, etc.). `apps/desktop-app/messages/en.json`, `es.json`, `pt.json`, and `ja.json` contain no marketing keys from `rg -n "marketing|product|persona|Product|Persona"`; desktop home route adds inline marketing card strings beside existing paraglide calls.
- **Medium — API routes duplicate/replace domain validation with ad-hoc checks instead of schema parsing.** Example: `products/generate/+server.ts` checks `if (!name)` inline; product/persona create routes do no schema parsing. Controlled 4xx behavior is therefore incomplete and inconsistent.
- **Medium — Global singleton server composition may make tests/cache isolation difficult.** `getMarketingServices()` caches a single `marketingServicesPromise`; no test reset or dependency injection seam is visible for app-level request tests using isolated `SURREAL_DB` values after first initialization.
- **Low — App-local navigation helper has stale/nonexistent routes.** `apps/desktop-app/src/lib/adapters/marketing/marketing-navigation.ts` includes `/marketing/products/new`, `/marketing/products/[id]/edit`, nested persona/creative/story routes, `/marketing/settings`; these routes were not found.

## 6. Risks and unknowns needing browser/test validation

- Browser validation needed: whether creating products/personas through UI succeeds, lists update without reload, and generated personas appear as expected.
- Network validation needed: exact HTTP status/body for invalid product/persona bodies, unknown product persona creation, unknown update/delete IDs, and generation provider failure.
- SurrealDB validation needed: confirm whether `normalizeRecordIdValue(String(record.id))` reliably strips Surreal `RecordId` for the current Surreal adapter version and whether empty-table queries throw on fresh `mem://`.
- Provider validation needed: behavior when Anthropic/OpenAI/Google API keys are absent; current composition may instantiate a provider client but failure timing depends on AI SDK behavior.
- Accessibility validation needed: no axe/browser audit was run. Static review found basic labels/aria in forms, but keyboard/focus behavior for dnd, Sheet/Select/RadioGroup, and delete actions still needs browser testing.
- Build/check unknown: `bun run check:desktop-app` was not run because it may generate `.svelte-kit` artifacts; only OpenSpec validation was run.

## 7. Gap checklist with severity and file paths

- [Critical] Unused shared schemas allow invalid persisted Products/Personas — `apps/desktop-app/src/routes/api/marketing/products/+server.ts`, `apps/desktop-app/src/routes/api/marketing/personas/+server.ts`, `packages/domain/src/application/marketing/product-service.ts`, `packages/domain/src/application/marketing/persona-service.ts`, `packages/domain/src/shared/marketing/validation.ts`.
- [Critical] Persona Product association not required/verified — `packages/domain/src/shared/marketing/persona-types.ts`, `packages/domain/src/shared/marketing/validation.ts`, `packages/domain/src/application/marketing/persona-service.ts`, `apps/desktop-app/src/routes/api/marketing/products/[productId]/personas/+server.ts`, `apps/desktop-app/src/routes/api/marketing/personas/+server.ts`.
- [High] Product deletion can orphan Personas and policy is undocumented — `packages/domain/src/infrastructure/database/marketing/SurrealProductRepository.ts`; missing `packages/domain/src/infrastructure/database/marketing/README.md`.
- [High] Persona generation can require live provider and has partial-persistence/failure-mapping risk — `apps/desktop-app/src/lib/server/marketing-service.ts`, `packages/domain/src/application/marketing/persona-service.ts`, `packages/domain/src/infrastructure/ai/marketing/AiSdkMarketingTextGateway.ts`.
- [High] Required automated tests absent — no marketing tests found under `packages/domain`, `apps/desktop-app`, `packages/ui`, or `apps/desktop-app/e2e/marketing`.
- [High] i18n missing for marketing UI — `apps/desktop-app/src/routes/+page.svelte`, `apps/desktop-app/src/routes/marketing/**/*.svelte`, `packages/ui/src/lib/marketing/**/*.svelte`, `apps/desktop-app/messages/{en,es,pt,ja}.json`.
- [High] Over-migrated marketing APIs/providers beyond first slice — `apps/desktop-app/src/routes/api/marketing/**`, `packages/domain/src/application/marketing/**`, `packages/domain/src/infrastructure/{ai,database,file}/marketing/**`, `apps/desktop-app/src/lib/server/marketing/gateways/**`.
- [High] Marketing shell exposes broken non-slice pages — `packages/ui/src/lib/marketing/layout/MarketingShell.svelte`, `apps/desktop-app/src/routes/marketing/+page.svelte`.
- [Medium] Not-found/error status mapping inconsistent for update/delete — `apps/desktop-app/src/lib/server/marketing-service.ts`, `packages/domain/src/infrastructure/database/marketing/SurrealProductRepository.ts`, `SurrealPersonaRepository.ts`, in-scope `[id]/+server.ts` routes.
- [Medium] Generated persona result not preserved/displayed as a draft/result state — `apps/desktop-app/src/routes/marketing/products/[productId]/product-detail-page.svelte.ts`, `+page.svelte`.
- [Medium] Missing required boundary READMEs — `packages/domain/src/shared/marketing/README.md`, `packages/domain/src/application/marketing/README.md`, `packages/domain/src/infrastructure/database/marketing/README.md`.
- [Medium] UI/domain validation mismatch and Product label says optional for Persona — `packages/ui/src/lib/marketing/products/ProductForm.svelte.ts`, `packages/ui/src/lib/marketing/personas/PersonaForm.svelte`, `PersonaForm.svelte.ts`, `packages/domain/src/shared/marketing/validation.ts`.
- [Low] Stale app-local navigation helper points to nonexistent routes — `apps/desktop-app/src/lib/adapters/marketing/marketing-navigation.ts`.
- [Question] Whether product deletion should reject vs cascade remains undecided in implementation; OpenSpec design prefers reject-with-children unless cascade is proven/documented.
