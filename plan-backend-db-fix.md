# Backend DB Fix Plan — AI Storyboard Maker

## 1. Backend problem framing

Browser verification of the AI Storyboard Maker fails before storyboard use cases run. In `dev:web`, `/api/marketing/storyboards` calls the SvelteKit server-side marketing composition, which attempts to open the default embedded SurrealKV database at `data/surrealdb/desktop-web.db`. That mode depends on the native Surreal runtime packages that the Electrobun desktop build copies into the app bundle, so the Vite-only web server hangs until the 30s timeout and returns HTTP 500.

A second browser-console issue reports Vite externalizing Node built-ins (`path`, `fs`, `url`) and `source-map-js`. I did not find SurrealDB or `domain/infrastructure` imported by the storyboard client path; the more likely client leak is the broad `ui/source` root barrel, which re-exports chat UI components that pull in `sanitize-html`/PostCSS dependencies.

## 2. Relevant backend/domain files and patterns found

- `openspec/changes/migrate-ai-storyboard-maker/{proposal.md,design.md,tasks.md}`: storyboard work is intended to reuse marketing Story/Scene/Clip infrastructure and SurrealDB repositories.
- `apps/desktop-app/package.json`: `dev:web` is only `vite dev --port 5173`; no DB env vars or companion DB process.
- Root `package.json`: `dev:web` builds UI then delegates to desktop-app `dev:web`; also no DB env vars.
- `apps/desktop-app/src/hooks.server.ts`: only Paraglide middleware; no DB startup or runtime-mode setup.
- `apps/desktop-app/src/lib/server/marketing-service.ts`: constructs `getMarketingServices()`, defaults `SURREAL_HOST` to `surrealkv://.../data/surrealdb/desktop-web.db`, and wires storyboard services/repositories.
- Same embedded-host pattern is duplicated in:
  - `apps/desktop-app/src/lib/server/todo-service.ts`
  - `apps/desktop-app/src/lib/server/platformer-service.ts`
  - `apps/desktop-app/src/lib/server/rts-service.ts`
  - `apps/desktop-app/src/lib/server/chat-services.ts`
- `packages/domain/src/infrastructure/database/client.ts`: `getDb()` singleton and `createDbConnection()` use `createRemoteEngines()` + `createNodeEngines()`, run `surreal.connect(host, ...)` behind a 30s timeout, and initialize embedded hosts (`mem://`, `rocksdb://`, `surrealkv://`, `surrealkv+versioned://`) with `INIT_DB_QUERY`.
- `apps/desktop-app/electrobun.config.ts` + `apps/desktop-app/scripts/sync-surreal-runtime.mjs`: explicitly document that `@surrealdb/node` is externalized and copied into Electrobun resources because missing runtime packages make `surreal.connect('surrealkv://…')` hang.
- `apps/desktop-app/playwright.config.ts`: already runs Vite with `SURREAL_HOST=mem://`, proving web/e2e mode is expected to use an in-memory SurrealDB backend.
- Storyboard routes under `apps/desktop-app/src/routes/api/marketing/storyboards/**` are thin SvelteKit adapters, validate with `domain/shared` schemas, log errors, and call `getMarketingServices()`.

## 3. Root cause analysis of the DB timeout

`dev:web` starts only the Vite/SvelteKit dev server. It does not run Electrobun, so Electrobun's `postBuild` hook never copies the native Surreal runtime packages needed by embedded SurrealKV. The first storyboard API request follows this path:

`GET /api/marketing/storyboards` → `getMarketingServices()` → `getDb({ host: process.env.SURREAL_HOST ?? getDefaultEmbeddedHost() })` → `getDefaultEmbeddedHost()` returns `surrealkv://.../desktop-web.db` → `surreal.connect()` hangs → `[DB] connect to ... timed out after 30000ms` → route catch returns 500.

The bug is not storyboard-specific repository logic; storyboard is simply the first route verified. Any SvelteKit server route using the same default SurrealKV fallback can hit the same failure in Vite-only web mode.

## 4. Fix plan: how to start/connect SurrealDB in web mode

Recommended plan: do **not** start embedded SurrealKV in `dev:web` by default. Make browser-only web mode use `mem://`, while preserving explicit env/remote DB support and Electrobun desktop SurrealKV behavior.

