# desktop-app

`app/desktop-app` is the Neutralino desktop composition shell in the Bun workspace.

## Responsibility

- own Neutralino runtime wiring, Paraglide bootstrapping, and app-level adapters
- consume shared components from `@ai-maker-lab/ui`
- consume shared workflow and type helpers from `@ai-maker-lab/domain`

## Local commands

Run from the repo root:

```sh
bun install
bun run dev
bun run check
bun run build
```

Run directly inside `app/desktop-app` when needed:

```sh
bun run dev
bun run build:web
bun run storybook
bun run build
bun run test:e2e
```

## Runtime notes

- `bun run dev` starts `neu run`, which patches `index.html` and launches the Vite frontend inside the Neutralino window.
- `bun run build:web` generates the static frontend assets consumed by Neutralino.
- `bun run build` packages the Neutralino desktop app for distribution.
