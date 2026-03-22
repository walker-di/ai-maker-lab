# ai-maker-lab

Desktop-first Bun workspace for experimenting with shared Svelte UI and domain packages.

## Workspace

- `app/desktop-app`: SvelteKit desktop composition shell
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

- `app/desktop-app` owns routing, Paraglide, and app-specific runtime wiring.
- `@ai-maker-lab/ui` owns reusable UI primitives, shared styles, and presentation models.
- `@ai-maker-lab/domain` owns reusable types and workflow helpers.