1. Add a server-only DB config helper, e.g. `apps/desktop-app/src/lib/server/db-config.ts`.
   - Centralize the duplicated default-host logic.
   - Precedence:
     1. `process.env.SURREAL_HOST` if provided.
     2. Web/Vite dev default: `mem://`.
     3. Explicit desktop/native composition default: `surrealkv://<desktop userData>/surrealdb/desktop.db` in `src/bun/bootstrap-services.ts` remains unchanged.
   - Include namespace/database/user/pass/token handling in one `getAppDbConfig()` helper.
2. Update all SvelteKit server service factories to use the helper:
   - `apps/desktop-app/src/lib/server/marketing-service.ts`
   - `apps/desktop-app/src/lib/server/chat-services.ts`
   - `apps/desktop-app/src/lib/server/todo-service.ts`
   - `apps/desktop-app/src/lib/server/platformer-service.ts`
   - `apps/desktop-app/src/lib/server/rts-service.ts`
3. Make `apps/desktop-app/package.json` and/or root `package.json` explicit for web mode:
   - Set `SURREAL_HOST=mem://` for `dev:web`, matching Playwright.
   - Optionally also set stable dev namespace/database such as `SURREAL_NS=app` and `SURREAL_DB=desktop_web_dev`.
4. Document persistent web-mode options rather than making them implicit:
   - In-memory default: `bun run dev:web` works without native runtime but loses data on server restart.
   - Persistent/remote option: user can run a separate SurrealDB server and start Vite with `SURREAL_HOST=ws://...`/`http://...` plus credentials.
   - Avoid pretending the repo already has a SurrealDB CLI/server script; I found no local `surreal` binary in workspace `node_modules`.
5. Keep `src/bun/bootstrap-services.ts` as the desktop embedded-SurrealKV composition boundary. It already uses Electrobun `Utils.paths.userData` and benefits from `sync-surreal-runtime.mjs`.
6. Optional hardening in `packages/domain/src/infrastructure/database/client.ts`:
   - If an embedded `surrealkv://` connect times out, append a targeted hint to the error: use `SURREAL_HOST=mem://` for web dev or run inside Electrobun/with copied native Surreal runtime.
   - Do not silently fall back from SurrealKV to `mem://` inside the domain package; that would hide persistence loss and make production behavior surprising.

## 5. Fix plan: eliminate node built-in leakage into client bundle

Findings:

- Storyboard client code imports only `domain/shared` types and app-local HTTP adapters:
  - `apps/desktop-app/src/lib/adapters/storyboard/web-storyboard-transport.ts`
  - `apps/desktop-app/src/routes/experiments/storyboard/storyboard-page.svelte.ts`
  - `apps/desktop-app/src/routes/experiments/storyboard/+page.svelte`
- I did not find `domain/infrastructure`, `@surrealdb/node`, or `surrealdb` imported by the storyboard client path.
- Node imports are correctly present in server/native files, especially `apps/desktop-app/src/lib/server/**`, `apps/desktop-app/src/bun/**`, and domain infrastructure.
- The `ui/source` root barrel re-exports chat components. Chat message rendering imports `sanitize-html`; its dependency tree includes PostCSS modules that import `path`, `fs`, `url`, and `source-map-js`. Because many routes import from the root `ui/source` barrel, this is a plausible source of browser externalization warnings even when the storyboard page does not use chat UI.

Plan:

1. Add narrower UI package subpath exports for feature barrels, e.g.:
   - `ui/source/storyboard` → `packages/ui/src/lib/storyboard/index.ts`
   - `ui/source/marketing` → `packages/ui/src/lib/marketing/index.ts`
   - possibly `ui/source/chat` for chat-only routes.
2. Change storyboard page imports from the broad root barrel to the storyboard-specific UI barrel.
   - Keep using shared UI package boundaries; do not duplicate components in the app.
3. Audit other feature routes using `ui/source` root imports and gradually move them to narrow barrels when they only need one feature area.
4. If warnings persist specifically on chat routes, split chat markdown rendering behind a browser-safe sanitizer or lazy import, because `sanitize-html` is Node-oriented enough to drag PostCSS/source-map dependencies into browser bundles.
5. Keep domain imports strict:
   - Frontend/page models: `domain/shared` only.
   - SvelteKit server/native composition: `domain/application` and `domain/infrastructure` allowed.
   - API route files may use `domain/shared` validation schemas and server service helpers, but no client-reachable imports should point at server helpers.
