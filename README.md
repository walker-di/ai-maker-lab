# ai-maker-lab

Desktop-first Bun workspace for experimenting with a Neutralino desktop shell, a client-only Svelte 5 + Vite app, and shared Svelte/domain packages.

## Workspace

- `app/desktop-app`: Neutralino desktop composition shell
- `packages/ui`: shared Shadcn-based Svelte UI library exposed as `@ai-maker-lab/ui`
- `packages/domain`: shared framework-free TypeScript package exposed as `@ai-maker-lab/domain`

## Common commands

```sh
bun install
bun run dev
bun run check
bun run build
```

## Notes

- `app/desktop-app` owns Neutralino runtime wiring, Paraglide bootstrapping, and app-specific platform adapters.
- `app/desktop-app` is not currently a SvelteKit runtime. It is a Neutralino-hosted `Vite + Svelte 5` client app.
- `@ai-maker-lab/ui` owns reusable UI primitives, shared styles, and presentation models.
- `@ai-maker-lab/domain` owns reusable types and workflow helpers.
- The root `bun.lock` is the workspace source of truth. Nested app lockfiles should not be committed.
- `bun run build` packages the Neutralino desktop app and writes `app/desktop-app/dist/ai-maker-lab-release.zip`.