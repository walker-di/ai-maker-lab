# Desktop App

`apps/desktop-app` is the native desktop entrypoint for AI Maker Lab.

It uses:

- Electrobun for the native desktop shell and window lifecycle
- SvelteKit for the webview UI
- workspace packages like `ui` and `domain` for shared code

## Architecture

- `src/bun/index.ts` starts the native app and opens the main window.
- `src/lib/adapters/runtime/main-view-url.ts` chooses between the Vite dev server and bundled `views://mainview/index.html`.
- `src/routes/**` contains the SvelteKit UI rendered inside the desktop webview.
- `src/lib/adapters/**` contains app-local runtime and transport adapters such as web HTTP clients and Electrobun RPC bridges.
- `electrobun.config.ts` copies the static SvelteKit output into `views://mainview`.
- `svelte.config.js` uses `@sveltejs/adapter-static` with SPA fallback output for the desktop shell.
- `src/app.html` normalizes packaged `views://.../index.html` startup URLs before SvelteKit hydrates so the desktop bundle stays serverless without booting into a 404.

## Reference Flow

The todo experiment is the reference example for the app boundary split:

- `src/routes/experiments/todo/+page.svelte` stays visual.
- `src/routes/experiments/todo/todo-page.svelte.ts` owns presentation state and user interactions.
- `src/lib/adapters/todo/web-todo-transport.ts` handles web-mode HTTP calls.
- `src/lib/adapters/todo/desktop-todo-transport.ts` handles desktop-mode Electrobun RPC.
- `src/bun/index.ts` composes `domain/application` and `domain/infrastructure` for the native runtime.

## Workspace Commands

Run these from the repository root:

```sh
bun install
```

Useful commands:

```sh
# browser-only dev mode
bun run dev:web

# bundled desktop dev mode
bun run dev:app

# desktop app with Vite HMR
bun run dev:app:hmr

# type-check the app after building shared UI
bun run check:desktop-app

# build a packaged desktop app
bun run build:desktop-app
```

## Package-Level Commands

If you need to work directly inside `apps/desktop-app`:

```sh
# build the webview, then launch Electrobun against bundled assets
bun run start

# browser-only dev server
bun run dev:web

# aliases for browser-only dev server
bun run dev
bun run dev:browser

# bundled desktop dev mode
bun run dev:app

# alias for bundled desktop dev mode
bun run dev:desktop

# desktop HMR mode
bun run dev:app:hmr

# alias for desktop HMR mode
bun run dev:desktop:hmr

# build the desktop app for distribution
bun run build
```

## Runtime Modes

- `dev:web`: runs only the SvelteKit/Vite browser dev server on `http://localhost:5173`.
- `dev:app`: runs Electrobun bundled desktop mode with `views://mainview/index.html` and watch/relaunch behavior.
- `dev:app:hmr`: runs the Vite dev server and Electrobun together so the desktop window loads from `http://localhost:5173` when available.
- Packaged builds stay serverless. The final app loads bundled files from `views://mainview/index.html`, not from a local HTTP server.
