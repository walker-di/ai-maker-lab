## Why

The desktop app already ships a working skirmish scaffold at `apps/desktop-app/src/routes/experiments/rts/+page.svelte`, with a Pixi-backed engine, lobby, map generator, and HUD. The single-file design sketch at `.design_sketch/rts-working-game-prototype.html` proves out a far richer in-match experience: terrain with altitude and cliff occlusion, fog of war, dual minerals/gas economy, scout and rocket units, patrol/repair orders, parabolic projectiles, an enemy camp economy, layered audio, hit-stop, and a Kenney Tower Defense sprite skin. This change lifts that proven experience into the production route so the experiments/rts surface can stand on its own as a demoable RTS slice.

The migration cannot just copy the prototype: the production app uses clean architecture, a workspace-shared Pixi engine, SurrealDB-backed catalogs, app-local transport adapters, and a domain layer that intentionally has no Pixi or HTTP imports. The work is to re-express the prototype's value through those existing boundaries.

## What Changes

- Promote prototype-quality presentation, game feel, and gameplay into the existing `experiments/rts` route without replacing the route, the lobby, or the renderer.
- Add a Kenney Tower Defense sprite pipeline to `packages/ui/src/lib/rts/engine`, keep `createPixiRtsRendererFactory`, and side-load atlas PNGs from `apps/desktop-app/static/rts/towerDefense/`.
- Render altitude-aware tiles using Kenney landscape sprites for flat (132×99) and raised (132×115) terrain, with a custom water polygon since the pack has no full-water tile.
- Render buildings as distinct Pixi sprites at fixed pixel widths so HQ, refinery, depot, turret, and the enemy camp have visually unmistakable silhouettes.
- Add a WebAudio-backed audio bus that synthesizes select / move / attack / build / die / rocket-impact / wave / victory / defeat tones, replacing `NullAudioBus` as the runtime default while keeping it for tests.
- Add an in-engine feedback layer: order acknowledgement ripples, custom canvas cursor states, selection ring pop, hit-stop on heavy events, directional camera shake, and a combat-heat tracker that modulates particle density.
- Extend the domain with new units (`scout`, `rocket`), the gas resource, the refinery building, the patrol order, the repair order, altitude combat bonuses, cliff vision/projectile blocking, and corresponding stats/validation.
- Add per-faction fog of war with explored/visible states, vision contribution per unit/building, and rendering through a Pixi mask container.
- Replace the enemy camp's wave-spawn behavior with a timed production queue that launches squads down ramps.
- Update the built-in maps (`tiny-skirmish`, `dual-ramps`, `cliffside`) to seed gas anchors, scout-friendly ramps, and enemy-camp economy slots.
- Update the HUD command card to surface mineral/gas separately, train Scout and Rocket, and issue Patrol and Repair orders. Bind `M` to mute and `T` to a sprite-vs-vector renderer toggle for debugging.
- Add automated coverage: domain unit tests for new stats/validation, engine unit tests for fog/projectile-arc/audio-bus, and a Playwright e2e for sprite-mode rendering, fog reveal, and victory recording.

## Capabilities

### New Capabilities

- `rts-skirmish`: end-to-end skirmish experience for `experiments/rts`, covering presentation (sprites, tiles, decor, building silhouettes), game feel (audio, cursors, ripples, hit-stop, combat heat), gameplay (fog of war, scout/rocket, gas/refinery, patrol/repair, altitude combat, enemy camp economy), and verification (domain/engine/e2e coverage).

### Modified Capabilities

<!-- None; no prior `rts-*` spec exists in `openspec/specs/`. -->

## Impact

- `apps/desktop-app/src/routes/experiments/rts/`: page model wires new HUD slots, new orders, new unit/building production keys; `+page.svelte` adds the cursor overlay and global key bindings (`M`, `T`); composition injects the audio bus and atlas loader into the engine.
- `apps/desktop-app/src/lib/adapters/rts/`: transport adapters extend `startMatch` payloads with gas/refinery/scout/rocket and the new orders; no new HTTP endpoints are required because the engine handles everything client-side once a match is running.
- `apps/desktop-app/static/rts/towerDefense/`: new Kenney TD atlas PNGs (license file alongside) loaded via SvelteKit's static folder.
- `packages/ui/src/lib/rts/engine/`: new `sprites/atlas.ts`, `systems/fog-of-war.ts`, `systems/projectile-arc.ts`, `audio-bus.ts` (WebAudio implementation), and `fx/feedback.ts`. Existing files (`pixi-renderer.ts`, `systems.ts`, `RtsEngine.ts`, `ai.ts`, `world.ts`, `components.ts`) gain extension points but keep their public APIs.
- `packages/ui/src/lib/rts/runtime/`: HUD adds gas display and new command-card buttons (Scout, Rocket, Patrol, Repair); `RtsHud.svelte.ts` extends its model.
- `packages/domain/src/shared/rts/`: extensions to `units.ts`, `resources.ts`, `match-types.ts`, `terrain.ts`, `stats.ts`, plus existing validators.
- `packages/domain/src/application/rts/`: ports gain optional gas/refinery/scout/rocket inputs; `start-match` and `record-match-result` use cases stay structurally compatible.
- `packages/domain/src/infrastructure/rts/builtins/`: `tiny-skirmish.json`, `dual-ramps.json`, `cliffside.json` updated with gas anchors and enemy-camp slots.
- `packages/ui/src/lib/rts/engine/*.test.ts` and `packages/domain/src/{shared,application}/rts/**/*.test.ts`: new and updated unit tests.
- `apps/desktop-app/e2e/rts/`: new Playwright spec exercising the slice end-to-end with mocked transports.
- Dependencies: no new npm packages. WebAudio is browser-native; PixiJS is already a workspace dependency.
- Out of scope: multiplayer, save/load of in-match state, replays, asymmetric AI factions, mobile/touch input redesign, marketing-flow integration.
