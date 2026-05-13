# Archived Racing Sim prototype

These files predate the `migrate-racing-sim-prototype` migration and are
preserved here to keep git history alongside the merged change. The shipping
implementation lives at:

- `apps/desktop-app/src/routes/experiments/racing/` — route, page model,
  composition.
- `apps/desktop-app/src/lib/adapters/racing/` — transport adapter pair.
- `apps/desktop-app/src/lib/server/racing-service.ts` — server-side
  use-case wiring.
- `apps/desktop-app/src/routes/api/racing/` — REST API endpoints.
- `packages/ui/src/lib/racing/engine/` — physics, renderer, input, cameras.
- `packages/ui/src/lib/racing/runtime/` — Svelte HUD model + cards.
- `packages/domain/src/shared/racing/` — browser-safe domain types.
- `packages/domain/src/application/racing/` — use cases.
- `packages/domain/src/infrastructure/racing/builtins/` — bundled vehicle /
  track JSON.
- `packages/domain/src/infrastructure/database/racing/` — Surreal repos.

## What's in here

- `racing-sim-working-prototype.html` — the standalone HTML prototype that
  drove the design (Three.js + Jolt + ad-hoc HUD all in one file).
- `racing-sim-garage-physics-v1.html` — earlier garage / suspension
  exploration page.
- `racing-sim-physics.js` — pure physics helpers extracted from the
  prototype (now lives under `packages/ui/src/lib/racing/engine/physics/`).
- `racing-sim-physics.test.js` / `track-geometry.test.js` — original
  Bun test suites (now `*.test.ts` under `packages/ui/src/lib/racing/`).

## Do not edit

This folder is a preservation snapshot. Make racing changes in the
shipping locations listed above.
