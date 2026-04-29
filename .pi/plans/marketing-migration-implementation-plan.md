# Marketing Products & Personas — First-Slice Implementation Plan

## Summary
- **Goal:** Complete the `migrate-marketing-products-personas` OpenSpec first slice — Products and Product-scoped Personas — end-to-end through domain, infrastructure, API, adapters, UI, i18n, and tests.
- **OpenSpec change:** `migrate-marketing-products-personas` (0 / 59 tasks complete)
- **Key finding:** Substantial marketing backend + UI code already exists in the repo but is (a) broader than the first-slice scope, (b) missing i18n, (c) has application tests that use fake repos instead of real SurrealDB `mem://`, and (d) missing route/adapter/page-model/e2e tests. This plan focuses on closing those gaps.
- **Assumptions:**
  - Data is local/user-private; no auth/tenant scoping in first slice.
  - Persona generation returns persisted Personas (not drafts); if backend changes to return drafts, model/UI plan must be updated.
  - English fallback translations are acceptable initially for `es`, `pt`, `ja` locales.
  - Field parity decision (see Open Questions) must be made before shared-type and UI form work begins.
  - `SurrealDB mem://` repository tests are mandatory; no hand-written in-memory repo fakes for DB-backed ports (AGENTS.md rule).
- **Non-goals (this slice):**
  - Canvas/Fabric.js editor, video export, ffmpeg, BGM, transitions, stories/scenes/clips.
  - Campaigns, strategies, creatives, and their API/UI surfaces.
  - Live AI provider integration tests in CI.
  - Source debug/test routes as production routes.
  - Multi-user workspaces or auth.

## Source Reports
- [x] ✅ UI/frontend planning report incorporated: `plan-ui-marketing`
- [x] ✅ Backend planning report incorporated: `plan-backend-marketing`
- [x] ✅ Tests planning report incorporated: `plan-tests-marketing`

## Architecture Validation
- ✅ **Clean architecture boundaries:** Browser-safe types in `domain/shared`; use cases in `domain/application`; SurrealDB repos in `domain/infrastructure`; thin HTTP routes in `apps/desktop-app/src/routes/api/marketing`; raw URL construction isolated in `http-marketing-transport.ts`.
- ✅ **Svelte 5/frontend idioms:** Route pages are thin renderers; state/orchestration in `.svelte.ts` page models; composition helpers wire transport; no raw `fetch()` in shared UI or page models.
- ✅ **API/infrastructure boundaries:** Routes call `marketing-service.ts` composition; no direct `packages/domain` root imports in frontend code; no Drizzle/SQLite in new code.
- ✅ **i18n/accessibility:** All user-facing strings via Paraglide `m.marketing_*()` keys; shared UI components accept `copy` props (cannot import app Paraglide messages); semantic headings, accessible form labels, ARIA labels on icon-only buttons.
- ✅ **Testing strategy:** Real SurrealDB `mem://` for repository and service integration tests; mocked `IMarketingTextGenerationGateway` for AI boundary; `vi.stubGlobal('fetch')` for adapter tests; hoisted `vi.mock` of server composition for route tests; Playwright for e2e.

---

## Implementation Checklist

### 0 — Field parity decision (blocker for shared types + UI)
- [ ] Compare source Product fields (`name`, `description`, `industry`, `overview`, `details`, `featuresStrengths`, `imageUrl`) against current target (`name`, `description`, `targetAudience`, `features`, `benefits`, `imageUrl`). Document chosen mapping or extension in `packages/domain/src/shared/marketing/README.md`.
- [ ] Compare source Persona fields (`personaTitle`, `imageUrl`, `age`, `ageRangeSelection`, `ageRangeCustom`, `gender`, `location`, `jobTitle`, `incomeLevel`, `personalityTraits`, `valuesText`, `spendingHabits`, `interestsHobbies`, `lifestyle`, `needsPainPoints`, `goalsExpectations`, `backstory`, `purchaseProcess`, `isGenerated`) against current target. Document mapping in same README.
- [ ] Record decision in OpenSpec task notes or `README.md`: either extend target types to match source fields, or explicitly accept simplified model with documented lossy mapping.

