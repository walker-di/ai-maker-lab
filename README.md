# ai-maker-lab

`ai-maker-lab` is a Bun workspace monorepo with a native desktop shell, a SvelteKit UI, and shared workspace packages.

## Workspace Packages

- `apps/desktop-app`: Electrobun native shell and SvelteKit composition root.
- `packages/ui`: shared Svelte UI package and shadcn ownership boundary.
- `packages/domain`: shared domain package with browser-safe shared code, application use cases, infrastructure adapters, and server entrypoints.

## Import Contract

Use the package surfaces intentionally:

- Frontend routes, components, and page models: import UI from `ui/source`.
- Frontend routes, components, and page models: import browser-safe domain code from `domain/shared`.
- Frontend transport and runtime adapters: keep them inside `apps/desktop-app/src/lib/adapters/**`.
- Native desktop composition and server wiring: import orchestration from `domain/application`.
- Native desktop composition and server wiring: import persistence and runtime adapters from `domain/infrastructure`.
- Server entrypoints: use `domain/server`.
- Do not import the `domain` package root from frontend code.

## Icon Imports

Lucide icons should follow the direct-import pattern recommended by the Lucide Svelte docs:

- Import icons from `@lucide/svelte/icons/<icon-name>`.
- Prefer direct icon imports over barrel imports from `@lucide/svelte` for better tree-shaking and faster builds.
- Avoid `import * as icons from '@lucide/svelte'` in normal components.
- Only use a wildcard Lucide import for an intentional dynamic icon loader, and document the bundle-size/build-time tradeoff in the same change.

## Reference Architecture

The todo experiment is the current reference flow for the workspace architecture:

- `+page.svelte` stays visual.
- `todo-page.svelte.ts` owns presentation behavior.
- app-local transports choose between HTTP for web mode and Electrobun RPC for desktop mode.
- `packages/domain/src/application/todo` owns the workflow orchestration.
- `packages/domain/src/infrastructure/database` owns SurrealDB persistence.

## Common Commands

Run these from the repository root:

```sh
bun install
bun run build:ui
bun run check:desktop-app
bun run build:desktop-app
```

For local development:

```sh
# browser-only SvelteKit dev server
bun run dev:web

# bundled desktop mode via Electrobun watch/relaunch
bun run dev:app

# desktop mode with Vite HMR
bun run dev:app:hmr

# domain server entrypoint
bun run dev:domain
```