# Domain Package

`packages/domain` owns the shared domain model, application orchestration, infrastructure adapters, and server entrypoints for the workspace.

## Layers

- `src/shared`: browser-safe entities, value objects, and pure helper functions. Frontend code may import this through `domain/shared`.
- `src/application`: use cases and ports. Native desktop and server composition code may import this through `domain/application`.
- `src/infrastructure`: database and runtime-specific adapters that implement application ports. Outer layers may import this through `domain/infrastructure`.
- `src/server.ts`: server entrypoint for the package, exposed as `domain/server`.

## Import Contract

- Frontend routes, components, and page models: use `domain/shared`.
- Native desktop composition and server wiring: use `domain/application`.
- Persistence and runtime adapters: use `domain/infrastructure`.
- Server startup and hosting integration: use `domain/server`.
- Do not import the `domain` package root from frontend code.

The package root currently remains a server-only compatibility entrypoint. Prefer explicit subpath imports in new code.

## Todo Reference Flow

The todo feature is the current reference example for this package:

- shared todo rules live in `src/shared/todo`
- todo workflow orchestration lives in `src/application/todo`
- SurrealDB persistence lives in `src/infrastructure/database`

That split lets the app choose a transport at the edge while reusing the same inner Todo use case from both web and desktop flows.

## Chat / AI Layer

The chat layer implements the model card, agent definition, and configurable AI SDK handler system:

- browser-safe model metadata, model cards, and agent shapes live in `src/shared/chat`
- `ModelHandler`, hook contracts, and runtime ports live in `src/application/chat`
- AI SDK provider registry, wrapped models, and system agent loading live in `src/infrastructure/ai`

`ModelCard` is the single source of truth for capability gating, fallback behavior, tool policy, and UI presentation. Runtime code consumes `ResolvedAgentProfile` only, after model resolution and inheritance merging.

## Commands

Run these from the repository root:

```sh
bun install
bun run dev:domain
```

## Testing

All tests in this package use a real SurrealDB `mem://` in-memory instance instead of hand-rolled in-memory fakes.

Standard test setup:

```typescript
import { createDbConnection } from '../../infrastructure/database/client.js';
import { SurrealDbAdapter } from '../../infrastructure/database/SurrealDbAdapter.js';

let db: Surreal;

beforeEach(async () => {
  db = await createDbConnection({
    host: 'mem://',
    namespace: `test_ns_${crypto.randomUUID()}`,
    database: `test_db_${crypto.randomUUID()}`,
  });
  repo = new SurrealFooRepository(new SurrealDbAdapter(db));
});

afterEach(async () => { await db.close(); });
```

Rules:

- Never create `InMemory*Repository` classes for database-backed ports.
- Only mock genuinely external boundaries with no SurrealDB implementation (AI SDK models, file-system agent sources, third-party APIs).
- Reference tests: `SurrealTodoRepository.test.ts`, `surreal-chat-repositories.test.ts`, `chat-service.test.ts`.
