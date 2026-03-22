# workspace-home

The desktop landing screen for the Neutralino shell.

## Responsibility

- compose shared UI primitives into the app's home screen
- surface runtime metadata from the desktop adapter boundary
- keep interaction and async state in `workspace-home.svelte.ts`

## Boundaries

- `workspace-home.svelte` stays visual
- `workspace-home.svelte.ts` orchestrates locale changes and shell actions
- shared product logic still comes from `@ai-maker-lab/domain`
