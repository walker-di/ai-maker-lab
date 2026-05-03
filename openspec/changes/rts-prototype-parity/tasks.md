## Implementation Tasks

### 1. Phase 1 — Sprite skin in Pixi

- [x] 1.1 Copy Kenney TD atlases (`landscape_sheet.png`, `towers_grey_sheet.png`, `towers_red_sheet.png`, `towers_brown_sheet.png`) into `apps/desktop-app/static/rts/towerDefense/Spritesheet/`, copy the bundled `License.txt` alongside, and add a one-line credit in the experiments/rts route footer.
- [x] 1.2 Create `packages/ui/src/lib/rts/engine/sprites/atlas.ts` with: a `loadRtsAtlases()` async loader that calls `PIXI.Assets.load` against the four sheet URLs, an inlined `FRAMES` map (only the rectangles the renderer actually uses), and a `getSpriteFrame(sheet, name)` helper returning a typed sub-rect.
- [x] 1.3 Add `pickTileFrame(terrain, alt)` to `pixi-renderer.ts` so altitude `0` flat tiles map to `landscape_13` (grass) / `landscape_30` (dirt/rock/cliff foot), altitude `1` maps to `landscape_25`, and altitude `2+` maps to `landscape_22`. Document the sprite dimensions next to the function.
- [x] 1.4 Extend `pixi-renderer.ts` with a sprite tile pass that draws a `PIXI.Sprite` per tile in iso order using the atlas frame from 1.3 with the corrected y-anchor `p.y - (h * 33 / spriteHeight)`. Keep the vector pass as fallback.
- [x] 1.5 Add `drawWaterDiamond(p, kind)` in `pixi-renderer.ts` (using `PIXI.Graphics`) that paints a blue/teal iso diamond plus two short wave strokes for `water` and `shallow` tiles. Wire it into the sprite tile pass so water tiles never use a Kenney landscape sprite.
- [x] 1.6 Replace the vector building draws with sprite draws in sprite mode using fixed pixel widths: `hq=116`, `refinery=78`, `depot=60`, `turret=38`. Keep the construction-progress arc and the hit-flash tint working on top of the sprite (use a `PIXI.ColorMatrixFilter` or temporary alpha-source-atop pass).
- [x] 1.7 Replace the enemy camp vector draw with `towers_red/tower_15` at `134 px` width. Preserve the red pulse glow underneath the sprite.
- [x] 1.8 Add a decor pass: trees, rocks, and crystals drawn from the landscape atlas, hashed deterministically by tile coords so the same tile always picks the same decor frame.
- [x] 1.9 Add `Y` key handling in `+page.svelte` to toggle the renderer between sprite and vector modes (only when the canvas, not a text input, has focus); render an "(sprite mode)" / "(vector mode)" badge in dev builds.
- [x] 1.10 Update `packages/ui/src/lib/rts/engine/index.ts` to export the atlas module and any new sprite types.

### 2. Phase 2 — Game feel layer

- [x] 2.1 Add `WebAudioBus` to `packages/ui/src/lib/rts/engine/audio-bus.ts`: lazy `AudioContext`, `masterGain`, `tone(freq, dur, type, gain)`, `noiseBurst(dur, gain)`, `chord(...)`, `mute(boolean)`, and a `playSfx(key)` switch covering `select`, `move`, `attack`, `build-place`, `build-complete`, `unit-die`, `rocket-hit`, `wave-alarm`, `victory`, `defeat`. Keep `NullAudioBus` exported.
- [x] 2.2 Update `rts-page.composition.ts` to default the engine's audio bus to `WebAudioBus` and to expose a `setMuted(boolean)` method on the page model. Tests continue to inject `NullAudioBus`.
- [x] 2.3 Wire engine event hooks (`select`, `move`, `attack`, `build`, `die`, `rocketHit`, `wave`, `victory`, `defeat`) in `RtsEngine.ts` so each emits through the audio bus exactly once per event.
- [x] 2.4 Create `packages/ui/src/lib/rts/engine/fx/feedback.ts` with: an order-acknowledgement ripple pool, a selection-pop tween table, a combat-heat scalar, a hit-stop scheduler, and a directional camera-shake accumulator. Export a `step(dt, events)` and a `read()` snapshot for the renderer.
- [x] 2.5 Have `pixi-renderer.ts` consume `feedback.read()` each frame: draw ripples, scale particle density by combat heat, render the soft vignette when heat is high, and apply the camera-shake offset before the world transform.
- [x] 2.6 Add a DOM cursor overlay above the Pixi canvas in `+page.svelte` driven by `rts-page.svelte.ts`'s armed-order/hover-target state. Cursor states: default, attack, repair, placeOk, placeBad, armed-attack, armed-patrol, armed-repair. Hide the OS cursor over the canvas while a custom cursor is active.
- [x] 2.7 Add the `M` key binding to `+page.svelte` so it calls the page model's `setMuted` (the existing audio bus handles the actual gain change). Reflect the muted state visibly in the HUD (small icon).
- [x] 2.8 Pause-step the simulation through `feedback.ts`'s hit-stop scheduler so heavy events (rocket impact, building destroyed, victory, defeat) freeze the next tick while the renderer keeps running.

### 3. Phase 3 — Gameplay: units, resources, structures

