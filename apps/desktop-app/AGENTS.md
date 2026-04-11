## Desktop App Context

- Workspace root: `../../`
- Package manager: Bun
- App role: Electrobun desktop shell with a thin SvelteKit webview

## Monorepo Rules

- Install dependencies from the repository root with `bun install`.
- Prefer importing shared UI from `ui/source`.
- Prefer shared shadcn primitives from `ui/source` instead of adding shadcn components locally.
- Prefer importing browser-safe shared domain code from `domain/shared`.
- Do not duplicate shared components in `apps/desktop-app` when they belong in `packages/ui`.
- Keep app-specific wiring, routing, native window composition, and transport setup here. Move reusable UI and business logic into workspace packages.
- The app resolves the `$ui` alias to `packages/ui/src/lib` so shared shadcn internals and theme imports work in-place.

## Desktop Architecture

- `src/bun/index.ts` is the native Electrobun entrypoint.
- `src/lib/adapters/runtime/main-view-url.ts` is the runtime adapter for choosing between the web dev server and bundled desktop view.
- `src/routes/**` stays the SvelteKit UI layer loaded inside the desktop webview.
- Avoid per-route `+page.ts` in `src/routes/**` for client-side composition. Prefer `.svelte.ts` page models plus route-local composition helpers when a page needs adapter selection or async client bootstrap.
- Keep `+layout.ts` limited to global app routing flags like `ssr` and `prerender`.
- `electrobun.config.ts` controls native app metadata and copies the static web build into `views://mainview`.
- `src/app.html` contains the packaged desktop startup normalization that keeps `views://mainview/index.html` from hydrating as `/index.html`.
- Prefer changing the SvelteKit UI first, then wire native behavior at the Electrobun boundary only when needed.

## Verification

- Use root scripts when possible:
  - `bun run dev:web`
  - `bun run dev:app`
  - `bun run dev:app:hmr`
  - `bun run build:ui`
  - `bun run check:desktop-app`
  - `bun run build:desktop-app`
- Mode expectations:
  - `dev:web` is browser-only.
  - `dev:app` is bundled desktop mode.
  - `dev:app:hmr` is desktop mode backed by the Vite dev server.
  - packaged desktop builds stay serverless and load from `views://mainview/index.html`.
- If you need Svelte or SvelteKit docs, fetch current documentation before making framework-specific changes.
