# Title

Platformer Game Runtime, Entities, Camera, And HUD Plan

## Goal

Layer the full-scope gameplay on top of the engine defined in `01-engine-and-domain.md`. Deliver a faithful homage to the famous two-plumber side-scroller in feel and structure: tight player movement, classic enemies, power-ups, scrolling camera, world progression, lives, score, time, and sound. All gameplay rules live in engine-resident systems consuming shared domain types so the editor can preview them and tests can drive them deterministically.

## IP And Content Guardrail

- Never name, depict, or reference the original franchise. Do not mention the brand, the protagonist names, the publisher, the kingdom, or any trademarked enemy names anywhere in the codebase, assets, comments, or commit messages.
- Use generic art and audio: a mustachioed adventurer, generic mushrooms and turtles, original sprites, or clearly licensed CC0 / royalty-free placeholder packs.
- Treat any third-party asset pack as a hard prerequisite check. If a contributor cannot point to a permissive license file, reject the asset.
- This rule applies equally to the engine, the editor, the bundled built-in worlds in `04-persistence-and-services.md`, and any user-facing labels in `05-route-integration.md`.

## Scope

- Player controller with classic feel: walk, run, variable-height jump, coyote time, jump buffer, ducking, grow/small state, fire mode, star invincibility.
- Enemy roster covering the standard archetypes: walker, kickable shell, flying, fire bar, bullet shooter.
- Item roster: coin, mushroom (grow), flower (fire), star (invincible), one-up.
- Tile interactions: bumpable bricks (break when grown, bounce when small), question blocks that spawn items, hazard tiles, pipe entries that may teleport to sub-areas, end-of-level flag pole with score-by-height.
- Horizontal scrolling camera with deadzone and never-scroll-back behavior.
- HUD with lives, score, coins, world-level label, and time.
- World progression: linear `WorldDefinition.levels[]`, advance on goal, game-over returns to title.
- Audio: per-action SFX and per-level music with `@pixi/sound`.
- Input: keyboard (arrow keys / WASD + Z / X) and gamepad via the standard Gamepad API.

Out of scope for this step:

- Tile and entity placement UI. That belongs in `03-map-editor.md`.
- Persistence of progress and user maps. That belongs in `04-persistence-and-services.md`.
- Route composition. That belongs in `05-route-integration.md`.
- Multiplayer, online leaderboards, or competitive features.

## Architecture

- `packages/ui/src/lib/platformer/engine/systems`
  - Owns the runtime systems registered with the `EngineWorld` from `01-engine-and-domain.md`.
  - Each system depends only on engine primitives and engine components. No transport or DOM access.
- `packages/ui/src/lib/platformer/engine/components`
  - Owns the runtime components (`Position`, `Velocity`, `Body`, `PlayerControl`, `EnemyAi`, `Item`, `Hazard`, `Camera`, `Animation`, `Audio`).
- `packages/ui/src/lib/platformer/engine/audio`
  - Owns `AudioBus` and the `@pixi/sound` integration. Uses bundle ids only.
- `packages/ui/src/lib/platformer/engine/input`
  - Owns `KeyboardSource` and `GamepadSource` and produces a normalized `InputState` per fixed step.
- `packages/ui/src/lib/platformer/runtime/PlatformerHud.svelte`
  - Visual-only HUD component. Bound through a `PlatformerHud.svelte.ts` model that subscribes to engine events.
- `packages/ui/src/lib/platformer/runtime/PlatformerHud.svelte.ts`
  - Owns HUD presentation state: lives, score, coins, time, world label.
- `apps/desktop-app`
  - Wires the engine and HUD together at the page-model level only. No gameplay rules in the app.

## Implementation Plan

1. Define normalized input.
   - `InputState`:
     - `left`
     - `right`
     - `up`
     - `down`
     - `jump`
     - `run`
     - `pause`
   - Each field is a derived boolean built from the active input source.
   - `InputSource` interface:
     - `pollFixed(): InputState`
     - `dispose(): void`
   - Provide `KeyboardSource` (arrow keys / WASD + Z / X) and `GamepadSource` (Standard Gamepad mapping).
   - `CompositeInputSource` merges sources with `OR` semantics so keyboard and gamepad both work.
