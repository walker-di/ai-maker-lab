## Context

The reference AI storyboard maker is a standalone SvelteKit app using Bootstrap, route-level API logic, Drizzle/SQLite persistence, static asset directories, provider-specific AI/media calls, and FFmpeg export utilities. The target repo is a Bun workspace with:

- `apps/desktop-app` as the SvelteKit desktop shell and runtime composition boundary.
- `packages/ui` as the shared Svelte/shadcn-svelte component surface.
- `packages/domain` as the shared domain/application/infrastructure package.
- Existing marketing domain concepts for Story, Scene, Clip, media assets, AI text generation, Replicate media generation, Azure narration, SurrealDB repositories, local asset storage, and FFmpeg export.

The migration should preserve user-facing storyboard capabilities while adapting the implementation to current repo boundaries.

## Goals / Non-Goals

**Goals:**

- Preserve source workflows: create/list storyboards, generate frames from prompts, insert/edit/reorder/delete frames, regenerate prompts, generate/select/upload assets, configure transitions, and export storyboard media/video.
- Use shadcn-svelte primitives and shared `packages/ui` storyboard components instead of Bootstrap.
- Keep pages thin and use Svelte 5 `.svelte.ts` page models for state/workflow logic.
- Use app-local transport adapters so UI/page models do not construct raw API URLs.
- Persist data through SurrealDB repositories and plain browser-safe domain DTOs.
- Keep AI/media/provider SDKs behind application ports and infrastructure adapters.
- Validate behavior through shared/domain, repository, adapter, page model, component/browser, and e2e tests.

**Non-Goals:**

- Do not migrate Drizzle, SQLite, Bootstrap, or source app static file storage conventions.
- Do not copy the source app's route handlers as business logic.
- Do not make `packages/ui` depend on `packages/domain`.
- Do not call live AI/media providers in default automated tests.
- Do not implement provider-progress streaming unless a later change requires it.

## Decisions

### 1. App-visible Storyboard Maker backed by marketing infrastructure

The UI will present the capability as "Storyboard Maker". Backend/domain implementation will reuse or extend the existing marketing Story/Scene/Clip infrastructure where it fits, instead of creating a completely separate persistence island.

A source "storyboard" maps to a marketing Story-like aggregate. A source "frame" should be exposed to the UI as a storyboard frame DTO, while implementation can map that DTO to Scene/Clip records plus storyboard metadata.

**Alternatives considered:**
- Add a completely standalone `storyboard` domain and tables. Rejected for first migration because existing marketing repositories/gateways/exporters already cover much of the needed asset and video pipeline.
- Force the feature entirely into existing marketing pages. Rejected because the source workflow is prompt-first and should remain discoverable as its own maker flow.

### 2. Route placement starts in experiments, API placement uses marketing storyboards

The first app route should be `apps/desktop-app/src/routes/experiments/storyboard/**` so the migrated tool can land as a lab experiment without disrupting existing marketing Product/Persona flows.

The HTTP adapter paths should live under `apps/desktop-app/src/routes/api/marketing/storyboards/**` unless implementation discovers a clearer fit under existing `/api/marketing/stories/**`.

**Alternatives considered:**
- Place UI under `/marketing/storyboards`. This is viable later if Storyboard Maker becomes part of the main marketing workflow, but the first migration should keep product navigation impact low.

### 3. Shared UI components own visuals; page models own state

Storyboard-specific shared components will live under `packages/ui/src/lib/storyboard/**` and use shadcn-svelte primitives from the existing UI package. They will accept plain props/callbacks and local structural types from `packages/ui/src/lib/storyboard/types.ts`.

Route-local `.svelte.ts` page models in `apps/desktop-app/src/routes/experiments/storyboard/**` will own loading, errors, selected frame, dialog state, mutation flows, and export/download state.

**Alternatives considered:**
- Port source Svelte components directly. Rejected because source components mix visual rendering, Bootstrap JS modals, direct fetch calls, audio state, file download behavior, and business workflow in `.svelte` files.

### 4. Transport adapters isolate HTTP/RPC details

Define a `StoryboardTransport` interface under `apps/desktop-app/src/lib/adapters/storyboard/`. Page models depend on this interface. The web implementation maps operations to `/api/marketing/storyboards/**`, handles JSON/FormData/blob responses, and maps errors.

**Alternatives considered:**
- Let page models call `fetch('/api/...')`. Rejected by project adapter-pattern contract.

### 5. Use application ports for AI/media/export behavior

Structured storyboard frame generation, prompt regeneration, image generation, narration audio, BGM generation, and video export will be represented as application ports. Provider-specific SDKs and filesystem/FFmpeg details stay in infrastructure/app server adapters.

VibeVoice narration should be modeled as a dedicated local adapter path that can resolve GGUF-backed models such as `gguf-org/vibevoice-gguf` or equivalent published VibeVoice GGUF repos. MMS/Qwen Hugging Face local narration remains on the existing Hugging Face local adapter, while VibeVoice can expose prompt/reference-audio speaker guidance instead of a fixed catalog when the selected model is voice-design or custom-voice driven.

