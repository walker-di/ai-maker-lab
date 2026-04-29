# AI Storyboard Maker — DB & Browser Bundle Fix Implementation Plan

## Summary

- **Goal:** Fix two issues discovered during browser verification of the AI Storyboard Maker:
  1. **(Critical)** SurrealDB connection timeout when running `bun run dev:web` — causes all storyboard API routes to return HTTP 500 and the UI to show a DB error banner.
  2. **(Medium)** Node built-in modules (`path`, `fs`, `url`, `source-map-js`) externalized for browser — Vite console warnings on every page load, root-caused to broad `ui/source` barrel importing `sanitize-html` via chat UI exports.
- **Assumptions:**
  - `mem://` is an acceptable default for `dev:web` (non-persistent; consistent with existing Playwright config which already sets `SURREAL_HOST=mem://`).
  - Desktop SurrealKV path stays in `src/bun/bootstrap-services.ts`; only the SvelteKit server-side service factories change.
  - Storyboard CRUD does not require external AI/media provider keys for list/create/get/frame-insert/delete.
  - Narrow UI subpath exports can be added to `packages/ui/package.json` without breaking existing consumers.
- **Non-goals:**
  - Implementing a persistent local SurrealDB server process for web dev (opt-in via `SURREAL_HOST=ws://...`).
  - Changing desktop packaged build or Electrobun RPC transport wiring.
  - Full storyboard AI feature implementation (frame generation, export, asset generation).
  - Fixing other routes' errors beyond the storyboard and its shared DB/UI infrastructure.

## Source Reports

- [x] ✅ UI/frontend planning report incorporated: `plan-ui-db-fix`
- [x] ✅ Backend planning report incorporated: `plan-backend-db-fix`
- [x] ✅ Tests planning report incorporated: `plan-tests-db-fix`

## Architecture Validation

- ✅ **Clean architecture boundaries:** DB config helper is server-only (`src/lib/server/db-config.ts`); domain package stays unchanged except optional timeout hinting; repositories are not touched.
- ✅ **Svelte 5/frontend idioms:** Page model splits initial-load error from mutation/export errors using `$state`/`$derived`; no logic in `.svelte` files.
- ✅ **API/infrastructure boundaries:** `SURREAL_HOST` env var precedence: explicit env → `mem://` web default → desktop SurrealKV (Electrobun only). SvelteKit routes stay thin.
- ✅ **i18n/accessibility:** New error/empty-state copy added via Paraglide message keys in all four locale files; shared UI receives copy props, no Paraglide imports in `packages/ui`.
- ✅ **Testing strategy:** Real `mem://` DB for route integration tests; unmocked Playwright e2e smoke test proves API availability + no browser externalization warnings end-to-end. Consistent with existing Playwright config.

## Implementation Checklist

### Backend

- [ ] **Add server DB config helper** — centralize duplicated embedded-host default logic.
  - File: `apps/desktop-app/src/lib/server/db-config.ts` (new)
  - Precedence: `process.env.SURREAL_HOST` → `mem://` (web dev default). `surrealkv://` only in Electrobun desktop bootstrap.
  - Export `getAppDbConfig()` returning `{ host, namespace, database, username?, password?, token? }`.

- [ ] **Set `SURREAL_HOST=mem://` for `dev:web` script** — match the existing Playwright config.
  - File: `apps/desktop-app/package.json` → `scripts.dev:web`: prefix with `SURREAL_HOST=mem:// SURREAL_NS=app SURREAL_DB=desktop_web_dev`

- [ ] **Replace duplicated default-host logic in all SvelteKit server service factories.**
  - `apps/desktop-app/src/lib/server/marketing-service.ts`
  - `apps/desktop-app/src/lib/server/chat-services.ts`
  - `apps/desktop-app/src/lib/server/todo-service.ts`
  - `apps/desktop-app/src/lib/server/platformer-service.ts`
  - `apps/desktop-app/src/lib/server/rts-service.ts`

- [ ] **Preserve desktop SurrealKV in Electrobun bootstrap** — no change needed.
  - File: `apps/desktop-app/src/bun/bootstrap-services.ts` — keep as-is.

