# Racing Sim — Follow-up Tickets

Captured during the `migrate-racing-sim-prototype` migration. None of these
block the route shipping; they are deliberate next-step items.

## Engine / Physics

1. **Jolt-backed chassis integrator.** Day-one ships with a self-contained
   rigid-body integrator. Wire `RacingEngine` against the Jolt body created by
   `jolt-loader.ts` so vehicle-vs-vehicle collisions and terrain elevation
   become possible.
2. **Terrain elevation.** The flat-ground raycast should be replaced with a
   sampled heightfield from the track ribbon (or a Jolt mesh shape) so curbs,
   apex altitude, and corkscrew elevation work in 3D rather than as visual
   overlays.
3. **AI opponents.** Slot a deterministic racing-line follower into the engine
   alongside the player chassis. Reuse `centerline` sampling and the existing
   surface lookup.
4. **Audio synthesis.** Replace `NullAudioBus` with a `WebAudioBus`
   implementation that synthesises engine RPM, tire scrub, and impact pops.

## UI / Route

5. **In-route setup UI.** The `setup` page model already loads / saves /
   clamps `SetupValues`, but the route currently has no editor — add a panel
   for toe / camber / motion-ratio / bump-stop tuning.
6. **Controller / gamepad input.** Extend `RacingInput` with `gamepad-api`
   bindings (LT / RT analog throttle + brake, RS for camera).
7. **Replays.** Subscribe to `engine.events.tick` and persist a downsampled
   per-frame trace; render a ghost car using the same renderer.
8. **More built-in catalogs.** Author additional vehicle and track JSON files
   in `packages/domain/src/infrastructure/racing/builtins/` (rally car, GT3,
   night track, gravel rally stage).

## Performance / Build

9. **Lazy-load three / jolt.** The route currently pulls `three` and
   `jolt-physics` into the main app bundle through `ui/source`. Move the
   engine + renderer to a dynamic import so non-racing routes stay small.
10. **Asset pipeline.** Pre-generate texture atlases / instanced scenery
    geometry to reduce draw calls on busy tracks.

## Test / DX

11. **e2e drive smoke.** Extend `racing.e2e.ts` with a Playwright recipe that
    presses W for 1 s and asserts the speed-card text changes from `0 km/h`.
    Currently skipped because of timing flakiness around `requestAnimationFrame`.
12. **Performance budget assertion.** Add a Vitest browser-mode test that
    confirms `engine.tick(1/60)` stays under 4 ms on the dev box.
