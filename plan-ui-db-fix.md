# UI/frontend plan — AI Storyboard Maker DB failure and browser bundle warnings

Planning only; no implementation performed.

## 1. UI problem framing

- In `bun run dev:web`, `/api/marketing/storyboards` can return HTTP 500 because server-side SurrealDB connection to `surrealkv://.../data/surrealdb/desktop-web.db` times out.
- The current storyboard page surfaces the raw error string in a destructive banner but still renders the normal empty-state create UI because `model.storyboards` remains `[]`. This makes an unavailable backend look like a legitimate empty account/project.
- All storyboard CRUD buttons remain discoverable even though the required API is unavailable, so the user can repeatedly trigger failing operations.
- The raw backend error includes local filesystem details. The browser UI should show a safe, actionable message and optionally keep technical details behind a collapsible/debug affordance.
- Browser console warnings for `path`, `fs`, `url`, and `source-map-js` appear to be a client bundle hygiene problem. In the inspected storyboard page/adapter files I did **not** find direct runtime imports from `domain/application`, `domain/infrastructure`, SurrealDB, or Node APIs. Evidence from `apps/desktop-app/node_modules/.vite/deps/_metadata.json` and generated deps points to `ui > sanitize-html` (`ui___sanitize-html.js` contains `browser-external:path`, `browser-external:fs`, `browser-external:url`, and `browser-external:source-map-js`). The likely cause is importing from the broad `ui/source` barrel, which exports chat/markdown code in addition to storyboard components.

## 2. Relevant frontend files and patterns

- `apps/desktop-app/src/routes/experiments/storyboard/+page.svelte`
  - Thin route view using `createStoryboardPageComposition()` and shared `ui/source` storyboard components.
  - Currently calls `model.load()` in `$effect` and shows one generic error banner.
  - Hardcoded English page copy.
- `apps/desktop-app/src/routes/experiments/storyboard/storyboard-page.composition.ts`
  - Correct app composition seam: creates the page model with `createStoryboardTransport()`.
- `apps/desktop-app/src/routes/experiments/storyboard/storyboard-page.svelte.ts`
  - Correct Svelte 5 page-model location for UI state and async orchestration.
  - Current state is too coarse: one `isLoading` flag and one `error` string for initial load, mutations, and export.
- `apps/desktop-app/src/lib/adapters/storyboard/web-storyboard-transport.ts`
  - Correctly keeps `/api/marketing/storyboards/**` paths inside the adapter.
  - Current error handling throws plain `Error(message)` and loses HTTP status/error kind.
  - Type-only imports from `domain/shared` are browser-safe.
- `packages/ui/src/lib/storyboard/**`
  - Shared UI components are structural and do not import domain/server code.
  - Components use Svelte 5 `$props()` and callback props.
  - Many strings are hardcoded in English because shared UI cannot import app-local Paraglide messages directly.
- `packages/ui/src/lib/index.ts`
  - Broad barrel exports chat, agent registry, platformer, RTS, marketing, and storyboard surfaces. Importing storyboard components through this barrel can cause unrelated dependencies to enter the dev client graph.
- Related global import sites:
  - `apps/desktop-app/src/routes/+layout.svelte` imports `Separator` and `Sidebar` from `ui/source`.
  - `apps/desktop-app/src/lib/components/AppSidebar.svelte` imports `Sidebar` from `ui/source` and has hardcoded Storyboard title.
  - These global imports can keep broad-barrel warnings present even if the storyboard route import is narrowed.

## 3. Proposed component/domain structure changes

- Add a shared UI error surface for API/backend-unavailable states:
  - Prefer `StoryboardErrorState.svelte` or extend `StoryboardEmptyState.svelte`/`StoryboardShell.svelte` with an explicit error slot/variant.
  - Props should be structural, e.g. `title`, `description`, `technicalDetails?`, `retryLabel`, `onRetry`, `isRetrying`.
  - Keep it in `packages/ui/src/lib/storyboard/` because it is reusable storyboard UI, not app transport logic.
