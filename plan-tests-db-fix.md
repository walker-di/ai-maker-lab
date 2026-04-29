# Tests Plan — AI Storyboard Maker DB/Web Compatibility Fixes

## 1. Test problem framing

Browser verification found two regressions around the AI Storyboard Maker at `apps/desktop-app/src/routes/experiments/storyboard/`:

1. **Critical: SurrealDB connection timeout in web mode.** After the fix, the SvelteKit web server must be able to initialize storyboard persistence quickly and the storyboard API routes must return successful responses for basic CRUD-like operations using real SurrealDB `mem://` test isolation.
2. **Medium: Node built-in modules externalized for browser (`path`, `fs`, `url`).** After the fix, loading `/experiments/storyboard` in the browser must not log Vite browser-compat warnings such as `Module "path" has been externalized for browser compatibility`.

Smallest meaningful validation should prove both the server-side API path and browser page path work without mocking away the failure mode. Existing mocked UI/e2e tests are useful but insufficient for the DB timeout because `apps/desktop-app/e2e/storyboard.e2e.ts` currently intercepts every storyboard API route.

## 2. Existing test patterns/files to reuse

### Relevant existing files

- Storyboard route/page model:
  - `apps/desktop-app/src/routes/experiments/storyboard/+page.svelte`
  - `apps/desktop-app/src/routes/experiments/storyboard/storyboard-page.composition.ts`
  - `apps/desktop-app/src/routes/experiments/storyboard/storyboard-page.svelte.ts`
  - `apps/desktop-app/src/routes/experiments/storyboard/storyboard-page.test.ts`
- Storyboard transport:
  - `apps/desktop-app/src/lib/adapters/storyboard/StoryboardTransport.ts`
  - `apps/desktop-app/src/lib/adapters/storyboard/web-storyboard-transport.ts`
  - `apps/desktop-app/src/lib/adapters/storyboard/web-storyboard-transport.test.ts`
- Storyboard API routes:
  - `apps/desktop-app/src/routes/api/marketing/storyboards/+server.ts`
  - `apps/desktop-app/src/routes/api/marketing/storyboards/[storyboardId]/+server.ts`
  - `apps/desktop-app/src/routes/api/marketing/storyboards/[storyboardId]/frames/insert/+server.ts`
  - `apps/desktop-app/src/routes/api/marketing/storyboards/[storyboardId]/frames/[frameId]/+server.ts`
  - other frame asset/prompt/transition/export route files under the same folder
- Shared UI browser test:
  - `packages/ui/src/lib/storyboard/__tests__/storyboard-ui.browser.test.ts`
- Existing storyboard e2e:
  - `apps/desktop-app/e2e/storyboard.e2e.ts`
- Server composition and DB init paths:
  - `apps/desktop-app/src/lib/server/marketing-service.ts`
  - `packages/domain/src/infrastructure/database/client.ts`
- Existing route test pattern with SvelteKit handler imports and service mocking:
  - `apps/desktop-app/src/routes/api/chat/threads/[threadId]/subthreads/[parentMessageId]/subthread-route.test.ts`
  - `apps/desktop-app/src/routes/api/chat/threads/[threadId]/stream/stream-server.test.ts`
- Existing Playwright configuration:
  - `apps/desktop-app/playwright.config.ts` starts Vite with `SURREAL_HOST=mem://`, unique `SURREAL_DB`, and browser base URL.
- Existing domain test conventions:
  - `packages/domain/README.md`
  - `packages/domain/src/application/marketing/storyboard-service.test.ts`
  - `packages/domain/src/shared/marketing/storyboard-validation.test.ts`

### Patterns to reuse

- **Domain tests:** use `bun:test`; use real `createDbConnection({ host: 'mem://' })`; unique namespace/database per test; close DB in `afterEach`; mock only external AI/media/export ports.
- **Desktop unit tests:** use Vitest `--project unit`; route tests can import SvelteKit `+server.ts` handlers directly and pass minimal `RequestEvent`-shaped objects.
- **E2E tests:** Playwright tests live in `apps/desktop-app/e2e/*.e2e.ts`; the configured web server already uses `SURREAL_HOST=mem://`.
- **UI browser tests:** `packages/ui` uses Vitest browser project and `vitest-browser-svelte`.

