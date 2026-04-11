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

## Commands

Run these from the repository root:

```sh
bun install
bun run dev:domain
```
