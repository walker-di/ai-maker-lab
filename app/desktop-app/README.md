# desktop-app

`app/desktop-app` is the Neutralino desktop composition shell in the Bun workspace.

## Responsibility

- own Neutralino runtime wiring, Paraglide bootstrapping, and app-level adapters
- host a client-only `Vite + Svelte 5` application inside the Neutralino window
- consume shared components from `@ai-maker-lab/ui`
- consume shared workflow and type helpers from `@ai-maker-lab/domain`

## Local commands

Run from the repo root:

```sh
bun install
bun run dev
bun run check
bun run build
bun run --cwd app/desktop-app test:runtime
```

Run directly inside `app/desktop-app` when needed:

```sh
bun run dev
bun run build:web
bun run test:runtime
bun run storybook
bun run build
bun run test:e2e
```

## Runtime notes

- `bun run dev` starts `neu run`, which patches `index.html` and launches the Vite frontend inside the Neutralino window.
- `app/desktop-app` is not currently using SvelteKit routes, hooks, or adapters. The runtime is a single mounted Svelte entrypoint backed by Vite.
- `bun run build:web` generates the static frontend assets consumed by Neutralino.
- `bun run build` packages the Neutralino desktop app for distribution and emits `app/desktop-app/dist/ai-maker-lab-release.zip`.
- Keep dependency installs at the repo root so the workspace `bun.lock` stays authoritative. Do not commit app-local `bun.lock` or `package-lock.json` files.