## 3. Proposed automated tests by layer

### A. Domain / DB initialization unit tests

Add tests only if the fix introduces or extracts DB initialization/host resolution logic. Suggested target paths:

- `packages/domain/src/infrastructure/database/client.test.ts`, or
- `apps/desktop-app/src/lib/server/marketing-service.test.ts` if the logic remains app-local.

Test cases:

1. **`createDbConnection` resolves quickly for `mem://` and initializes schema.**
   - Arrange `host: 'mem://'`, unique namespace/database.
   - Assert the promise resolves well below the production timeout, e.g. test-level timeout 5s.
   - Assert a trivial query succeeds after initialization.
   - Close the DB.
2. **Concurrent `getDb` calls share the same in-flight promise.**
   - Call `getDb(config)` twice before awaiting.
   - Assert both resolve to the same client and do not race initialization.
   - Close via `closeDb()`.
3. **App DB config resolver chooses a web-safe/test-safe host.**
   - If a `resolveMarketingDbConfig`/similar helper is created, unit test that `SURREAL_HOST=mem://` is honored.
   - If the fix changes the default web-mode host, assert web mode does not default to a file-backed embedded host that can hang in browser verification.

Do not create in-memory repository fakes; use the real Surreal client for DB-backed behavior.

### B. Route-level tests for storyboard API endpoints

Add a focused Vitest route integration test, suggested path:

- `apps/desktop-app/src/routes/api/marketing/storyboards/storyboard-routes.test.ts`

Preferred approach after the fix:

- Use real `getMarketingServices()` with `SURREAL_HOST=mem://`, unique `SURREAL_NS`/`SURREAL_DB` per test.
- Add a test-only reset hook if needed, e.g. `resetMarketingServicesForTest()` plus `closeDb()`, to avoid singleton leakage across tests.
- Avoid provider-backed operations in the DB timeout test. Do not call AI/media/export endpoints unless gateways are explicitly injected/mocked.

Minimum route assertions:

1. **List route returns 200 on a fresh DB.**
   - Import `GET` from `apps/desktop-app/src/routes/api/marketing/storyboards/+server.ts`.
   - Assert status `200`, body `[]`.
2. **Create and get storyboard work through real routes.**
   - Call `POST /api/marketing/storyboards` with `{ name: 'Route test storyboard' }`.
   - Assert status `201`, returned `id`, `name`, `frameCount: 0`.
   - Call `GET /api/marketing/storyboards/[storyboardId]`.
   - Assert status `200`, same id/name, `frames: []`.
3. **Frame CRUD-like route flow works without AI providers.**
   - Call `POST /frames/insert` with `{ title: 'Opening frame' }`; assert `201` and one frame.
   - Call `PUT /frames/[frameId]` with narration/image prompt updates; assert `200` and updated frame fields.
   - Call `PUT /transition`; assert `200`, `transitionTypeAfter: 'fade'` and requested duration.
   - Call `DELETE /frames/[frameId]`; assert `200` and zero frames.
4. **Validation and not-found mapping remains controlled.**
   - Invalid create body `{ name: '' }` returns 400-shaped JSON error.
   - Missing storyboard id returns 404-shaped JSON error.

This route test is the most direct automated proof for the critical API timeout fix because it exercises SvelteKit route handlers, server composition, real SurrealDB initialization, and repository persistence.

### C. Existing page model and transport unit tests

Reuse and lightly extend existing tests only where the fix changes behavior:

- `apps/desktop-app/src/lib/adapters/storyboard/web-storyboard-transport.test.ts`
  - Existing coverage already asserts API paths stay inside the adapter and non-2xx errors map to useful errors.
  - Add one case if needed for list/create status handling after route changes.
