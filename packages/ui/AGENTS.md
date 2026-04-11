## UI Package Context

- Workspace root: `../../`
- Package manager: Bun
- Package role: shared Svelte UI library

## Monorepo Rules

- Install dependencies from the repository root with `bun install`.
- Shared components belong in `src/lib`.
- `shadcn-svelte` is the standard component system for shared primitives in this package.
- `src/routes` and `src/stories` are demo and validation surfaces, not the primary library API.
- Export public components from `src/lib/index.ts`.
- Keep reusable UI here instead of rebuilding it inside `apps/desktop-app`.

## Consumption Rules

- The workspace app consumes source exports from `ui/source`.
- Generated shadcn components use the shared `$ui` alias, which resolves to `packages/ui/src/lib`.
- Keep the package root export valid for packaged builds from `dist`.
- When you add a new public component, wire both the library entrypoint and any relevant stories in the same change.
- Add shadcn components from `packages/ui` with `bun x shadcn-svelte@latest add <component> --yes`.
