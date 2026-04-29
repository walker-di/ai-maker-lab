# AI Storyboard Maker Migration Implementation Plan

## Summary
- Goal: migrate the AI storyboard maker from `/Users/walker/Documents/Dev/vibe-coding/003-ai-storyboard-creator` into `ai-maker-lab` as a first-class SvelteKit/Bun workspace feature using shared `packages/ui` shadcn-svelte primitives and `packages/domain` clean architecture boundaries.
- Assumptions:
  - The migrated feature should preserve the source app's core workflows: create storyboard, generate frames from a prompt, insert/edit/reorder/delete frames, regenerate prompts, generate/select/upload assets, configure transitions, and export media/video.
  - Persistence should use this repo's SurrealDB infrastructure, not the source repo's Drizzle/SQLite stack.
  - AI/media integrations should reuse or extend existing marketing gateways where practical.
  - The app route can live under `/experiments/storyboard` while backend/domain storage reuses/extends the marketing Story/Scene/Clip model behind a storyboard-oriented API.
- Non-goals:
  - No Bootstrap migration; source Bootstrap markup/modals should be replaced by shared UI/shadcn components.
  - No direct copy of source route handlers, DB schema, or FFmpeg utilities.
  - No direct `/api/**` URL construction inside pages, page models, or shared UI components.

## Source Reports
-[x] ✅ UI/frontend planning report incorporated: `plan-ui-storyboard`
-[x] ✅ Backend planning report incorporated: `plan-backend-storyboard`
-[x] ✅ Tests planning report incorporated: `plan-tests-storyboard`

## Architecture Validation
- ✅ Clean architecture boundaries: shared contracts live in `packages/domain/src/shared/marketing`; use cases/ports live in `packages/domain/src/application/marketing`; SurrealDB, AI, storage, and FFmpeg implementations stay in infrastructure/app server composition.
- ✅ Svelte 5/frontend idioms: route `+page.svelte` files remain visual and thin; route-local `.svelte.ts` page models own state; shared UI components live in `packages/ui/src/lib/storyboard` and use structural local type mirrors.
- ✅ API/infrastructure boundaries: app-local `StoryboardTransport` adapters translate UI intent into HTTP/RPC; only adapters know concrete API paths.
- ✅ i18n/accessibility: all dialogs/forms need explicit labels, accessible buttons, keyboard-friendly shadcn Dialog/Tabs/Select usage, and no Bootstrap-only behavior.
- ✅ Testing strategy: domain/application tests mock only external AI/media gateways; repository tests use real SurrealDB `mem://`; frontend model/component/e2e tests cover the critical workflows.

## Implementation Checklist

### UI/frontend
-[ ] Add app route shell at `apps/desktop-app/src/routes/experiments/storyboard/+page.svelte`.
-[ ] Add route model/composition files:
  - `apps/desktop-app/src/routes/experiments/storyboard/storyboard-page.svelte.ts`
  - `apps/desktop-app/src/routes/experiments/storyboard/storyboard-page.composition.ts`
  - `apps/desktop-app/src/routes/experiments/storyboard/[storyboardId]/+page.svelte`
  - `apps/desktop-app/src/routes/experiments/storyboard/[storyboardId]/storyboard-detail-page.svelte.ts`
  - `apps/desktop-app/src/routes/experiments/storyboard/[storyboardId]/storyboard-detail-page.composition.ts`
-[ ] Add shared UI storyboard barrel/types/components under `packages/ui/src/lib/storyboard/`, including:
  - `StoryboardShell.svelte`, `StoryboardList.svelte`, `StoryboardCard.svelte`, `StoryboardEmptyState.svelte`
  - `StoryboardEditor.svelte`, `StoryboardFrameCard.svelte`, `StoryboardFramePreview.svelte`, `StoryboardFramePromptTabs.svelte`, `StoryboardFrameAudioControls.svelte`, `StoryboardTransitionControl.svelte`
  - `CreateStoryboardDialog.svelte`, `AddFramesDialog.svelte`, `AssetSelectionDialog.svelte`, `PromptRegenerationDialog.svelte`, `TransitionDialog.svelte`, `ExportProgressPanel.svelte`