6. Verification after implementation:
   - Run `bun run dev:web`, open `/experiments/storyboard`, and confirm no `/api/marketing/storyboards` 500.
   - Inspect browser console/network for Node externalization warnings.
   - Use `rg "domain/infrastructure|@surrealdb/node|surrealdb" apps/desktop-app/src/routes apps/desktop-app/src/lib/adapters` to ensure no client leakage.

## 6. Auth, validation, error logging plan

- Auth: I found no storyboard-specific auth/session checks in current routes. Keep current app-local behavior unless a separate auth requirement exists. If auth is added later, enforce it in SvelteKit API routes before service calls; do not put SvelteKit/session concerns into `packages/domain`.
- Validation:
  - Continue using `domain/shared` Zod schemas in API routes.
  - Improve `toMarketingErrorResponse()` to explicitly detect `ZodError` and return HTTP 400 with a controlled validation payload. The current substring-based mapping can misclassify some Zod errors as 500.
  - Validate route params where meaningful (`storyboardId`, `frameId`) before service calls or rely on service `not found` mapping for existence checks.
- Error logging:
  - Keep detailed `console.error('<operation>', error)` in each route catch block.
  - Add DB config context at startup/connect time, but redact credentials/tokens.
  - For DB connection failures, log host scheme and namespace/database, not secrets.
  - Return controlled JSON errors to clients; avoid leaking stack traces.
- Application/domain boundaries:
  - Repositories remain persistence-only adapters.
  - Storyboard orchestration stays in `Marketing.StoryboardService` / application use cases.
  - SvelteKit routes remain thin: parse → validate → delegate → map errors.

## 7. Risks, assumptions, and dependencies

- `mem://` fixes web development and browser verification quickly but is non-persistent. That is consistent with Playwright but may surprise users who expect `dev:web` data to survive restart.
- Persistent web mode needs an external SurrealDB server or an explicit local DB process. I found no checked-in SurrealDB CLI binary/script, so this should be documented as an opt-in dependency rather than assumed.
- `dev:app:hmr` uses a Vite server; if storyboard keeps only a web HTTP transport, it may use `mem://` under this plan. A desktop RPC transport would be needed for packaged/serverless desktop parity.
- Packaged desktop builds are documented as serverless. Current storyboard transport is HTTP-only, so full packaged desktop storyboard support likely requires an Electrobun RPC transport and native service wiring beyond this DB timeout fix.
- Narrow UI package subpath exports may require coordinated package export updates and import migrations. This is still preferable to pulling all root UI feature barrels into every browser route.
- If browser warnings are not from `sanitize-html`/`ui/source`, a follow-up dependency trace from Vite's module graph will be needed.

## 8. Backend checklist items with file paths

- [ ] Add server DB config helper: `apps/desktop-app/src/lib/server/db-config.ts`.
- [ ] Make `dev:web` explicit `SURREAL_HOST=mem://`: root `package.json` and/or `apps/desktop-app/package.json`.
- [ ] Replace duplicated embedded-host defaults with the helper:
  - [ ] `apps/desktop-app/src/lib/server/marketing-service.ts`
  - [ ] `apps/desktop-app/src/lib/server/chat-services.ts`
  - [ ] `apps/desktop-app/src/lib/server/todo-service.ts`
  - [ ] `apps/desktop-app/src/lib/server/platformer-service.ts`
  - [ ] `apps/desktop-app/src/lib/server/rts-service.ts`
- [ ] Preserve desktop SurrealKV composition in `apps/desktop-app/src/bun/bootstrap-services.ts`.
- [ ] Add targeted timeout hinting in `packages/domain/src/infrastructure/database/client.ts` if desired.
- [ ] Improve validation/error mapping in `apps/desktop-app/src/lib/server/marketing-service.ts` (`toMarketingErrorResponse`).
- [ ] Keep route validation in all storyboard endpoints under `apps/desktop-app/src/routes/api/marketing/storyboards/**`.
- [ ] Add UI subpath exports in `packages/ui/package.json` and migrate storyboard page imports away from broad `ui/source`.
- [ ] Re-run verification after implementation:
  - [ ] `bun run dev:web`
  - [ ] Browser network: `GET /api/marketing/storyboards` returns 200/empty array or actual list.
  - [ ] Browser console no longer shows Node built-in externalization warnings on storyboard route.
  - [ ] `bun run check:desktop-app`
  - [ ] Targeted unit/domain tests for DB config and storyboard routes as appropriate.