### 1 — Domain shared types
- [ ] Apply field-parity decision to `packages/domain/src/shared/marketing/product-types.ts` (add/change fields if extending).
- [ ] Apply field-parity decision to `packages/domain/src/shared/marketing/persona-types.ts` (add/change fields if extending).
- [ ] Add trimming/defaults in `packages/domain/src/shared/marketing/validation.ts`: `z.string().trim().min(1)` for required string fields; default `[]` for array fields.
- [ ] Add Persona generation input count bounds (e.g. `z.number().int().min(1).max(20)`) in `validation.ts`.
- [ ] Update `packages/domain/src/shared/marketing/index.ts` barrel if new types are added.
- [ ] Confirm `packages/domain/src/shared/index.ts` re-exports marketing shared types.

### 2 — Application services
- [ ] Verify `packages/domain/src/application/marketing/ports.ts` exports only first-slice required ports: `IProductRepository`, `IPersonaRepository`, `IMarketingTextGenerationGateway`.
- [ ] Clean up `packages/domain/src/application/marketing/product-service.ts`: remove unused `uuidv4` import if present; ensure `delete()` rejects with a typed conflict error when child Personas exist.
- [ ] Clean up `packages/domain/src/application/marketing/persona-service.ts`: ensure Product existence check before Persona create; add rollback/cleanup semantics if generation saves partial Personas on failure; add explicit generation count validation against shared schema.
- [ ] Confirm `packages/domain/src/application/marketing/index.ts` exports `ProductService`, `PersonaService`, and ports.
- [ ] Confirm `packages/domain/src/application/index.ts` re-exports marketing application types.

### 3 — SurrealDB repositories
- [ ] Verify `packages/domain/src/infrastructure/database/marketing/SurrealProductRepository.ts` maps every chosen Product field; normalizes Surreal `RecordId` to plain strings; handles missing-table reads returning `null`/`[]`.
- [ ] Verify `packages/domain/src/infrastructure/database/marketing/SurrealPersonaRepository.ts` same; `findByProductId` filters by `productId` using plain string; handles missing-table reads.
- [ ] Add `packages/domain/src/infrastructure/database/test-helpers/assertNoRecordIdLeaks.ts` — recursive helper that traverses all object fields and array elements and asserts no value is a Surreal `RecordId` instance.
- [ ] Update `packages/domain/src/infrastructure/database/marketing/README.md` to document chosen Product deletion semantics (reject-with-children) and SurrealDB table names.
- [ ] Confirm `packages/domain/src/infrastructure/database/marketing/index.ts` exports both repositories.
- [ ] Confirm `packages/domain/src/infrastructure/database/index.ts` re-exports without exposing to frontend.

### 4 — Server composition and API routes
- [ ] Verify `apps/desktop-app/src/lib/server/marketing-service.ts` composes first-slice services (Product + Persona + text generation mock/gateway) without requiring out-of-scope media/video provider configuration at startup.
- [ ] Add centralized error logging: `toMarketingErrorResponse(error, context)` should `console.error(context, error)` before returning the mapped HTTP response.
- [ ] `apps/desktop-app/src/routes/api/marketing/products/+server.ts`: validate JSON via shared schema (400 on invalid), log catch, return 201 for create.
- [ ] `apps/desktop-app/src/routes/api/marketing/products/[productId]/+server.ts`: 404 for missing Product; 409 for delete-with-child-Personas; log catch.
- [ ] `apps/desktop-app/src/routes/api/marketing/products/[productId]/personas/+server.ts`: use route `productId` only (never trust body `productId`); Product existence check; log catch.
- [ ] `apps/desktop-app/src/routes/api/marketing/products/[productId]/personas/generate/+server.ts`: validate body count field; use product context from DB; mockable in tests; log catch.
- [ ] `apps/desktop-app/src/routes/api/marketing/personas/[id]/+server.ts`: GET/PUT/DELETE; 404 on missing; log catch.
- [ ] Ensure no route under `apps/desktop-app/src/routes/api/marketing/` imports Drizzle, SQLite schema, or source provider SDK clients.