-[ ] Use shadcn-svelte primitives from `ui/source` such as Button, Card, Dialog, Input, Textarea, Tabs, Select, Badge, ScrollArea, Separator, Skeleton, Tooltip, and Progress if available.
-[ ] Add `apps/desktop-app/src/lib/adapters/storyboard/StoryboardTransport.ts`, `create-storyboard-transport.ts`, `web-storyboard-transport.ts`, and `download-blob.ts`.
-[ ] Add a sidebar navigation item in `apps/desktop-app/src/lib/components/AppSidebar.svelte` using direct Lucide icon imports.
-[ ] Replace source Bootstrap modal/tab/card patterns with accessible shared UI/shadcn patterns.
-[ ] Keep `packages/ui` independent of `packages/domain`; expose local structural UI mirrors in `packages/ui/src/lib/storyboard/types.ts`.

### Backend
-[ ] Create/validate OpenSpec change `openspec/changes/migrate-ai-storyboard-maker/` before implementation.
-[ ] Decide final bounded language in specs: app-visible "Storyboard Maker" backed by marketing Story/Scene/Clip infrastructure.
-[ ] Extend browser-safe shared marketing contracts in:
  - `packages/domain/src/shared/marketing/story-types.ts`
  - `packages/domain/src/shared/marketing/validation.ts`
  - `packages/domain/src/shared/marketing/index.ts`
-[ ] Add storyboard DTOs/validation for create, generate frames, insert blank frame, update frame text, regenerate prompt, generate assets, reorder/delete frame, update transition, and export.
-[ ] Add or extend application use cases/ports in:
  - `packages/domain/src/application/marketing/ports.ts`
  - `packages/domain/src/application/marketing/story-service.ts`
  - optionally `packages/domain/src/application/marketing/storyboard-generation-service.ts`
-[ ] Add ports for structured storyboard text generation, prompt regeneration, aspect-ratio image generation, narration audio, BGM, and transition-aware video export.
-[ ] Extend Surreal mappers/repositories in `packages/domain/src/infrastructure/database/marketing/` for storyboard prompt/asset/transition metadata and ordered frame operations.
-[ ] Extend `packages/domain/src/infrastructure/ai/marketing/AiSdkMarketingTextGateway.ts` or add a storyboard-specific gateway for structured frame generation.
-[ ] Reuse/extend app server gateways:
  - `apps/desktop-app/src/lib/server/marketing/gateways/ReplicateMarketingMediaGateway.ts`
  - `apps/desktop-app/src/lib/server/marketing/gateways/AzureSpeechNarrationGateway.ts`
  - `apps/desktop-app/src/lib/server/marketing/gateways/FfmpegMarketingVideoExporter.ts`
-[ ] Wire new services in `apps/desktop-app/src/lib/server/marketing-service.ts`.
-[ ] Add thin API adapters under `apps/desktop-app/src/routes/api/marketing/storyboards/**` or explicitly extend existing `/api/marketing/stories/**` endpoints.
-[ ] Avoid adding source dependencies such as Bootstrap, Drizzle, SQLite, `better-sqlite3`, or source-specific static asset assumptions.