2. Define core runtime components.
   - `Position { x, y }`
   - `Velocity { vx, vy }`
   - `Body { aabb: AABB; grounded: boolean; ceilinged: boolean; lastBottom: number }`
   - `PlayerControl { wantsJump: boolean; wantsRun: boolean; coyoteMs: number; bufferMs: number; ducking: boolean }`
   - `PlayerState { power: PowerUpKind; iframesMs: number; starMs: number; faceDir: -1 | 1 }`
   - `EnemyAi { kind: EntityKind; patrol: PatrolConfig; deathState: 'alive' | 'stomped' | 'kicked' | 'gone' }`
   - `Item { kind: EntityKind; bobOffset?: number }`
   - `Hazard { lethal: boolean }`
   - `Camera { x: number; deadzoneHalfWidth: number; locked: boolean; minX: number }`
   - `Animation { sheetId: string; clip: string; frame: number; t: number }`
   - `Audio { onSpawn?: string; onDeath?: string }`
3. Implement the player controller system.
   - Read `InputState` produced by the input source for the fixed step.
   - Horizontal speed:
     - walk speed cap, accelerated under hold
     - run cap when `run` held
     - friction on release
     - skid frames when reversing direction at high speed
   - Jump:
     - variable height: jump impulse + sustained reduced gravity while `jump` held
     - coyote time: jump still allowed for `coyoteMs` after leaving a ledge
     - jump buffer: jump press queued for `bufferMs` so a slightly-early press still fires on land
   - Ducking:
     - `down` while grounded sets `ducking`. While big, swaps to short AABB.
   - Power state transitions:
     - small to big on `mushroom`
     - big to fire on `flower`
     - star sets `starMs`
     - hazard or enemy hit downgrades fire to big to small to death; sets `iframesMs` window
4. Implement the gravity and integration system.
   - Apply gravity to `Velocity.vy` unless grounded with no jump intent.
   - Integrate `Position` from `Velocity` with axis-separated sweep using `TileGrid` and `BroadPhase`.
   - Update `Body.grounded`, `Body.ceilinged`, and `Body.lastBottom` after integration.
   - Emit `bumpableHit` for tiles when a head-on Y collision occurs while moving up.
5. Implement tile interaction effects.
   - On `bumpableHit` for `brick`:
     - if `power === grow` or `power === fire`, destroy the tile and award score
     - else play a bounce animation and award no score
   - On `bumpableHit` for `question`:
     - convert to `hardBlock` and spawn the item declared by the matching `EntitySpawn.params.contains` value, defaulting to `coin`
   - On overlap with `coinTile`:
     - convert to `empty`, award coin, increment `PlayerProfile.coins`
   - On overlap with `hazard`:
     - apply damage to the player based on `power` and `iframesMs`
6. Implement the enemy systems.
   - `WalkerEnemySystem`:
     - moves at constant speed, turns at walls and at edges (when patrol param `edgeAware` is true)
   - `ShellEnemySystem`:
     - walker that becomes a stationary shell on stomp, becomes a sliding projectile on second contact, ricochets off walls, kills other enemies on contact
   - `FlyingEnemySystem`:
     - sine-wave vertical motion, constant horizontal speed
   - `FireBarSystem`:
     - rotating chain of segments anchored at a tile, lethal on contact regardless of power state
   - `BulletShooterSystem`:
     - periodically spawns `bullet` entities that travel horizontally and despawn off-screen
   - All enemies expose a deterministic `tickFixed(dt)` step.
7. Implement player vs entity resolution.
   - Stomp:
     - if player `Velocity.vy > 0` and player bottom crosses enemy top within a tolerance, mark enemy `stomped`, bounce the player, and award score
   - Side hit:
     - if star is active, mark enemy `gone`
     - else apply damage to the player
   - Item pickup:
     - on overlap with `coin`, award coin
     - on overlap with `mushroom`, `flower`, `star`, or `oneUp`, apply the corresponding effect
   - Spring:
     - on grounded contact, set `Velocity.vy` to a high jump impulse the next step
8. Implement projectiles.
   - `Fireball` entity:
     - spawned on player `attack` while in `fire` power
     - bounces off floors, travels horizontally, despawns on wall contact or off-screen
     - kills standard enemies on contact
9. Implement the camera system.
   - Horizontal-only by default (`scrollMode === 'horizontal'`).
   - Deadzone: camera follows when player exits the deadzone.
   - Never scroll back: `Camera.minX` is monotonically non-decreasing.
   - Fall-off-screen: a player whose `Position.y` exceeds the map bottom by more than two tiles triggers `lifeLost`.
