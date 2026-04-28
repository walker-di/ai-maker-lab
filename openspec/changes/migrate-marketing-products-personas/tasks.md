## Implementation Tasks

### 1. Domain/shared marketing model

- [ ] Create `packages/domain/src/shared/marketing/README.md` documenting browser-safe responsibility and boundaries.
- [ ] Add Product types, create/update inputs, validation helpers, and domain errors under `packages/domain/src/shared/marketing/products/**`.
- [ ] Add Persona types, create/update/generated inputs, validation helpers, and Product association rules under `packages/domain/src/shared/marketing/personas/**`.
- [ ] Add shared marketing barrel exports so frontend code can import browser-safe contracts through `domain/shared`.
- [ ] Add shared validation tests for Product required fields, trimming/defaults, Persona required fields, and Product association invariants.

### 2. Application use cases and ports

- [ ] Create `packages/domain/src/application/marketing/README.md` documenting use-case and port boundaries.
- [ ] Define Product repository port for create, list, find, update, and delete operations.
- [ ] Define Persona repository port for create, list-by-product, find, update, and delete operations.
- [ ] Define a Persona generation provider port that accepts Product context and generation instructions/options.
- [ ] Implement Product application service/use cases.
- [ ] Implement Persona application service/use cases.
- [ ] Implement Persona generation use case using the provider port and explicit failure mapping.
- [ ] Export marketing application APIs through `domain/application`.
- [ ] Add application tests for Product CRUD, Persona CRUD, missing Product handling, scoped Persona listing, and generated Persona success/failure.

### 3. SurrealDB infrastructure

- [ ] Create `packages/domain/src/infrastructure/database/marketing/README.md` documenting persistence mapping and deletion semantics.
- [ ] Implement `SurrealMarketingProductRepository` or equivalent.
- [ ] Implement `SurrealMarketingPersonaRepository` or equivalent.
- [ ] Choose and document Product deletion behavior when Personas exist; prefer rejecting deletion with children for first-slice safety unless implementation proves a cascade is cleaner.
- [ ] Add or reuse a recursive `assertNoRecordIdLeaks` test helper.
- [ ] Add SurrealDB `mem://` repository tests with unique namespace/database per file and `afterEach` close.
- [ ] Export marketing infrastructure APIs through `domain/infrastructure` without exposing them to frontend imports.

### 4. App server composition and API routes

- [ ] Add desktop app server composition for marketing services, likely `apps/desktop-app/src/lib/server/marketing-service.ts`.
- [ ] Wire Surreal repositories and a first-slice Persona generation provider implementation or deterministic local/mockable gateway at the server boundary.
- [ ] Add thin Product API routes under `apps/desktop-app/src/routes/api/marketing/products/**`.
- [ ] Add thin Persona API routes under `apps/desktop-app/src/routes/api/marketing/products/[productId]/personas/**` or an equivalent Product-scoped route layout.
- [ ] Add a thin Persona generation API route under `apps/desktop-app/src/routes/api/marketing/**`.
- [ ] Ensure API route handlers parse HTTP input, call application services, map errors, and return JSON without importing Drizzle, SQLite schema, or provider SDK clients.
- [ ] Add route smoke tests or equivalent app-level request tests for Product create/list, Persona create/list, invalid input, not-found, and generation failure.

### 5. Frontend adapters and page models

- [ ] Define `MarketingTransport` under `apps/desktop-app/src/lib/adapters/marketing/**`.
- [ ] Implement `web-marketing-transport` with all raw `/api/marketing/**` URL construction isolated in that adapter.
- [ ] Add adapter tests for Product CRUD, Persona CRUD, generation, non-2xx errors, and not-found mapping.
- [ ] Add Product page model(s) under `apps/desktop-app/src/routes/marketing/**` using the transport interface.
- [ ] Add Persona page model(s) under `apps/desktop-app/src/routes/marketing/**` using the transport interface.
- [ ] Add page model tests for loading, creating, editing, deleting, validation errors, and generation errors.

### 6. Shared UI and routes

- [ ] Add reusable Product form/list/detail visual components under `packages/ui/src/lib/marketing/**` where appropriate.
- [ ] Add reusable Persona form/list/detail visual components under `packages/ui/src/lib/marketing/**` where appropriate.
- [ ] Use existing shared UI primitives from `packages/ui`; add missing primitives only when needed.
- [ ] Ensure `packages/ui` marketing components do not import `packages/domain`.
- [ ] Add desktop marketing route pages under `apps/desktop-app/src/routes/marketing/**`.
- [ ] Add or update desktop navigation entry point for the marketing area.
- [ ] Prefer direct per-icon imports from `@lucide/svelte/icons/<icon-name>`.

### 7. I18n

- [ ] Add marketing message keys for visible Product/Persona labels, headings, actions, validation errors, empty states, and generation states in `apps/desktop-app/messages/en.json`.
- [ ] Add corresponding keys in `apps/desktop-app/messages/es.json`.
- [ ] Add corresponding keys in `apps/desktop-app/messages/pt.json`.
- [ ] Add corresponding keys in `apps/desktop-app/messages/ja.json`.
- [ ] Replace inline visible strings in marketing pages with paraglide message calls.

### 8. E2E and validation

- [ ] Add `apps/desktop-app/e2e/marketing/helpers.ts` with navigation and mock-generation helpers.
- [ ] Add Product/Persona CRUD e2e coverage in `apps/desktop-app/e2e/marketing/products-personas.e2e.ts` or equivalent.
- [ ] Add Persona generation e2e coverage with mocked generation route/provider behavior.
- [ ] Run targeted domain tests for shared, application, and infrastructure marketing code.
- [ ] Run desktop unit tests for marketing adapters/page models.
- [ ] Run marketing e2e tests.
- [ ] Run `bun run check:desktop-app`.
- [ ] Run `bunx @fission-ai/openspec@latest validate migrate-marketing-products-personas --type change --no-interactive`.

### 9. Documentation and migration hygiene

- [ ] Update package/app README or nearby docs if new marketing import conventions are introduced.
- [ ] Verify no frontend code imports `domain` package root or server-only modules.
- [ ] Verify no migrated code imports Drizzle/SQLite from the source app.
- [ ] Verify source debug/test routes were not copied as public app routes.
- [ ] Update `.pi/plans/marketing-migration-implementation-plan.md` only if implementation discoveries materially change the plan.
