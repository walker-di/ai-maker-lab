## Desktop App Context

- Workspace root: `../../`
- Package manager: Bun
- App role: thin SvelteKit composition shell

## Monorepo Rules

- Install dependencies from the repository root with `bun install`.
- Prefer importing shared UI from `ui/source`.
- Prefer importing browser-safe shared domain code from `domain/shared`.
- Do not duplicate shared components in `apps/desktop-app` when they belong in `packages/ui`.
- Keep app-specific wiring, routing, and platform composition here. Move reusable UI and business logic into workspace packages.

## Verification

- Use root scripts when possible:
  - `bun run build:ui`
  - `bun run check:desktop-app`
- If you need Svelte or SvelteKit docs, fetch current documentation before making framework-specific changes.
