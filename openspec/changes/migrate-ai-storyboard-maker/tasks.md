## Implementation Tasks

### 1. Domain contracts and validation

- [x] 1.1 Decide and document the final mapping between UI Storyboard/Frame DTOs and existing marketing Story/Scene/Clip records.
- [x] 1.2 Add storyboard browser-safe DTOs and metadata fields in `packages/domain/src/shared/marketing/**`.
- [x] 1.3 Add Zod schemas for create storyboard, generate frames, insert blank frame, update frame text/prompts, regenerate prompt, generate assets, reorder/delete frame, update transition, and export.
- [x] 1.4 Export new shared contracts through `packages/domain/src/shared/marketing/index.ts` and `domain/shared`.
- [x] 1.5 Add shared validation tests for required prompts, frame order, transition defaults/validation, generated asset URLs, and DTO rejection cases.

### 2. Application services and ports

- [x] 2.1 Extend `packages/domain/src/application/marketing/ports.ts` with storyboard text generation, prompt regeneration, image generation, narration audio, BGM/media, repository, and video export capabilities as needed.
- [x] 2.2 Add or extend application use cases for create/list/open storyboard.
- [x] 2.3 Add frame use cases for AI generation, blank insertion, edit, reorder, delete, and order normalization.
- [x] 2.4 Add prompt regeneration and per-frame asset generation use cases.
- [x] 2.5 Add transition update and unified export use cases.
- [x] 2.6 Add application tests using real SurrealDB-backed repositories where persistence behavior is relevant and mocks only for external AI/media/export ports.

### 3. SurrealDB persistence

- [x] 3.1 Extend Surreal schema/init queries if new storyboard metadata fields or indexes are required.
- [x] 3.2 Extend `SurrealStoryRepository`, `SurrealSceneRepository`, and/or `SurrealClipRepository` mappers to persist storyboard metadata without leaking `RecordId` objects.
- [x] 3.3 Add repository methods for ordered frame lookup, append, insert with shifting, adjacent reorder, delete, and compacting if needed.
- [x] 3.4 Add repository tests with `createDbConnection({ host: 'mem://' })`, unique namespace/database per test, and closed DB connections.

### 4. AI/media/export infrastructure

- [x] 4.1 Extend or add an AI SDK storyboard text gateway for structured frame generation and prompt regeneration.
- [x] 4.2 Add tests for valid/invalid structured JSON parsing, code-fence compatibility if supported, schema rejection, and provider error mapping.
- [x] 4.3 Extend Replicate media gateway for main/background image generation and required aspect ratio inputs.
- [x] 4.4 Reuse/extend Azure narration gateway for frame narration audio with current env var conventions.
- [x] 4.5 Reuse/extend BGM generation support for frame BGM prompts.
- [x] 4.6 Extend FFmpeg/video exporter for ordered storyboard unified export and transition intent.
- [x] 4.7 Add gateway/export tests for missing keys, normalized outputs, command/input ordering, and temp cleanup.

### 5. Desktop server composition and API adapters

- [x] 5.1 Wire new storyboard services/ports/repositories/gateways in `apps/desktop-app/src/lib/server/marketing-service.ts`.
- [x] 5.2 Add thin SvelteKit API routes under `apps/desktop-app/src/routes/api/marketing/storyboards/**` for the storyboard operations.
- [x] 5.3 Ensure routes parse/validate inputs, delegate to application services, log detailed server errors in catch blocks, and return controlled JSON/blob responses.
- [x] 5.4 Add route/adapter tests for validation, unknown IDs, happy paths, and error mapping where route-level coverage is practical.

### 6. Frontend transport and page models

- [x] 6.1 Add `StoryboardTransport` interface and web implementation under `apps/desktop-app/src/lib/adapters/storyboard/**`.
- [x] 6.2 Ensure only transport adapters know concrete `/api/marketing/storyboards/**` paths.
- [x] 6.3 Add list page model/composition for `apps/desktop-app/src/routes/experiments/storyboard/**`.
- [x] 6.4 Add detail page model/composition for selected storyboard/frame editing workflows.
- [x] 6.5 Add model tests for loading, create, generate frames, insert, edit, reorder, delete, regenerate prompt, generate/attach assets, transition update, export success, and export failure.

### 7. Shared shadcn UI components

- [x] 7.1 Add `packages/ui/src/lib/storyboard/types.ts` with structural UI types and no domain imports.
- [x] 7.2 Add storyboard list components: shell, list, card, empty state, and create dialog.
- [x] 7.3 Add storyboard editor components: editor, frame card, frame preview, prompt tabs, audio controls, transition control, and export progress panel.
- [x] 7.4 Add dialogs for add frames, asset selection/upload, prompt regeneration, and transition editing.
- [x] 7.5 Use shared shadcn-svelte primitives and direct Lucide icon imports; do not port Bootstrap classes/modal behavior.
- [x] 7.6 Add UI browser/component tests for accessible labels/buttons, dialog behavior, frame controls, loading/empty/error states, and callback wiring.

### 8. Route wiring and navigation

- [x] 8.1 Add `apps/desktop-app/src/routes/experiments/storyboard/+page.svelte` and optional `[storyboardId]` detail route.
- [x] 8.2 Compose page models with `createStoryboardTransport()` and shared UI components.
- [x] 8.3 Add Storyboard Maker navigation in `apps/desktop-app/src/lib/components/AppSidebar.svelte`.
- [x] 8.4 Verify frontend imports browser-safe domain contracts only from `domain/shared` and shared UI from `ui/source`.

### 9. E2E and validation

- [x] 9.1 Add Playwright e2e smoke test for create storyboard, generate mocked frames, edit/reorder frames, set transition, attach/generate mocked assets, and export success/error affordance.
- [x] 9.2 Keep live provider tests skipped behind env flags.
- [x] 9.3 Run `bunx @fission-ai/openspec@latest validate migrate-ai-storyboard-maker --type change --no-interactive`.
- [x] 9.4 Run `bun run check:desktop-app` from repo root.
- [ ] 9.5 Run `cd packages/domain && bun test`.
- [ ] 9.6 Run `cd apps/desktop-app && bun run test:unit`.
- [x] 9.7 Run targeted storyboard e2e validation from `apps/desktop-app`.
