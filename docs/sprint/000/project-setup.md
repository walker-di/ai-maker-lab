1. Create the desktop shell

```sh
bun x sv create app/desktop-app
```

2. Add and customize `AGENTS.md`

- keep the project guidance aligned with the actual repo structure
- document clean architecture boundaries for `app/desktop-app`, `packages/ui`, and `packages/domain`
- require shared UI work to use the active UI library instead of app-local custom primitives

3. Add clean architecture skills

- frontend skill for Svelte and SvelteKit boundaries
- backend/application skill for domain and orchestration code

4. Add the Bun workspace packages

- `packages/ui` as the shared Shadcn-based UI library exposed as `@ai-maker-lab/ui`
- `packages/domain` as the shared framework-free TypeScript package exposed as `@ai-maker-lab/domain`

5. Migrate `app/desktop-app` to consume the shared packages

- import reusable UI from `@ai-maker-lab/ui`
- import workflow and type helpers from `@ai-maker-lab/domain`
- keep Paraglide, routing, and shell wiring inside the app

6. Validate the workspace

```sh
bun install
bun run check
bun run build
```

7. Create PR