- `apps/desktop-app/src/routes/experiments/storyboard/storyboard-page.test.ts`
  - Existing coverage loads/creates/opens and generates/exports via injected transport.
  - Add only one error-state case if the DB fix changes how page errors are surfaced.

Do not duplicate route-level DB assertions in the page model; page model tests should stay transport-injection tests.

### D. UI browser component tests

Keep `packages/ui/src/lib/storyboard/__tests__/storyboard-ui.browser.test.ts` as-is unless UI changes are required for the fix. It already validates accessible empty-state and frame controls. The DB/browser-compat issue should primarily be caught by app e2e because `packages/ui` should not import `domain` or app server code.

### E. Playwright e2e / browser tests

Keep the existing fully mocked e2e test for workflow/UI safety:

- `apps/desktop-app/e2e/storyboard.e2e.ts`

Add a new unmocked smoke test, either in the same file or a new focused file:

- Suggested: `apps/desktop-app/e2e/storyboard-web-db.e2e.ts`

Test cases:

1. **Unmocked storyboard list/create flow with real `mem://` API.**
   - Do not register `page.route('**/api/marketing/storyboards...')` mocks.
   - Collect browser console messages before navigation.
   - `page.goto('/experiments/storyboard')`.
   - Wait for `GET /api/marketing/storyboards` and assert response status `200`.
   - Assert `AI Storyboard Maker` heading is visible.
   - Use the UI to create a storyboard.
   - Wait for `POST /api/marketing/storyboards` status `201` and subsequent `GET /api/marketing/storyboards/{id}` status `200`.
   - Assert the created storyboard heading appears.
2. **No browser externalization warnings.**
   - Fail if collected console warning/error text contains any of:
     - `Module "path" has been externalized for browser compatibility`
     - `Module "fs" has been externalized for browser compatibility`
     - `Module "url" has been externalized for browser compatibility`
     - broader fallback: `externalized for browser compatibility`

This e2e test is the smallest browser-level proof for both issues: real API route availability in web mode and absence of browser bundle leakage of Node built-ins.

## 4. Manual/browser verification plan

1. From repo root, run the web app with an explicit in-memory DB:
   ```sh
   cd apps/desktop-app
   SURREAL_HOST=mem:// SURREAL_NS=manual_storyboard SURREAL_DB=manual_$(date +%s) bun run dev:web
   ```
2. Open `http://localhost:5173/experiments/storyboard`.
3. In DevTools Console:
   - Confirm there are no Vite warnings for `path`, `fs`, or `url` being externalized for browser compatibility.
4. In DevTools Network:
   - Confirm `GET /api/marketing/storyboards` returns `200` quickly.
5. Use the UI:
   - Click **Create storyboard**.
   - Enter a name.
   - Submit.
   - Confirm `POST /api/marketing/storyboards` returns `201`.
   - Confirm `GET /api/marketing/storyboards/{id}` returns `200` and the page opens the created storyboard.
6. Optional API-only checks while the dev server is running:
   ```sh
   curl -i http://localhost:5173/api/marketing/storyboards
   curl -i -X POST http://localhost:5173/api/marketing/storyboards \
     -H 'content-type: application/json' \
     -d '{"name":"Manual storyboard"}'
   ```

## 5. Required commands and smallest meaningful validation

### Smallest meaningful automated validation for these two fixes

Run these after implementation:

```sh
bunx @fission-ai/openspec@latest validate migrate-ai-storyboard-maker --type change --no-interactive

# Domain DB/init + storyboard service regression coverage
cd packages/domain
bun test src/infrastructure/database/client.test.ts src/application/marketing/storyboard-service.test.ts

# App route/server/page/transport unit coverage
cd ../../apps/desktop-app
SURREAL_HOST=mem:// SURREAL_NS=unit_storyboard SURREAL_DB=unit_storyboard_$(date +%s) \
  bun run test:unit -- src/routes/api/marketing/storyboards src/lib/server/marketing-service.test.ts src/lib/adapters/storyboard/web-storyboard-transport.test.ts src/routes/experiments/storyboard/storyboard-page.test.ts

# Browser verification for real web mode and no externalized Node built-ins
bun run test:e2e -- e2e/storyboard-web-db.e2e.ts
```

