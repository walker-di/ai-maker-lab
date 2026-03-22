# @ai-maker-lab/domain

`packages/domain` is the shared TypeScript package for framework-free domain and application logic.

## Responsibility

- define reusable types and workflow helpers
- keep business and orchestration language out of Svelte views
- provide a stable core that future apps can consume

## Current modules

- `src/demo-user.ts`
- `src/workspace-checklist.ts`

## Boundaries

- must not depend on Svelte, SvelteKit, browser APIs, or route files
- may be consumed by `packages/ui` and `app/desktop-app`
- each new domain area should add its own `README.md` when a dedicated folder is introduced
