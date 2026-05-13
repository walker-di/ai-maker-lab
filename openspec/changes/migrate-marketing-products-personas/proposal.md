## Why

`ai-maker-lab` needs to begin migrating the large standalone `marketing-manager` SvelteKit app into the workspace without importing its monolithic route/database/provider structure wholesale. The source app contains broad marketing workflows, but the safest first slice is a narrow vertical migration for marketing Products and Personas.

This slice establishes the target architecture for the rest of the migration: browser-safe shared domain models, application use cases and ports, SurrealDB infrastructure repositories, thin SvelteKit API routes, app-local transport adapters, shared UI components, page models, i18n, and focused validation.

## What Changes

- Add a marketing domain area for Products and Personas.
- Add browser-safe marketing shared types and validation under `packages/domain/src/shared/marketing/**`.
- Add marketing application ports and use cases under `packages/domain/src/application/marketing/**`.
- Add SurrealDB-backed Product and Persona repositories under `packages/domain/src/infrastructure/database/marketing/**`.
- Add an AI/persona generation port and a test/mockable implementation boundary, without requiring live provider calls for the slice.
- Add app/server composition for marketing services in `apps/desktop-app`.
- Add thin `/api/marketing/**` routes for Products and Personas.
- Add app-local marketing web transport adapters.
- Add initial marketing pages and page models for listing, creating, editing, and deleting Products and Personas.
- Add reusable Product and Persona form/list components to `packages/ui` where appropriate.
- Add paraglide i18n keys for visible marketing UI strings in all existing app locales.
- Add repository, application, adapter/page-model, and e2e tests for the migrated slice.

Out of scope for this first slice:

- Canvas editor migration.
- Video export/ffmpeg migration.
- Full creative subtype migration beyond data model placeholders needed for future compatibility.
- Campaigns, strategies, stories, scenes, clips, BGM, transitions, and canvas templates.
- Live AI provider integration tests.
- Migrating source debug/test routes as production routes.

## Capabilities

### New Capabilities

- Users can access a marketing area in the desktop app.
- Users can create, list, view, edit, and delete marketing Products.
- Users can create, list, view, edit, and delete Personas associated with a Product.
- Users can trigger Persona generation through an application port that is mockable in tests and ready for provider-backed infrastructure in later slices.
- Product and Persona data persists through SurrealDB repositories.
- Marketing UI uses shared UI primitives/components and localized strings.

### Modified Capabilities

- Workspace exports are extended so browser-safe marketing types are available through `domain/shared`.
- Server/native composition is extended so marketing use cases and infrastructure adapters are available through `domain/application` and `domain/infrastructure`.
- Desktop app navigation gains an entry point for the marketing slice.

## Impact

This change adds a new feature area without changing existing chat, todo, game, or settings flows. It introduces the architectural migration path for the larger marketing-manager app while limiting first-slice risk.

Persistence behavior changes from the source app's SQLite/Drizzle model to SurrealDB repositories following `ai-maker-lab` test and architecture rules. API routes remain app-local adapters, so page models and shared UI do not depend on raw `/api/**` URLs or server-only modules.