### Broader regression validation if time allows

```sh
# Existing UI component browser test
cd packages/ui
bun run test:browser -- src/lib/storyboard/__tests__/storyboard-ui.browser.test.ts

# Existing mocked storyboard workflow e2e plus new unmocked DB/web smoke
cd ../../apps/desktop-app
bun run test:e2e -- e2e/storyboard.e2e.ts e2e/storyboard-web-db.e2e.ts

# Svelte/package checks
cd ../..
bun run check:desktop-app
```

## 6. Risks, assumptions, and fixtures/mocks needed

### Assumptions

- The fix will keep storyboard APIs under `/api/marketing/storyboards/**` and the page under `/experiments/storyboard`.
- The Playwright web server in `apps/desktop-app/playwright.config.ts` remains configured with `SURREAL_HOST=mem://`, which is appropriate for unmocked e2e isolation.
- Basic list/create/get/insert/update/delete operations do not require live AI/media provider keys.
- If route tests use real `getMarketingServices()`, the implementation will provide a safe way to reset the singleton between tests or ensure each test process gets an isolated DB config before first use.

### Risks

- `getMarketingServices()` currently caches a singleton promise. Without a test reset hook, route integration tests can leak state or hold a closed DB client across tests.
- `generateFrames`, `regeneratePrompt`, `generateFrameAsset`, and `export-video` may call external providers or filesystem/FFmpeg paths. Keep the critical DB route test to non-provider CRUD operations unless gateways are injected/mocked.
- Browser console warnings may be emitted before test listeners attach if listeners are registered too late. Attach `page.on('console', ...)` before `page.goto()`.
- Vite externalization warnings might appear as `warning` or `error` console types depending on the source; inspect all console messages, not just errors.
- If the fix moves server-only imports behind dynamic imports or `.server.ts` modules, route tests should assert behavior rather than implementation details. Use a lightweight static grep only as supplemental review, not as the primary test.

### Fixtures/mocks needed

- Route-level DB tests: no repository fakes; use real SurrealDB `mem://`.
- Route-level provider endpoints: if tested, inject fake `IMarketingTextGenerationGateway`, `IMarketingImageGenerationGateway`, `INarrationAudioGateway`, `IBackgroundMusicGateway`, and `IVideoExporter` through server composition test hooks. Otherwise skip those endpoints from the minimal DB fix validation.
- Existing mocked Playwright workflow in `apps/desktop-app/e2e/storyboard.e2e.ts` can remain as a UI fixture for generated frames/assets/export states.

## 7. Tests checklist items with file paths

- [ ] Add/extend DB initialization unit tests:
  - `packages/domain/src/infrastructure/database/client.test.ts`
  - and/or `apps/desktop-app/src/lib/server/marketing-service.test.ts`
- [ ] Add real-route storyboard API integration tests:
  - `apps/desktop-app/src/routes/api/marketing/storyboards/storyboard-routes.test.ts`
- [ ] Keep/extend transport tests only if route/error contracts change:
  - `apps/desktop-app/src/lib/adapters/storyboard/web-storyboard-transport.test.ts`
- [ ] Keep/extend page model tests only if UI error behavior changes:
  - `apps/desktop-app/src/routes/experiments/storyboard/storyboard-page.test.ts`
- [ ] Keep existing shared UI browser test:
  - `packages/ui/src/lib/storyboard/__tests__/storyboard-ui.browser.test.ts`
- [ ] Keep existing mocked storyboard workflow e2e:
  - `apps/desktop-app/e2e/storyboard.e2e.ts`
- [ ] Add unmocked browser/web DB smoke and console-warning regression test:
  - `apps/desktop-app/e2e/storyboard-web-db.e2e.ts`
- [ ] Run OpenSpec validation:
  - `openspec/changes/migrate-ai-storyboard-maker/`