- Keep backend/transport concerns out of shared UI:
  - Shared components should receive display-ready error copy and callbacks only.
  - Do not import `domain/*`, SvelteKit, or API paths into `packages/ui/src/lib/storyboard/**`.
- Introduce typed UI copy boundaries:
  - Add a `StoryboardCopy`/component-level copy prop in `packages/ui/src/lib/storyboard/types.ts` or individual component props.
  - App route imports Paraglide `m` and passes localized strings to shared UI components.
  - Avoid importing `$lib/paraglide/messages.js` from `packages/ui`.
- Narrow UI package imports to avoid unrelated browser dependencies:
  - Add package subpath exports for storyboard and selected primitives, e.g. `ui/source/storyboard`, `ui/source/components/ui/sidebar`, `ui/source/components/ui/separator` if the project accepts granular exports.
  - Update storyboard route imports from broad `ui/source` to the storyboard-specific subpath.
  - Also update global layout/sidebar imports away from broad `ui/source`; otherwise broad-barrel warnings can remain globally.
- Do not create a new frontend domain layer for this fix. The existing route page model + transport adapter pattern is sufficient.

## 4. State/model/data-flow plan

- In `web-storyboard-transport.ts`, preserve the adapter boundary but return richer errors:
  - Add a `StoryboardTransportError` shape/class with `status`, `kind`, `userMessage`, and optional `technicalMessage`.
  - Map HTTP/network cases:
    - `500` with DB connection/timeout text → `kind: 'backend-unavailable'`, safe message such as “Storyboard storage is unavailable. Check the local database service/configuration, then retry.”
    - `404` → `kind: 'not-found'`.
    - `400`/validation → `kind: 'validation'`.
    - failed `fetch`/non-JSON response → `kind: 'network'` or `kind: 'server'`.
  - Do not expose local filesystem paths in the primary UI message.
- In `storyboard-page.svelte.ts`, split page state:
  - `initialLoadStatus: 'idle' | 'loading' | 'ready' | 'error'`.
  - `initialLoadError` for list/bootstrap failure.
  - `operationError` for create/generate/save/export failures after the page is usable.
  - Keep `exportStatus` separate, but store export-specific error rather than reusing global `error`.
  - Add `canUseStoryboardApi`/`isBackendUnavailable` derived values to gate create and mutation affordances.
- Initial load behavior:
  - If listing fails, render the new error state instead of `StoryboardList` empty state.
  - Provide a Retry button wired to `model.load`.
  - Keep create dialog closed and disable create/generate/export actions until load succeeds.
- Mutation behavior:
  - For create/generate/update failures, keep current data on screen and show an operation-level alert near the relevant controls or at top of shell.
  - Do not clear selected storyboard on transient mutation errors.
  - Refresh authoritative selected/detail data only after successful mutations.
- Add tests:
  - Page model test for initial `listStoryboards()` 500/transport error sets error state and does not present an empty-state-ready condition.
  - Transport test for JSON and non-JSON 500 responses, including DB-timeout message mapping.
  - Browser/component test for error state retry button and `role="alert"`/accessible messaging.
  - E2E route-mocked test where `GET /api/marketing/storyboards` returns 500 and UI shows the backend-unavailable state, not “No storyboards yet”.

## 5. i18n/accessibility plan

- Add Paraglide message keys in all app message files (`en`, `es`, `ja`, `pt`) for:
  - Storyboard nav label and page title/intro.
  - Empty state title/description/action.
  - Loading labels.
  - Backend-unavailable error title/description/retry.
  - Generic server/network/validation error fallbacks.
  - Dialog labels/buttons currently hardcoded in shared components if those components are touched.
- `packages/ui` must remain i18n-framework-agnostic:
  - Pass localized strings from `+page.svelte` or a small route-local copy factory.
  - Shared components should use copy props, not Paraglide imports.
