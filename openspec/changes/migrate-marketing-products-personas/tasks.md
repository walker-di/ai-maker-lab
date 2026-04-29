## Implementation Tasks

### 1. Domain/shared marketing model

- [x] Create `packages/domain/src/shared/marketing/README.md` documenting browser-safe responsibility and boundaries.
- [x] Add Product types, create/update inputs, validation helpers, and domain errors under `packages/domain/src/shared/marketing/products/**`.
- [x] Add Persona types, create/update/generated inputs, validation helpers, and Product association rules under `packages/domain/src/shared/marketing/personas/**`.
- [x] Add shared marketing barrel exports so frontend code can import browser-safe contracts through `domain/shared`.
- [x] Add shared validation tests for Product required fields, trimming/defaults, Persona required fields, and Product association invariants.

### 2. Application use cases and ports

- [x] Create `packages/domain/src/application/marketing/README.md` documenting use-case and port boundaries.
- [x] Define Product repository port for create, list, find, update, and delete operations.
- [x] Define Persona repository port for create, list-by-product, find, update, and delete operations.
- [x] Define a Persona generation provider port that accepts Product context and generation instructions/options.
- [x] Implement Product application service/use cases.
- [x] Implement Persona application service/use cases.
- [x] Implement Persona generation use case using the provider port and explicit failure mapping.
- [x] Export marketing application APIs through `domain/application`.
- [x] Add application tests for Product CRUD, Persona CRUD, missing Product handling, scoped Persona listing, and generated Persona success/failure.

### 3. SurrealDB infrastructure

- [x] Create `packages/domain/src/infrastructure/database/marketing/README.md` documenting persistence mapping and deletion semantics.
- [x] Implement `SurrealMarketingProductRepository` or equivalent.
- [x] Implement `SurrealMarketingPersonaRepository` or equivalent.
- [x] Choose and document Product deletion behavior when Personas exist; prefer rejecting deletion with children for first-slice safety unless implementation proves a cascade is cleaner.
- [x] Add or reuse a recursive `assertNoRecordIdLeaks` test helper.
- [x] Add SurrealDB `mem://` repository tests with unique namespace/database per file and `afterEach` close.
- [x] Export marketing infrastructure APIs through `domain/infrastructure` without exposing them to frontend imports.

### 4. App server composition and API routes

- [x] Add desktop app server composition for marketing services, likely `apps/desktop-app/src/lib/server/marketing-service.ts`.
- [x] Wire Surreal repositories and a first-slice Persona generation provider implementation or deterministic local/mockable gateway at the server boundary.
- [x] Add thin Product API routes under `apps/desktop-app/src/routes/api/marketing/products/**`.
- [x] Add thin Persona API routes under `apps/desktop-app/src/routes/api/marketing/products/[productId]/personas/**` or an equivalent Product-scoped route layout.
- [x] Add a thin Persona generation API route under `apps/desktop-app/src/routes/api/marketing/**`.
- [x] Ensure API route handlers parse HTTP input, call application services, map errors, and return JSON without importing Drizzle, SQLite schema, or provider SDK clients.
- [x] Add route smoke tests or equivalent app-level request tests for Product create/list, Persona create/list, invalid input, not-found, and generation failure.

### 5. Frontend adapters and page models

- [x] Define `MarketingTransport` under `apps/desktop-app/src/lib/adapters/marketing/**`.
- [x] Implement `web-marketing-transport` with all raw `/api/marketing/**` URL construction isolated in that adapter.
- [x] Add adapter tests for Product CRUD, Persona CRUD, generation, non-2xx errors, and not-found mapping.
- [x] Add Product page model(s) under `apps/desktop-app/src/routes/marketing/**` using the transport interface.
- [x] Add Persona page model(s) under `apps/desktop-app/src/routes/marketing/**` using the transport interface.
- [x] Add page model tests for loading, creating, editing, deleting, validation errors, and generation errors.

### 6. Shared UI and routes

- [x] Add reusable Product form/list/detail visual components under `packages/ui/src/lib/marketing/**` where appropriate.
- [x] Add reusable Persona form/list/detail visual components under `packages/ui/src/lib/marketing/**` where appropriate.
- [x] Use existing shared UI primitives from `packages/ui`; add missing primitives only when needed.
- [x] Ensure `packages/ui` marketing components do not import `packages/domain`.
- [x] Add desktop marketing route pages under `apps/desktop-app/src/routes/marketing/**`.
- [x] Add or update desktop navigation entry point for the marketing area.
- [x] Prefer direct per-icon imports from `@lucide/svelte/icons/<icon-name>`.

### 7. I18n

- [x] Add marketing message keys for visible Product/Persona labels, headings, actions, validation errors, empty states, and generation states in `apps/desktop-app/messages/en.json`.
- [x] Add corresponding keys in `apps/desktop-app/messages/es.json`.
- [x] Add corresponding keys in `apps/desktop-app/messages/pt.json`.
- [x] Add corresponding keys in `apps/desktop-app/messages/ja.json`.
- [x] Replace inline visible strings in marketing pages with paraglide message calls.

### 8. E2E and validation

- [x] Add `apps/desktop-app/e2e/marketing/helpers.ts` with navigation and mock-generation helpers.
- [x] Add Product/Persona CRUD e2e coverage in `apps/desktop-app/e2e/marketing/products-personas.e2e.ts` or equivalent.
- [x] Add Persona generation e2e coverage with mocked generation route/provider behavior.
- [x] Run targeted domain tests for shared, application, and infrastructure marketing code.
- [x] Run desktop unit tests for marketing adapters/page models.
- [ ] Run marketing e2e tests.
- [x] Run `bun run check:desktop-app`.
- [ ] Run `bunx @fission-ai/openspec@latest validate migrate-marketing-products-personas --type change --no-interactive`.

### 9. Documentation and migration hygiene

- [x] Update package/app README or nearby docs if new marketing import conventions are introduced.
- [x] Verify no frontend code imports `domain` package root or server-only modules.
- [x] Verify no migrated code imports Drizzle/SQLite from the source app.
- [x] Verify source debug/test routes were not copied as public app routes.
- [ ] Update `.pi/plans/marketing-migration-implementation-plan.md` only if implementation discoveries materially change the plan.