**Alternatives considered:**
- Copy `aiService.ts` and FFmpeg utilities from the source repo. Rejected because they couple provider details, file layout, and route logic to the app layer.

### 6. SurrealDB is the only persistence target for the migration

Storyboard data must be persisted using existing SurrealDB connection/repository patterns. Repository tests must use `createDbConnection({ host: 'mem://' })` with unique namespaces/databases.

**Alternatives considered:**
- Add source Drizzle/SQLite schema and dependencies. Rejected by workspace architecture and test rules.

### 7. Export parity is staged around a unified-video acceptance path

The specs require at least unified video export plus clear error handling for unexportable frames. Asset ZIP/per-frame exports can be implemented if they are low-cost, but the first acceptance path should prioritize ordered unified export through the current FFmpeg exporter.

**Alternatives considered:**
- Require every source export mode in the first implementation. Rejected because transition-aware FFmpeg parity is likely the highest-risk area and should be scoped by tests/specs.

## Proposed File Map

### Domain/shared

- `packages/domain/src/shared/marketing/story-types.ts`
- `packages/domain/src/shared/marketing/validation.ts`
- `packages/domain/src/shared/marketing/index.ts`
- optional `packages/domain/src/shared/marketing/storyboard-types.ts`

### Domain/application

- `packages/domain/src/application/marketing/ports.ts`
- `packages/domain/src/application/marketing/story-service.ts`
- optional `packages/domain/src/application/marketing/storyboard-generation-service.ts`

### Domain/infrastructure

- `packages/domain/src/infrastructure/database/marketing/SurrealStoryRepository.ts`
- `packages/domain/src/infrastructure/database/marketing/SurrealSceneRepository.ts`
- `packages/domain/src/infrastructure/database/marketing/SurrealClipRepository.ts`
- `packages/domain/src/infrastructure/ai/marketing/AiSdkMarketingTextGateway.ts`

### Desktop app server/API

- `apps/desktop-app/src/lib/server/marketing-service.ts`
- `apps/desktop-app/src/lib/server/marketing/gateways/ReplicateMarketingMediaGateway.ts`
- `apps/desktop-app/src/lib/server/marketing/gateways/AzureSpeechNarrationGateway.ts`
- `apps/desktop-app/src/lib/server/marketing/gateways/FfmpegMarketingVideoExporter.ts`
- `apps/desktop-app/src/routes/api/marketing/storyboards/**`

### Desktop app frontend

- `apps/desktop-app/src/routes/experiments/storyboard/+page.svelte`
- `apps/desktop-app/src/routes/experiments/storyboard/storyboard-page.svelte.ts`
- `apps/desktop-app/src/routes/experiments/storyboard/storyboard-page.composition.ts`
- `apps/desktop-app/src/routes/experiments/storyboard/[storyboardId]/+page.svelte`
- `apps/desktop-app/src/routes/experiments/storyboard/[storyboardId]/storyboard-detail-page.svelte.ts`
- `apps/desktop-app/src/routes/experiments/storyboard/[storyboardId]/storyboard-detail-page.composition.ts`
- `apps/desktop-app/src/lib/adapters/storyboard/**`
- `apps/desktop-app/src/lib/components/AppSidebar.svelte`

### Shared UI

- `packages/ui/src/lib/storyboard/index.ts`
- `packages/ui/src/lib/storyboard/types.ts`
- `packages/ui/src/lib/storyboard/*.svelte`
- `packages/ui/src/lib/storyboard/__tests__/**`

## Risks / Trade-offs

- Existing Story/Scene/Clip types may not exactly match source frame semantics.
- VibeVoice GGUF runtime availability may vary by platform and packaging strategy.
  - Mitigation: keep model selection and runtime probing behind the narration adapter boundary, and surface recoverable setup/download errors in the UI.
  - Mitigation: expose a storyboard frame DTO and explicitly map it at the application/repository boundary.
- Background images and BGM prompts may require metadata not currently present on Scene/Clip.
  - Mitigation: add narrowly scoped metadata fields and validation rather than broad generic blobs.
- Transition-aware unified export may be larger than expected.
  - Mitigation: lock minimum export behavior in tests and preserve clear extension points for richer transitions.
- Provider keys may be absent in local/test environments.
  - Mitigation: default tests mock ports; UI surfaces provider-disabled errors instead of crashing.
- App route under `/experiments/storyboard` while APIs use `/api/marketing/storyboards/**` may look inconsistent.
  - Mitigation: document that app route placement is product/navigation-level, while backend reuse is implementation-level; transport adapters hide HTTP paths from UI.
- Long-running AI/media/export operations can create stale UI state.
  - Mitigation: page models track pending states per operation and refresh authoritative data after mutations.