- Accessibility specifics:
  - Render API outage in a semantic alert region: `role="alert"` or `aria-live="polite"` depending on interruptiveness.
  - Retry must be a real `<button>` with disabled/loading text while retrying.
  - If an error appears after dialog submission, keep focus in the dialog and associate inline validation with inputs where relevant.
  - Do not show both “No storyboards yet” and a fatal load error simultaneously.
  - Maintain existing icon-only button `aria-label`s; add labels for any new dismiss/details buttons.

## 6. Risks, assumptions, and dependencies on backend

- Backend dependency: the critical outage still requires a backend/server-runtime fix. UI can only explain and recover from the failed API state. The likely backend area is `apps/desktop-app/src/lib/server/marketing-service.ts` / `packages/domain/src/infrastructure/database/client.ts` connection configuration for `dev:web`.
- Assumption: `dev:web` should either use a reachable SurrealDB mode (`mem://` for dev/test or a correctly configured remote/embedded host) or fail quickly with a controlled API error.
- Risk: If the server returns raw `Error.message` from `toMarketingErrorResponse`, local paths may continue to reach the client. Frontend can sanitize display copy, but backend should also avoid returning sensitive internal details.
- Risk: Narrowing `ui/source` imports may require adding package export subpaths in `packages/ui/package.json`. This is frontend/package-boundary work but affects import conventions.
- Risk: Broad `ui/source` imports in `+layout.svelte` and `AppSidebar.svelte` are global; the browser warnings may persist unless those are also narrowed.
- Finding: The inspected storyboard files do not appear to pull SurrealDB/server modules into the client. The observed externalized modules are reproducible in the Vite optimized dependency for `sanitize-html`, likely reached through the UI barrel/chat markdown exports.

## 7. UI checklist items with file paths

- `apps/desktop-app/src/routes/experiments/storyboard/storyboard-page.svelte.ts`
  - Split initial load, mutation, and export error state.
  - Add retry/load failure semantics and derived backend-unavailable state.
- `apps/desktop-app/src/routes/experiments/storyboard/+page.svelte`
  - Render fatal load error state instead of empty list when initial load fails.
  - Pass localized copy into shared storyboard components.
  - Import storyboard UI through a narrow UI subpath once available.
- `apps/desktop-app/src/lib/adapters/storyboard/web-storyboard-transport.ts`
  - Map HTTP/non-JSON/network failures to typed, display-safe transport errors.
  - Preserve `/api/marketing/storyboards/**` isolation in this adapter.
- `apps/desktop-app/src/lib/adapters/storyboard/StoryboardTransport.ts`
  - Export/define the typed transport error if needed by page-model tests.
- `packages/ui/src/lib/storyboard/StoryboardErrorState.svelte` (new) or equivalent extension
  - Reusable accessible API-outage/error UI with retry and optional details.
- `packages/ui/src/lib/storyboard/StoryboardList.svelte`
  - Ensure empty state is only used for confirmed successful empty data, not load failure.
- `packages/ui/src/lib/storyboard/types.ts`
  - Add `StoryboardCopy`/error-state prop types if using centralized copy.
- `packages/ui/src/lib/storyboard/index.ts`
  - Export new error component/types.
- `packages/ui/package.json`
  - Consider adding `./source/storyboard` and primitive subpath exports to avoid broad `ui/source` imports.
- `apps/desktop-app/src/routes/+layout.svelte`
  - Narrow `Separator`/`Sidebar` import if package exports are added, otherwise browser warnings may remain globally.
- `apps/desktop-app/src/lib/components/AppSidebar.svelte`
  - Use localized storyboard label and narrow `Sidebar` import if package exports are added.
- `apps/desktop-app/messages/en.json`, `es.json`, `ja.json`, `pt.json`
  - Add storyboard page/error/nav copy.
- Tests to add/update:
  - `apps/desktop-app/src/routes/experiments/storyboard/storyboard-page.test.ts`
  - `apps/desktop-app/src/lib/adapters/storyboard/web-storyboard-transport.test.ts`
  - `packages/ui/src/lib/storyboard/__tests__/storyboard-ui.browser.test.ts`
  - `apps/desktop-app/e2e/storyboard.e2e.ts`
