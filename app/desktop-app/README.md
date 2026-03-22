# desktop-app

`app/desktop-app` is the SvelteKit desktop composition shell in the Bun workspace.

## Responsibility

- own routes, Paraglide wiring, and app-level adapters
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
bun run storybook
bun run build
```

## Recreate the starter shell

```sh
bun x sv@0.12.8 create --template minimal --types ts --add playwright tailwindcss="plugins:typography,forms" sveltekit-adapter="adapter:auto" devtools-json mdsvex paraglide="languageTags:en, es, pt, ja+demo:yes" storybook mcp="ide:cursor+setup:remote" --install bun app/desktop-app
```