### 5 — Frontend adapters
- [ ] Narrow `apps/desktop-app/src/lib/adapters/marketing/MarketingTransport.ts` interface to only first-slice `catalog` methods (Product CRUD, Product-scoped Persona CRUD, standalone Persona CRUD) and `ai.generatePersonas(productId, count)`.
- [ ] Verify `apps/desktop-app/src/lib/adapters/marketing/http-marketing-transport.ts` implements only first-slice methods and correctly URL-encodes `productId`; normalizes non-2xx `{ error }`, `{ message }`, and validation error responses to thrown `Error`.
- [ ] `apps/desktop-app/src/lib/adapters/marketing/create-marketing-transport.ts` selects HTTP transport cleanly; confirm it does not import server-only modules.

### 6 — Shared UI package
- [ ] Add `copy` props to `packages/ui/src/lib/marketing/products/ProductForm.svelte` and `ProductForm.svelte.ts` for all labels, placeholders, and ARIA labels; remove hard-coded English strings from within the component.
- [ ] Add `copy` props to `packages/ui/src/lib/marketing/personas/PersonaForm.svelte` and `PersonaForm.svelte.ts` for all labels/placeholders/ARIA/errors.
- [ ] Audit `packages/ui/src/lib/marketing/products/ProductCard.svelte`, `ProductDetailView.svelte`, `personas/PersonaCard.svelte`, `PersonaDetailView.svelte` for hard-coded strings; pass localized copy from route pages.
- [ ] Narrow `packages/ui/src/lib/marketing/layout/MarketingShell.svelte` first-slice nav to Dashboard, Products, Personas only (or make nav items configurable via prop); localize nav labels via prop.
- [ ] Confirm no file under `packages/ui/src/lib/marketing/` imports from `packages/domain`.
- [ ] Replace any barrel `lucide-svelte` imports in migrated components with direct `@lucide/svelte/icons/<name>` imports.
- [ ] Confirm shadcn primitives used by forms exist in `packages/ui/src/lib/components/ui`: `button`, `input`, `textarea`, `label`, `select`, `radio-group`; add missing ones via `bunx shadcn-svelte@latest add <primitive>`.

### 7 — Route pages and page models
- [ ] `apps/desktop-app/src/routes/marketing/+page.svelte`: show only Products and Personas cards; update copy to first-slice scope; use Paraglide keys.
- [ ] `apps/desktop-app/src/routes/marketing/products/+page.svelte` and `products-page.svelte.ts`: replace hard-coded strings with Paraglide `m.marketing_*()` calls; pass `copy` objects to shared UI components.
- [ ] `apps/desktop-app/src/routes/marketing/products/[productId]/+page.svelte` and `product-detail-page.svelte.ts`: replace hard-coded strings; handle generation result (persisted — refresh list; or draft — add draft state if contract changes); render generation loading/error accessibly (`role="status"` / `role="alert"`).
- [ ] `apps/desktop-app/src/routes/marketing/personas/+page.svelte` and `personas-page.svelte.ts`: replace hard-coded strings; ensure Product-required empty state links to Products page.
- [ ] `apps/desktop-app/src/routes/marketing/marketing-page-mappers.ts`: update field mappings once field-parity decision is made.
- [ ] `apps/desktop-app/src/routes/+page.svelte`: update marketing card copy to first-slice scope only; use Paraglide key.

### 8 — i18n
- [ ] Add ~70 `marketing_*` keys to `apps/desktop-app/messages/en.json`:
  - Shell/nav: `marketing_nav_dashboard`, `marketing_nav_products`, `marketing_nav_personas`, `marketing_shell_open_nav` (4–6 keys).
  - Dashboard/home: `marketing_home_title`, `marketing_home_products_label`, `marketing_home_products_description`, `marketing_home_personas_label`, `marketing_home_personas_description` (5–8 keys).
  - Products page/detail: title, intro, new/edit/create/save/delete/view/back/loading/empty-state/error/generate-personas labels (~16 keys).
  - Product form: field labels/placeholders/errors for all chosen Product fields (~14 keys).
  - Personas page/detail: title, intro, new/edit/create/delete/loading/empty/error/product-required/generation-loading/generation-error (~14 keys).
  - Persona form: basic info/demographics/interests/pain-points/motivations/description labels, add/remove tag ARIA labels, placeholders (~18 keys).