10. Implement world rules.
    - Goal:
      - flag-pole goal awards score by player Y at contact
      - door and edge-exit goals award a fixed completion bonus
    - Pipes:
      - if `EntitySpawn.params.teleportTo` is set on a `pipeTop`, holding `down` while standing on the pipe transitions to the linked sub-map
    - Time:
      - countdown timer per level, runs out triggers `lifeLost`
11. Implement HUD presentation state.
    - `PlatformerHudModel` exposes:
      - `lives`
      - `score`
      - `coins`
      - `time`
      - `worldLabel`
      - `power`
    - The page model from `05-route-integration.md` subscribes to engine events and applies them to `PlatformerHudModel`.
12. Implement audio.
    - `AudioBus` plays bundle-keyed sounds:
      - `jump`, `bump`, `coin`, `powerUp`, `stomp`, `death`, `oneUp`, `pause`, `levelComplete`, `gameOver`, `fireball`
    - `AudioBus.playMusic(trackId)` switches background music with crossfade.
    - All audio assets must come from the IP-safe asset bundle.
13. Implement world progression.
    - The runtime owns a `RunController` that loads `WorldDefinition.levels[]` in order.
    - On `goalReached`, it advances to the next level.
    - On `lives === 0`, it emits `runFinished` with `outcome: 'gameOver'`.
    - On finishing the last level, it emits `runFinished` with `outcome: 'completed'`.
14. Implement pause behavior.
    - `pause` input freezes the fixed-step loop and ducks audio.
    - The HUD shows a paused overlay through the page model, not from inside the engine.

## Tests

- Pure system tests using `bun:test` and the engine's `tickFixed(dt)` method.
- Player physics:
  - jump height equals expected pixels for a 1-frame, 4-frame, and 16-frame `jump` hold
  - coyote time allows a jump within the configured window after leaving a ledge
  - jump buffer fires a queued jump on land
  - ducking switches AABB when big
- Power state transitions:
  - small + mushroom = big
  - big + flower = fire
  - fire + hazard = big with iframes
  - big + hazard = small with iframes
  - small + hazard = death
- Enemies:
  - walker turns at walls and edges
  - shell becomes a slider on second contact and kills other enemies
  - fire bar is lethal regardless of power
  - bullet shooter spawns at the configured cadence
- Items:
  - coin, mushroom, flower, star, oneUp each apply their effect once
- Camera:
  - never scrolls back
  - moves only when player exits the deadzone
- Audio:
  - `AudioBus.playMusic` swaps tracks and fires no extra `playMusic` event when called twice with the same id
- HUD model:
  - score, coins, lives, and time updates flow from engine events
- Run controller:
  - advances on `goalReached`
  - emits `runFinished` with the right outcome for game over and completion

## Acceptance Criteria

- The runtime delivers the full classic moveset: walk, run, variable-height jump, coyote time, jump buffer, ducking, power transitions, fireballs, and star invincibility.
- The enemy roster covers walker, shell, flying, fire bar, and bullet shooter with deterministic `tickFixed(dt)` behavior.
- Tile interactions implement bumpable bricks, question blocks, hazard tiles, and pipe transitions.
- The camera is horizontal-only by default with a deadzone and never scrolls back.
- The HUD reports lives, score, coins, time, world label, and power state from engine events.
- The IP guardrail is honored across code, assets, and labels.

## Dependencies

- `01-engine-and-domain.md` provides the engine surface, ECS-lite primitives, physics primitives, and shared domain types.
- `04-persistence-and-services.md` provides the bundled built-in worlds the runtime loads.
- `05-route-integration.md` provides the page model and HUD wiring.
- `@pixi/sound` is the audio runtime.

## Risks / Notes

- "Game feel" lives in tuning constants. Document the tunables (`gravity`, `jumpImpulse`, `walkCap`, `runCap`, `friction`, `coyoteMs`, `bufferMs`) in the engine module so future contributors can adjust without spelunking.
- Enemies must stay deterministic at fixed step. Avoid `Math.random()` inside system updates without a seeded RNG.
- The IP guardrail is non-negotiable. A single sprite of the wrong character can sink the experiment publicly. Treat asset review as part of code review.
- Audio crossfades can cause clicks if sample rates differ. Standardize on `44100Hz` mono OGG for SFX and stereo OGG for music.
