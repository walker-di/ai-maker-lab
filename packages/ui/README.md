# UI Package

`packages/ui` is the shared Svelte UI boundary for the workspace.

## Responsibility

- Keep reusable Svelte components in `src/lib`.
- Keep generated `shadcn-svelte` primitives in this package instead of recreating them in `apps/desktop-app`.
- Export public library components from `src/lib/index.ts`.
- Treat `src/routes` and `src/stories` as demo and validation surfaces, not the primary API.

## Public Surfaces

- `ui/source`: workspace source exports used by `apps/desktop-app` during local development.
- `ui`: packaged build output used by the published/package-style entrypoint.
- `ui/styles/*`: shared style assets.

## Consumption Rules

- App code should import shared UI from `ui/source`.
- Do not duplicate shared primitives inside `apps/desktop-app`.
- If a component is reusable across screens, it belongs here instead of the app package.
- Add new shared shadcn components from this package so ownership stays centralized.

## Commands

Run these from the repository root:

```sh
bun install
bun run build:ui
```

If you need to work directly inside `packages/ui`:

```sh
bun run dev
bun run check
bun run prepack
bun run storybook
```