- [ ] *(Optional)* **Improve DB connect timeout hint** in domain client.
  - File: `packages/domain/src/infrastructure/database/client.ts`
  - If `surrealkv://` times out, append: "Use `SURREAL_HOST=mem://` for web/test or run inside Electrobun with native SurrealDB runtime."
  - Do not silently fall back to `mem://` inside the domain package.

- [ ] **Improve validation error mapping in marketing service.**
  - File: `apps/desktop-app/src/lib/server/marketing-service.ts` → `toMarketingErrorResponse()`
  - Explicitly detect `ZodError` → return HTTP 400 with controlled payload, not a generic 500.

### UI/frontend

- [ ] **Add typed transport error shape.**
  - File: `apps/desktop-app/src/lib/adapters/storyboard/web-storyboard-transport.ts`
  - Map HTTP/network failures to `StoryboardTransportError { status, kind, userMessage, technicalMessage? }`.
  - Kinds: `'backend-unavailable'` (500 + DB timeout), `'not-found'`, `'validation'`, `'network'`, `'server'`.
  - Do not expose filesystem paths in `userMessage`.

- [ ] **Split page model error state.**
  - File: `apps/desktop-app/src/routes/experiments/storyboard/storyboard-page.svelte.ts`
  - `initialLoadStatus: 'idle' | 'loading' | 'ready' | 'error'` + `initialLoadError`.
  - `operationError` for post-load mutation failures.
  - `isBackendUnavailable` derived value to gate create/mutation affordances.
  - Keep export status/error separate.

- [ ] **Render fatal load error state in route view.**
  - File: `apps/desktop-app/src/routes/experiments/storyboard/+page.svelte`
  - Show `StoryboardErrorState` instead of `StoryboardList` when initial load fails.
  - Disable "Create storyboard" when `isBackendUnavailable`.
  - Pass localized Paraglide `m.*` copy into shared UI.
  - Never show "No storyboards yet" and a fatal error simultaneously.

- [ ] **Add `StoryboardErrorState.svelte` component.**
  - File: `packages/ui/src/lib/storyboard/StoryboardErrorState.svelte` (new)
  - Props: `title`, `description`, `technicalDetails?`, `retryLabel`, `onRetry`, `isRetrying`.
  - Render with `role="alert"` and accessible retry `<button>`.
  - Export from `packages/ui/src/lib/storyboard/index.ts`.

- [ ] **Add `ui/source/storyboard` subpath export to narrow UI barrel imports.**
  - File: `packages/ui/package.json` → add `"./source/storyboard"` pointing to `./src/lib/storyboard/index.ts`.
  - Also add `"./source/marketing"`, `"./source/agent-registry"` etc. as applicable.
  - File: `apps/desktop-app/src/routes/experiments/storyboard/+page.svelte` → change `import ... from 'ui/source'` to `import ... from 'ui/source/storyboard'`.
  - File: `apps/desktop-app/src/routes/+layout.svelte` and `apps/desktop-app/src/lib/components/AppSidebar.svelte` → narrow `Sidebar`/`Separator` imports once subpath is available.

- [ ] **Add Paraglide message keys for storyboard page and error copy.**
  - Files: `apps/desktop-app/messages/en.json`, `es.json`, `ja.json`, `pt.json`
  - Keys needed: page title, description, empty state title/CTA, backend-unavailable error title/description/retry label, generic server/network error fallbacks.

### Tests

- [ ] **Add DB initialization unit tests.**
  - File: `packages/domain/src/infrastructure/database/client.test.ts`
  - Cases: `mem://` connects quickly (<5s); concurrent `getDb()` calls share one promise; config resolves `mem://` when env is set.

- [ ] **Add real-route storyboard API integration tests** *(primary proof of DB fix)*.
  - File: `apps/desktop-app/src/routes/api/marketing/storyboards/storyboard-routes.test.ts` (new)
  - Use real `getMarketingServices()` with `SURREAL_HOST=mem://`, unique `SURREAL_NS`/`SURREAL_DB` per suite.
  - Cases: list → `200 []`; create → `201`; get by id → `200`; frame lifecycle → `201`/`200`; invalid body → `400`; missing id → `404`.

- [ ] **Extend transport tests if error contract changes.**
  - File: `apps/desktop-app/src/lib/adapters/storyboard/web-storyboard-transport.test.ts`
  - Add case: `500 + DB timeout message → kind: 'backend-unavailable'`.

