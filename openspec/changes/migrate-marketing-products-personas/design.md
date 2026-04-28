## Context

This change starts migrating the standalone `marketing-manager` SvelteKit app into `ai-maker-lab` with a narrow first slice: marketing Products and Personas. The source app currently mixes SvelteKit routes, Drizzle/SQLite persistence, provider SDK calls, and UI concerns. The target repo is a Bun workspace with clean boundaries:

- `packages/domain/src/shared/**` for browser-safe models, value objects, and pure helpers.
- `packages/domain/src/application/**` for use cases and ports.
- `packages/domain/src/infrastructure/**` for SurrealDB and runtime/provider adapters.
- `packages/ui/**` for reusable Svelte UI.
- `apps/desktop-app/**` for routing, composition, runtime wiring, and app-local transports.

The first slice should create the repeatable migration pattern without taking on canvas, ffmpeg, full creative/media workflows, or live AI provider complexity.

## Goals / Non-Goals

**Goals:**

- Add Products and Product-scoped Personas as a usable marketing feature area.
- Use SurrealDB repositories instead of copying SQLite/Drizzle data access.
- Keep shared marketing models browser-safe and importable from `domain/shared`.
- Keep use cases and ports in `domain/application`.
- Keep SurrealDB and provider implementations in `domain/infrastructure`.
- Keep SvelteKit API routes thin and app-local.
- Keep page models dependent on app-local transport adapters, not raw `/api/**` URLs.
- Use shared UI primitives/components from `packages/ui` where reusable.
- Localize visible marketing UI strings in all existing desktop app locales.
- Add tests around architecture seams, especially repositories and page models.

**Non-Goals:**

- Migrating the entire marketing-manager route tree.
- Migrating canvas/Fabric.js editor behavior.
- Migrating video export, ffmpeg orchestration, BGM, transitions, stories/scenes/clips, or campaign workflows.
- Adding live Anthropic/OpenAI/Gemini/Replicate/TTS calls to CI tests.
- Migrating source debug/test routes as production routes.
- Replacing existing app navigation or non-marketing features.

## Decisions

### 1. Implement a vertical slice instead of a bulk copy

The migration will build Products and Personas end-to-end through domain, infrastructure, API, adapter, UI, and tests. This provides a template for later creative/story/canvas/media slices while limiting risk.

**Alternatives considered:**

- Bulk-copy the source app into `apps/desktop-app`: rejected because it would violate workspace boundaries, preserve Drizzle/provider coupling, and create a large untested surface.
- Start with canvas editor migration: rejected because Fabric.js and browser-only behavior are high-risk and not necessary to establish domain/persistence/API patterns.

### 2. Define shared marketing models in `domain/shared`

Product and Persona types, input types, validation helpers, and domain error/result shapes will live in `packages/domain/src/shared/marketing/**`. These modules must avoid SvelteKit, Svelte, SurrealDB, Drizzle, filesystem, provider SDK, and Fabric.js imports.

**Alternatives considered:**

- Define types inside `apps/desktop-app`: rejected because future apps should consume the same contracts.
- Import source Drizzle schema into frontend models: rejected because it is server-only and not compatible with the target architecture.

### 3. Put use cases and ports in `domain/application`

Application services will coordinate Product CRUD, Persona CRUD, and Persona generation. Repository interfaces and generation provider ports will be defined in application code. DB-backed use cases should be tested with real Surreal repositories when persistence is involved.

**Alternatives considered:**

- Keep business logic in SvelteKit routes: rejected because route handlers should be thin adapters.
- Use hand-rolled in-memory repositories in DB-backed service tests: rejected by repo testing rules for database-backed ports.

### 4. Use SurrealDB repositories as infrastructure

Products and Personas will persist through `SurrealMarketingProductRepository` and `SurrealMarketingPersonaRepository` or equivalent. Repository methods will normalize Surreal IDs to plain string IDs and return browser-safe domain objects.

Product deletion semantics must be explicit. For the first slice, Product deletion should either delete associated Personas or reject deletion while Personas exist; the implementation must document and test the chosen behavior. Prefer rejecting deletion with children if that is simpler and safer for a first slice.

**Alternatives considered:**

- Port SQLite tables directly: rejected because the target repo standard is SurrealDB.
- Hide cascade behavior as an implicit database side effect: rejected because Surreal relationship semantics differ and must be test-covered.

### 5. Model Persona generation as a provider port

Persona generation will use an application port, e.g. `MarketingPersonaGenerator`, that receives Product context and returns generated Persona data. First-slice automated tests will use a mock implementation. A live provider gateway can be added behind the same port, but live credentials must not be required for tests.

**Alternatives considered:**

- Construct Gemini/OpenAI/Anthropic clients in API routes: rejected because provider selection belongs at composition/infrastructure boundaries.
- Skip generation entirely: rejected because Persona generation is a core source-app workflow and a useful proof of adapterized provider design.

### 6. Keep app composition in `apps/desktop-app/src/lib/server/**`

The desktop app will compose marketing repositories, provider gateways, and use cases in a server-only composition module, likely `apps/desktop-app/src/lib/server/marketing-service.ts`. API routes will import this composition surface rather than instantiate dependencies inline.

**Alternatives considered:**

- Compose dependencies in every route: rejected because it duplicates wiring and encourages direct SDK/database coupling.

### 7. Use app-local web transports for frontend API calls

Frontend page models will depend on a `MarketingTransport` interface and a web implementation under `apps/desktop-app/src/lib/adapters/marketing/**`. Raw route URLs belong only in the web transport implementation.

**Alternatives considered:**

- Call `fetch('/api/marketing/...')` inside page models: rejected by adapter pattern contract.
- Put transports in `packages/ui`: rejected because transport is app/runtime-specific.

### 8. Keep reusable UI in `packages/ui`

Product and Persona forms/lists may live in `packages/ui/src/lib/marketing/**` when reusable and visual. They should not import `domain`; use structural local prop types or primitive props. App routes remain responsible for page composition, adapters, and localized text wiring where appropriate.

**Alternatives considered:**

- Recreate shadcn primitives in `apps/desktop-app`: rejected because the repo standard is shared UI primitives in `packages/ui`.
- Put page-level composition components in `packages/ui`: rejected when components need app-specific routing/transport/i18n wiring.

### 9. Validate through seams rather than exhaustive source parity

The first slice will include:

- Shared validation tests.
- Surreal repository integration tests with `mem://` and unique namespace/database per file.
- Application service tests with real repositories for DB-backed operations and mocks only for provider ports.
- Web transport/page model tests.
- At least one Playwright e2e path for Product/Persona CRUD and mocked generation.
- `check:desktop-app` and build/type validation.

**Alternatives considered:**

- Rely on manual testing: rejected because the source app has little automated coverage and the migration changes persistence architecture.
- Unit-test Fabric/canvas in jsdom during this slice: rejected as out of scope and not reliable.

## Risks / Trade-offs

- The source app has minimal automated coverage, so expected behavior must be inferred from source code and README during implementation.
- SurrealDB model decisions may need adjustment when later slices add campaigns, creatives, stories, and assets.
- Product deletion with associated Personas needs a chosen policy; rejecting deletion with children is safer but may differ from source behavior.
- Persona generation contract may evolve once live provider gateways are migrated.
- Adding shared UI components may require adding missing shadcn primitives to `packages/ui`.
- Localization across four locales adds overhead; placeholder translations may be necessary if exact translations are not available.
- Keeping the slice narrow means users will not yet have full marketing-manager parity after this change.