- [x] 3.1 Update `packages/domain/src/shared/rts/stats.ts` to fill in `scout`, `rocket`, and `refinery` stats (cost, build time, hp, sight, speed, damage, range, projectile kind, supply contribution / cost). Re-export from `packages/domain/src/shared/rts/index.ts`.
- [x] 3.2 Update `packages/domain/src/shared/rts/validation.ts` so refinery placement requires adjacency to a `gas` resource node, and gas harvesting requires a completed refinery in range. Add unit tests in `validation.test.ts`.
- [x] 3.3 Update `packages/domain/src/shared/rts/match-types.ts` so faction state includes a `gas: number` counter and per-tick income for both resources.
- [x] 3.4 Extend the engine economy in `systems.ts` to track gas income through refineries and to consume mineral + gas costs when training scout/rocket and when placing refineries.
- [x] 3.5 Update `packages/domain/src/infrastructure/rts/builtins/{tiny-skirmish,dual-ramps,cliffside}.json` with gas anchors near each starting position and along ramps. Keep existing player starts and mineral patches intact.
- [x] 3.6 Update the HUD model in `packages/ui/src/lib/rts/runtime/RtsHud.svelte.ts` (and the corresponding HUD component) so the resource panel shows mineral and gas side-by-side.
- [x] 3.7 Add command-card buttons for Train Scout (`C`), Train Rocket (`V`), and Build Refinery (`F`) with enable/disable rules driven by the page model.

### 4. Phase 4 — Gameplay: orders, fog, AI

- [x] 4.1 Add `patrol` and `repair` to the engine's order vocabulary (`components.ts` / `events.ts` as appropriate) and implement them in `systems.ts`. Patrol loops between two waypoints and engages enemies in range; repair sends a worker to a damaged friendly building and ticks HP back over time.
- [x] 4.2 Add command-card buttons for Patrol (`P`) and Repair (`T`) wired through `rts-page.svelte.ts`. Note: rebind the renderer-toggle hotkey if `T` collides with Repair (e.g. move sprite/vector toggle to `Y` and update Phase 1 task 1.9 accordingly during implementation).
- [x] 4.3 Create `packages/ui/src/lib/rts/engine/systems/fog-of-war.ts` with a per-faction visibility grid (`unexplored | explored | visible`), an altitude-aware vision sweep around every player-owned unit/building, and a `read(faction, tile)` accessor.
- [x] 4.4 Add a `fogOverlay` Pixi container in `pixi-renderer.ts` that blits an alpha mask each frame from the player faction's grid (opaque dark for unexplored, dim for explored, transparent for visible). Skip rendering enemy entities on non-visible tiles.
- [x] 4.5 Create `packages/ui/src/lib/rts/engine/systems/projectile-arc.ts` for parabolic projectiles. Route rocket attacks through it so they arc over cliffs and apply splash damage on impact via the existing damage path.
- [x] 4.6 Apply altitude combat bonuses in `systems.ts`: high-ground attackers gain effective range and damage; lower attackers get a miss chance against higher targets. Cliff tiles between attacker and target block straight-line shots but not parabolic ones.
- [x] 4.7 Replace pure wave spawning in `engine/ai.ts` with an enemy-camp production economy: timed unit production, queue state, and squad launches that funnel down ramps toward the player base.
- [x] 4.8 Surface a "squad launched" toast in the HUD when the player's vision first reveals an inbound enemy squad.

### 5. Phase 5 — Verification

- [x] 5.1 Add domain unit tests covering scout/rocket stats, gas validation, refinery placement validation, and patrol/repair order validation. Use real `mem://` SurrealDB connections per the workspace testing rules where any repository is involved.
- [x] 5.2 Add engine unit tests for `systems/fog-of-war.ts` (reveal/persist, altitude-aware vision), `systems/projectile-arc.ts` (cliff occlusion vs parabolic arcs), and `audio-bus.ts` (`WebAudioBus` mute contract using a stub `AudioContext`).
- [x] 5.3 Add a Playwright e2e in `apps/desktop-app/e2e/rts/` that loads a sprite-mode match (no 404s on the four atlases), drives a scout into fog and asserts a previously-unexplored region becomes visible, asserts the resource panel renders both mineral and gas, and asserts that destroying the enemy camp triggers a `record-match-result` write through the mocked transport. Toggle `M` and assert the HUD muted indicator updates.
- [x] 5.4 Add a static-import guard test (or extend an existing one) asserting `packages/domain` does not import `pixi.js`/`@pixi/*` and that `packages/ui/src/lib/rts/engine/*` does not import `surrealdb`, `domain/infrastructure`, or `domain/application`.
- [ ] 5.5 Run `bun run check` from the workspace root, `bun test` for `packages/domain` and `packages/ui`, and `bun run test:e2e:rts` (or the equivalent script in `apps/desktop-app`) and resolve any failures before archiving the change.
- [ ] 5.6 Manual smoke recipe (record outcomes in the PR description):
  1. `bun --cwd apps/desktop-app run dev` and open `http://localhost:5173/experiments/rts`.
  2. Start a match on `tiny-skirmish`. Confirm sprite mode loads (atlases resolve, no 404 in network tab).
  3. Verify HUD shows mineral and gas counters and the new Train Scout / Train Rocket / Build Refinery buttons are visible (disabled until conditions are met).
  4. Build a refinery adjacent to a gas node, harvest gas, and confirm the gas counter increases.
  5. Train a scout, walk it into fogged territory, and confirm the area transitions from unexplored to visible to explored as vision is gained and lost.
  6. Train a rocket and fire over a cliff at an enemy unit; confirm the projectile arcs and damage applies.
  7. Issue Patrol and Repair orders and confirm the HUD ripples and audio cues fire.
  8. Press `M` to mute and confirm the HUD muted indicator updates and audio stops.
  9. Press the renderer toggle hotkey and confirm the renderer flips between sprite and vector modes without breaking selection rings, projectiles, or fog.
  10. Destroy the enemy camp and confirm the victory flow records a match result.