- [ ] **Extend page model test for load-error state** *(only if model error behavior changes)*.
  - File: `apps/desktop-app/src/routes/experiments/storyboard/storyboard-page.test.ts`
  - Case: initial load failure → `initialLoadStatus === 'error'`, `isBackendUnavailable === true`.

- [ ] **Keep existing shared UI browser test** — no changes.
  - File: `packages/ui/src/lib/storyboard/__tests__/storyboard-ui.browser.test.ts`

- [ ] **Keep existing mocked storyboard e2e** — no changes.
  - File: `apps/desktop-app/e2e/storyboard.e2e.ts`

- [ ] **Add unmocked browser DB/bundle smoke test** *(e2e proof of both fixes)*.
  - File: `apps/desktop-app/e2e/storyboard-web-db.e2e.ts` (new)
  - Cases:
    - No mocks; `GET /api/marketing/storyboards` → `200`.
    - Create storyboard via UI → `POST` returns `201`, heading appears.
    - No console messages containing `"externalized for browser compatibility"`.

### Validation

- [ ] `SURREAL_HOST=mem:// bun run dev:web` — no DB timeout banner on `/experiments/storyboard`
- [ ] Browser DevTools: `GET /api/marketing/storyboards` → `200`; no Node externalization warnings in console
- [ ] `curl http://localhost:5173/api/marketing/storyboards` → `200 []`
- [ ] `curl -X POST http://localhost:5173/api/marketing/storyboards -H 'content-type: application/json' -d '{"name":"Smoke test"}'` → `201`
- [ ] `bun run check:desktop-app`
- [ ] `cd packages/domain && bun test src/infrastructure/database/client.test.ts`
- [ ] `cd apps/desktop-app && SURREAL_HOST=mem:// bun run test:unit -- src/routes/api/marketing/storyboards src/lib/adapters/storyboard src/routes/experiments/storyboard`
- [ ] `cd apps/desktop-app && bun run test:e2e -- e2e/storyboard-web-db.e2e.ts`

## Dependencies and Sequencing

1. **Backend DB config helper + `dev:web` env var** — unblocks everything; lets manual browser verify the 500 is resolved immediately.
2. **Route integration tests** — written with real `mem://` service; confirms DB fix before UI changes.
3. **UI transport typed errors** — depends on step 1 (known API contract).
4. **Page model error state split** — depends on step 3.
5. **`StoryboardErrorState` component + route render** — depends on step 4.
6. **UI subpath exports + import narrowing** — can run in parallel with steps 3–5; independently fixes browser bundle warnings.
7. **Paraglide message keys** — can run in parallel with steps 3–6.
8. **Transport / page-model / e2e tests** — complete after code changes.

## Risks and Mitigations

- ⚠️ **Risk:** `mem://` is non-persistent; `dev:web` loses data on Vite restart.
  - **Mitigation:** Document in README. `SURREAL_HOST=ws://localhost:8000` opt-in for persistent web dev. Consistent with how Playwright already works.

- ⚠️ **Risk:** `getMarketingServices()` singleton can leak state across route integration tests.
  - **Mitigation:** Use unique `SURREAL_NS`/`SURREAL_DB` per test suite. Expose a `resetMarketingServicesForTest()` helper or rely on namespace isolation.

- ⚠️ **Risk:** Broad `ui/source` imports in `+layout.svelte`/`AppSidebar.svelte` keep browser warnings globally present even after narrowing the storyboard route.
  - **Mitigation:** Narrow global layout imports in the same PR. The e2e smoke test asserts no externalization warnings and will fail if this is still happening.

- ⚠️ **Risk:** `sanitize-html` as the root cause of browser warnings is inferred from Vite dep metadata. If incorrect, a Vite module graph trace is needed first.
  - **Mitigation:** Check `.vite/deps/_metadata.json` or run with `VITE_INSPECT=true` to confirm before touching UI exports.

## Open Questions

- ❓ Should `dev:web` show a notice that data doesn't survive server restart when using `mem://`?
- ❓ Should a `README` section or `dev:web:persistent` script document the `SURREAL_HOST=ws://...` external server option?
- ❓ Is `sanitize-html` via `ui/source` chat barrel confirmed as the source of browser externalization warnings, or should a Vite module graph trace be run first?