- [ ] Mirror same keys in `apps/desktop-app/messages/es.json` (English fallback values acceptable initially).
- [ ] Mirror same keys in `apps/desktop-app/messages/pt.json`.
- [ ] Mirror same keys in `apps/desktop-app/messages/ja.json`.

---

## Tests

### Shared domain validation
- [ ] `packages/domain/src/shared/marketing/validation.test.ts`: add/confirm Product required-field rejection, whitespace-only name rejection (if trimming is adopted), Persona `productId` required, generation count bounds (min 1, max 20).

### Application service tests — convert to real SurrealDB repos (AGENTS.md rule)
- [ ] `packages/domain/src/application/marketing/product-service.test.ts`: replace `FakeProductRepo`/`FakePersonaRepo` with real `SurrealProductRepository`/`SurrealPersonaRepository` against `mem://`; mock only `IMarketingTextGenerationGateway`. Scenarios: Product CRUD, delete-with-child-Personas returns typed conflict.
- [ ] `packages/domain/src/application/marketing/persona-service.test.ts`: same conversion. Scenarios: Persona CRUD, create-rejects-unknown-product, `findByProductId` cross-product exclusion, generation success (mocked AI returns N drafts → N saved Personas), generation failure rollback.

### Repository integration tests
- [ ] `packages/domain/src/infrastructure/database/marketing/product-persona-repository.test.ts`: add `assertNoRecordIdLeaks` calls on create/find/list/update results and any nested arrays; add not-found/update/delete behavior; add `findByProductId` cross-product exclusion case.

### API route tests
- [ ] `apps/desktop-app/src/routes/api/marketing/products/+server.test.ts`: list success, create success (201), create invalid input (400).
- [ ] `apps/desktop-app/src/routes/api/marketing/products/[productId]/+server.test.ts`: get success, update success, delete success, get not-found (404), delete with child Personas (409).
- [ ] `apps/desktop-app/src/routes/api/marketing/products/[productId]/personas/+server.test.ts`: list success (scoped), create success, missing product (404).
- [ ] `apps/desktop-app/src/routes/api/marketing/products/[productId]/personas/generate/+server.test.ts`: success, missing product (404), provider failure (mapped error).
- [ ] `apps/desktop-app/src/routes/api/marketing/personas/[id]/+server.test.ts`: get/update/delete success, not-found (404).

### Frontend adapter tests
- [ ] `apps/desktop-app/src/lib/adapters/marketing/http-marketing-transport.test.ts`: Product CRUD paths/methods/bodies, Persona CRUD paths, `generatePersonas` path/body, non-2xx error mapping.

### Page model tests
- [ ] `apps/desktop-app/src/routes/marketing/products/products-page.test.ts`: load sets `hasLoaded`; create/edit/delete via transport stub; transport error sets `errorMessage`.
- [ ] `apps/desktop-app/src/routes/marketing/personas/personas-page.test.ts`: load products+personas; create/edit/delete; Product-required empty state when no products.
- [ ] `apps/desktop-app/src/routes/marketing/products/[productId]/product-detail-page.test.ts`: load product+personas; generation success refreshes list; generation failure sets error state.

### E2E tests
- [ ] `apps/desktop-app/e2e/marketing/helpers.ts`: navigation helpers (`goToProducts`, `goToPersonas`), mocked generation route helper.
- [ ] `apps/desktop-app/e2e/marketing/products-personas.e2e.ts`: full browser flow — Products empty state → create Product → edit Product → navigate to Personas → create Persona (associated) → edit Persona → delete Persona → delete Product (no children) → mocked generation flow via `page.route('**/api/marketing/products/*/personas/generate', ...)`.

---

