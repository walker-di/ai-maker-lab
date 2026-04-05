# ai-maker-lab

This repository is a Bun workspace monorepo with a desktop app shell and shared packages.

## Workspace layout

- `apps/desktop-app`: SvelteKit app shell that composes workspace packages.
- `packages/ui`: Shared Svelte UI package.
- `packages/domain`: Shared domain package with server and browser-safe shared exports.

## Common commands

```sh
bun install
bun run build:ui
bun run check:desktop-app
```

For local app development:

```sh
bun run dev:desktop-app
```