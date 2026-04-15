## Project Concept

`ai-maker-lab` is a Bun workspace monorepo.

- `apps/desktop-app`: SvelteKit app shell and composition root.
- `packages/ui`: Shared Svelte UI package.
- `packages/domain`: Shared domain package. Server code stays separate from browser-safe shared exports.

## Architecture Intent

- Keep `apps/desktop-app` thin.
- Put reusable UI in `packages/ui`.
- Put shared domain logic and cross-app contracts in `packages/domain`.
- Keep browser-safe imports explicit. Use `domain/shared` in frontend code instead of importing the package root.
- Preserve clear boundaries so future apps can consume the same workspace packages.

## Adapter Pattern Contract

- Page models and components must not construct or call `/api/**` URLs directly.
- Runtime-specific transport selection belongs at the app/composition boundary, not inside shared domain or UI code.
- App-local adapters may translate UI intent into HTTP or RPC calls, but routes and page models should depend on those adapters instead of raw transport details.
- In `apps/desktop-app`, avoid per-route `+page.ts` for client-side composition. Prefer `.svelte.ts` page models plus route-local composition helpers that select adapters and bootstrap client state.
- Keep `+layout.ts` limited to global app-wide route flags such as `ssr` and `prerender` unless an exception is explicitly needed.
- `packages/domain` owns shared domain and application orchestration contracts and use cases.
- `apps/desktop-app` is an adapter and composition boundary for routing, runtime wiring, and transport translation.
- Each new domain or subdomain folder in `packages/domain` should include a `README.md` documenting responsibility and boundaries.
- When a feature needs both streaming and CRUD transport, keep them separate: use the AI SDK `Chat` class with `DefaultChatTransport` for streaming, and a dedicated `ChatTransport` adapter for CRUD operations (threads, agents, messages).

## Workspace Rules

- Install dependencies from the repository root with `bun install`.
- Prefer workspace package imports over copying code between apps and packages.
- Import shared UI into the app from `ui/source`.
- Treat `shadcn-svelte` in `packages/ui` as the standard shared component system.
- Keep generated shadcn components in `packages/ui` and consume them from apps through the workspace package instead of duplicating them locally.
- Import browser-safe domain modules into the app from `domain/shared`.
- Import application use cases into native/server composition code from `domain/application`.
- Import persistence and runtime adapters into native/server composition code from `domain/infrastructure`.
- Treat `domain` package-root imports as server-only compatibility aliases, not as frontend imports.
- Keep `packages/ui` as the shared component surface. Do not recreate those components inside `apps/desktop-app`.
- `packages/ui` must not depend on `packages/domain`. Chat UI components define local type mirrors in `packages/ui/src/lib/chat/types.ts` instead of importing domain types. Domain types structurally satisfy the UI types when passed from the app layer.

## Documentation Direction

- Root documentation lives in `README.md`.
- Package-specific guidance belongs close to the package:
  - `apps/desktop-app/AGENTS.md`
  - `packages/ui/AGENTS.md`
  - `packages/domain/README.md`
  - `skills/svelte-frontend/SKILL.md`
  - `skills/backend-implementtion/SKILL.md`
- Update docs in the same change set when workspace structure or import conventions change.
- Prefer concise, executable Bun workspace commands over long prose.

## Skills

- `svelte-frontend`: `skills/svelte-frontend/SKILL.md`
- `backend-implementtion`: `skills/backend-implementtion/SKILL.md`

Use the frontend skill for Svelte/SvelteKit UI work and the backend skill for shared domain or application logic.

## Skill Usage

- If the task clearly matches a listed skill, use that skill for the turn.
- Read only the minimum necessary from the skill first, then load additional files as needed.

## Working Principles

- Follow the request directly and keep responses concise.
- Prefer code and concrete changes over unnecessary explanation.
- If the user explicitly asks for deeper reasoning, provide exhaustive analysis before implementation.
- Reject generic duplication when a shared package or existing library surface already solves the problem.

## Frontend Best Practices

- If a UI library or shared UI package already provides a component, use it instead of rebuilding it locally.
- Wrap or style shared primitives when needed, but keep the underlying shared component boundary intact.
- Focus on clean spacing, accessible interaction, and maintainable composition rather than one-off app-specific markup.
- Use the AI SDK Svelte `Chat` class (from `@ai-sdk/svelte`) for streaming chat UIs. Do not destructure its reactive properties; always access via `chat.messages`, `chat.status`, etc.
- Use reactive getters for `Chat` constructor arguments that may change: `new Chat({ get id() { return threadId; } })`.

## Testing Rules

- All repository and service tests must use a real SurrealDB `mem://` in-memory instance via `createDbConnection({ host: 'mem://' })` and real Surreal repository implementations.
- Never create hand-rolled in-memory repository fakes or test doubles for database-backed ports. No `InMemoryFooRepository` classes.
- Only mock boundaries that are genuinely external and have no SurrealDB implementation: AI SDK language models, file-system-based definition sources, and third-party network APIs.
- Each test file that uses SurrealDB must open its own connection in `beforeEach` with a unique namespace/database (`crypto.randomUUID()`) and close it in `afterEach`.
- Reference pattern: `SurrealTodoRepository.test.ts` and `surreal-chat-repositories.test.ts`.

## E2E Testing Rules

- Playwright e2e tests live in `apps/desktop-app/e2e/` with the `*.e2e.ts` naming convention.
- The Playwright config starts a Vite dev server on a dedicated port with `SURREAL_HOST=mem://` for test isolation. Each run gets a unique `SURREAL_DB` namespace.
- Use `patchEmptyTableErrors(page)` in `beforeEach` to intercept GET `/api/chat/**` requests that fail on a fresh `mem://` instance (tables don't exist until first insert) and return safe empty `[]` responses.
- Mock AI SDK streaming responses using the v5 SSE protocol: `data: {"type":"text-delta",...}` events with the `x-vercel-ai-ui-message-stream: v1` response header. Do not use the legacy `0:` prefix format.
- Gate live API tests behind environment flags (e.g. `test.skip(!process.env.OPENAI_API_KEY, ...)`).
- Run chat e2e tests: `bun run test:e2e:chat` from `apps/desktop-app`. Run all e2e tests: `bun run test:e2e`.