### Tests
-[ ] Add shared validation tests such as `packages/domain/src/shared/marketing/storyboard-validation.test.ts`.
-[ ] Add application/use-case tests such as `packages/domain/src/application/marketing/storyboard-service.test.ts`, using real SurrealDB repositories for persistence-backed behavior and mocks only for external AI/media gateways.
-[ ] Add/extend Surreal repository tests in `packages/domain/src/infrastructure/database/marketing/`, using `createDbConnection({ host: 'mem://' })`, unique namespace/database per test, and DB close in `afterEach`.
-[ ] Add AI gateway tests for structured frame JSON parsing, code-fence stripping if retained, schema rejection, prompt-regeneration variants, and provider error mapping.
-[ ] Add media/export gateway tests for missing provider keys, normalized Replicate/Azure outputs, FFmpeg command/input ordering, and cleanup on failure.
-[ ] Add app adapter tests for `apps/desktop-app/src/lib/adapters/storyboard/web-storyboard-transport.test.ts`.
-[ ] Add page model tests for list/create/detail/generate/edit/reorder/delete/transition/export flows.
-[ ] Add UI browser/component tests under `packages/ui/src/lib/storyboard/__tests__/` for dialogs, frame controls, empty/loading/error states, and accessible labels/buttons.
-[ ] Add e2e smoke coverage at `apps/desktop-app/e2e/marketing/storyboard.e2e.ts` or `apps/desktop-app/e2e/storyboard.e2e.ts` with AI/media responses mocked.

### Validation
-[ ] Run `bunx @fission-ai/openspec@latest validate migrate-ai-storyboard-maker --type change --no-interactive`.
-[ ] Run `bun run check:desktop-app` from repo root.
-[ ] Run `cd packages/domain && bun test`.
-[ ] Run `cd apps/desktop-app && bun run test:unit`.
-[ ] Run targeted e2e: `cd apps/desktop-app && bun run test:e2e -- e2e/marketing/storyboard.e2e.ts` or the final chosen path.
-[ ] Browser verify create storyboard → generate frames → edit/reorder/delete frame → generate/select assets → set transition → export mocked video.

## Dependencies and Sequencing
1. Finalize OpenSpec artifacts: proposal, specs, design, tasks.
2. Implement shared/domain contracts and validation first so UI/adapters consume stable types.
3. Implement application services and ports with tests.
4. Extend Surreal repositories and gateway implementations.
5. Add thin API route adapters and app server composition.
6. Add app-local storyboard transport adapters.
7. Build shared UI components and page models against mocked transport.
8. Wire routes/sidebar and complete e2e/browser verification.

## Risks and Mitigations
- ⚠️ Risk: Existing marketing Story/Scene/Clip model may not fully represent source storyboard frame metadata.
  - Mitigation: Add narrowly scoped storyboard metadata fields/DTOs and lock mapping decisions in OpenSpec before implementation.
- ⚠️ Risk: Source feature mixes long-running AI/media/export workflows with route/UI state.
  - Mitigation: Keep long-running behavior behind application services and UI loading/error state; consider progress endpoints only if needed by specs.
- ⚠️ Risk: Export parity with source FFmpeg transitions may be larger than expected.
  - Mitigation: Specify minimum export acceptance first, then add transition fidelity iteratively.
- ⚠️ Risk: Asset URL/storage assumptions differ between source static folders and this app's data asset storage.
  - Mitigation: Reuse `LocalMarketingAssetStorage` and expose URLs only through current app storage conventions.
- ⚠️ Risk: Direct source Bootstrap/Svelte 4 patterns could leak into new code.
  - Mitigation: Treat source as behavior reference only; implement with Svelte 5, `.svelte.ts` models, shared UI, and shadcn primitives.

## Open Questions
- ❓ Should the final user-facing route be `/experiments/storyboard` or under `/marketing/storyboards`? Current plan uses `/experiments/storyboard` while backend uses marketing infrastructure.
- ❓ Should a source "frame" map to one `Scene`, one `Clip`, or a composite Scene+Clip view model? The OpenSpec specs should make this explicit.
- ❓ Should export preserve every source mode (assets ZIP, per-frame video, unified video), or should the first migration ship only unified export plus asset download?
- ❓ What is the required behavior when provider keys are absent: disable actions, show setup prompts, or allow mocked/local-only mode?
