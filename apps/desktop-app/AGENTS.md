## Desktop App Context

- Workspace root: `../../`
- Package manager: Bun
- App role: Electrobun desktop shell with a thin SvelteKit webview

## Monorepo Rules

- Install dependencies from the repository root with `bun install`.
- Prefer importing shared UI from `ui/source`.
- Prefer shared shadcn primitives from `ui/source` instead of adding shadcn components locally.
- Prefer importing browser-safe shared domain code from `domain/shared`.
- Do not duplicate shared components in `apps/desktop-app` when they belong in `packages/ui`.
- Keep app-specific wiring, routing, native window composition, and transport setup here. Move reusable UI and business logic into workspace packages.
- The app resolves the `$ui` alias to `packages/ui/src/lib` so shared shadcn internals and theme imports work in-place.

## Desktop Architecture

- `src/bun/index.ts` is the native Electrobun entrypoint.
- `src/lib/adapters/runtime/main-view-url.ts` is the runtime adapter for choosing between the web dev server and bundled desktop view.
- `src/routes/**` stays the SvelteKit UI layer loaded inside the desktop webview.
- Avoid per-route `+page.ts` in `src/routes/**` for client-side composition. Prefer `.svelte.ts` page models plus route-local composition helpers when a page needs adapter selection or async client bootstrap.
- Keep `+layout.ts` limited to global app routing flags like `ssr` and `prerender`.
- `electrobun.config.ts` controls native app metadata and copies the static web build into `views://mainview`.
- `src/app.html` contains the packaged desktop startup normalization that keeps `views://mainview/index.html` from hydrating as `/index.html`.
- Prefer changing the SvelteKit UI first, then wire native behavior at the Electrobun boundary only when needed.

## Chat Feature

- Transport adapters: `src/lib/adapters/chat/` contains `ChatTransport.ts` (interface), `web-chat-transport.ts` (fetch adapter for CRUD), `desktop-chat-transport.ts` (Electrobun RPC stub), and `create-chat-transport.ts` (runtime mode resolver).
- The `ChatTransport` handles CRUD operations (threads, agents, messages). The AI SDK `Chat` class handles streaming separately via `DefaultChatTransport` pointed at the `/api/chat/threads/[threadId]/stream` endpoint.
- API routes: `src/routes/api/chat/` provides REST endpoints for agents, threads, messages, and a streaming endpoint (`threads/[threadId]/stream`) that returns `toUIMessageStreamResponse()`.
- Chat page model: `src/routes/experiments/chat/chat-page.svelte.ts` owns the AI SDK `Chat` instance and coordinates thread/agent/message state. Do not destructure `Chat` properties.
- Composition: `src/routes/experiments/chat/chat-page.composition.ts` wires the transport to the page model.
- Route: `src/routes/experiments/chat/+page.svelte` renders a three-panel layout (thread sidebar, message timeline + composer, agent roster).
- The chat page must wrap its content in `<Tooltip.Provider>` from `ui/source` because `ChatComposer` uses tooltips internally. Missing this provider causes a silent rendering error that prevents the thread content panel from mounting.

## Verification

- Use root scripts when possible:
  - `bun run dev:web`
  - `bun run dev:app`
  - `bun run dev:app:hmr`
  - `bun run build:ui`
  - `bun run check:desktop-app`
  - `bun run build:desktop-app`
- E2E testing:
  - `bun run test:e2e` — runs all Playwright e2e tests.
  - `bun run test:e2e:chat` — runs chat-specific e2e tests.
  - Tests live in `e2e/` with the `*.e2e.ts` naming convention.
  - The Playwright config (`playwright.config.ts`) starts a Vite dev server with `SURREAL_HOST=mem://` for isolated in-memory SurrealDB per test run.
  - Output artifacts go to `e2e/.tmp/` (gitignored).
- Mode expectations:
  - `dev:web` is browser-only.
  - `dev:app` is bundled desktop mode.
  - `dev:app:hmr` is desktop mode backed by the Vite dev server.
  - packaged desktop builds stay serverless and load from `views://mainview/index.html`.
- If you need Svelte or SvelteKit docs, fetch current documentation before making framework-specific changes.

## E2E Test Patterns

- Shared helpers live in `e2e/helpers.ts`: `patchEmptyTableErrors`, `navigateToChat`, `waitForAgentsLoaded`, `createThread`, `selectThread`, `selectAgentInRoster`, and panel locators (`threadSidebar`, `agentRoster`, `mainPanel`, `threadHeader`).
- `patchEmptyTableErrors(page)` must be called in `beforeEach` for chat tests. It intercepts GET `/api/chat/**` requests that return non-200 (table-not-found on fresh `mem://` instances) and fulfills them with `200` and an empty JSON array.
- Mock AI SDK streaming with the v5 SSE protocol: emit `data:` events (`start`, `text-start`, `text-delta`, `text-end`, `finish`) and include the `x-vercel-ai-ui-message-stream: v1` response header. Use `text/event-stream` content type.
- Gate live API streaming tests behind `test.skip(!process.env.OPENAI_API_KEY, ...)`.
- Reference files: `e2e/chat/chat.e2e.ts` (CRUD), `e2e/chat/chat-streaming.e2e.ts` (mocked + live streaming).