## Validation Commands
- [ ] `bunx @fission-ai/openspec@latest validate migrate-marketing-products-personas --type change --no-interactive`
- [ ] `bun test packages/domain/src/shared/marketing/validation.test.ts`
- [ ] `bun test packages/domain/src/application/marketing/product-service.test.ts packages/domain/src/application/marketing/persona-service.test.ts`
- [ ] `bun test packages/domain/src/infrastructure/database/marketing/product-persona-repository.test.ts`
- [ ] `cd apps/desktop-app && bun run test:unit -- src/lib/adapters/marketing src/routes/marketing/products src/routes/marketing/personas src/routes/api/marketing`
- [ ] `bun run check:desktop-app`
- [ ] `cd apps/desktop-app && bun run test:e2e -- e2e/marketing/products-personas.e2e.ts`

---

## Dependencies and Sequencing

1. **Field-parity decision** (Phase 0) — must happen first; blocks shared types, UI forms, and repository mapping.
2. **Shared types + validation** (Phase 1) — no other dep once decision is made.
3. **Application services** (Phase 2) — depends on Phase 1 types/schemas.
4. **SurrealDB repositories + `assertNoRecordIdLeaks`** (Phase 3) — depends on Phase 1 types; can run parallel with Phase 2.
5. **Convert service tests to real repos** — depends on Phases 2 + 3.
6. **Server composition + API routes** (Phase 4) — depends on Phases 2 + 3.
7. **Frontend adapters** (Phase 5) — depends on Phase 4 route shapes being stable.
8. **Shared UI `copy` props** (Phase 6) — can start parallel with Phase 4; does not require live API.
9. **Route pages + page models** (Phase 7) — depends on Phases 5 + 6.
10. **i18n keys** (Phase 8) — can run parallel with Phase 7; blocks final localization of route pages.
11. **Route/adapter/page-model/e2e tests** — depends on respective implementation phases.
12. **Validation commands** — run after each phase; full suite at end.

---

## Risks and Mitigations

- ⚠️ **Risk:** Source Product/Persona fields (e.g. `industry`, `overview`, `personaTitle`, `backstory`) not in current target types — UI migration may feel incomplete.
  - **Mitigation:** Make field-parity decision explicit and record in `README.md` before any form work.
- ⚠️ **Risk:** Application service tests currently use fake repos (violates AGENTS.md) — they may pass while real SurrealDB mapping silently fails.
  - **Mitigation:** Converting service tests to real `mem://` repos is a required step (not optional polish).
- ⚠️ **Risk:** Shared UI components (`ProductForm`, `PersonaForm`) cannot import Paraglide messages — i18n via `copy` props increases prop surface.
  - **Mitigation:** Define typed `copy` interfaces for each form component; route pages construct and pass the full copy object.
- ⚠️ **Risk:** Persona generation result contract (persisted vs draft) affects UI state model.
  - **Mitigation:** Confirm API contract before building generation UX; if drafts are returned, add draft state and accept/save flow.
- ⚠️ **Risk:** Broad marketing routes/UI already in repo (campaigns, creatives, canvas, etc.) may confuse first-slice testers.
  - **Mitigation:** Hide/remove out-of-scope nav items from `MarketingShell` and `+page.svelte` dashboard for this slice.
- ⚠️ **Risk:** AI gateway requires live credentials at runtime.
  - **Mitigation:** Keep mock/deterministic `IMarketingTextGenerationGateway` as default in composition for tests/dev; gate live provider behind env flag.

## Open Questions
- ❓ **Field parity:** Should first-slice Product/Persona models match source app fields exactly, or is the simplified current model acceptable? This is the biggest blocker.
- ❓ **Generation contract:** Does `/personas/generate` return persisted Personas (current assumption) or draft data requiring a separate accept/save step?
- ❓ **Standalone Personas page:** Is the all-Personas route (`/marketing/personas`) in first-slice scope, or should the only Persona entry point be through the Product detail page?
- ❓ **`assertNoRecordIdLeaks` location:** Keep co-located with marketing tests or add to `packages/domain/src/infrastructure/database/test-helpers/` for reuse across all domain repo tests?

---

## `sdd-workflow-adoption` Note
The 2 remaining tasks for `sdd-workflow-adoption` are governance/process decisions, not implementation tasks:
- **Task 7:** Approve pilot slice subject area — board decision.
- **Task 8:** Nominate who signs "spec complete" before Coder checkout — board decision.
No code or tests to plan. These require a human decision recorded in the task tracker (AIMA-11).
