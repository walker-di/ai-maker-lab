# platform

App-local runtime adapters for the Neutralino desktop shell.

## Responsibility

- expose a stable shell contract to presentation models
- isolate Neutralino globals and native API calls from Svelte views
- provide a browser-safe fallback for local preview and tests

## Boundaries

- views and `.svelte.ts` models depend on the `DesktopShell` contract
- Neutralino-specific API imports stay in this folder
- shared packages must not import from this folder
