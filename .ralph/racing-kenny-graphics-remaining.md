# Racing Sim Graphics Improvement — Remaining Iterations

## Already Completed (Iteration 1)
- ✅ Vehicle model: `race-future.glb` now loads and replaces the primitive box body. Wheels remain as cylinders. Asset loading + fallback works. Tests pass.
- ✅ `PROP_ASSET_FILE` and `PROP_FALLBACK_COLOR` mappings prepared for 12 prop kinds.
- ✅ `primeAssets()` and `fallbackProp()` handle any string prop kind with graceful fallback.

## Remaining Work

### Iteration 2: Expand PropKind in scenery-placement.ts and types.ts
- **Task**: Update `PropKind` type in `packages/ui/src/lib/racing/engine/tracks/scenery-placement.ts` to include all new kinds: `flag`, `fence`, `grandStand`, `pitBuilding`, `pylon`, `banner`, `radar`, `overhead`.
- **Task**: Update `SceneryHint` in `packages/ui/src/lib/racing/types.ts` to include new fields for all prop kinds.
- **Files**: `packages/ui/src/lib/racing/engine/tracks/scenery-placement.ts`, `packages/ui/src/lib/racing/types.ts`
- Ensure everything that imports `PropKind` still compiles. Run tests.

### Iteration 3: Context-Aware Scenery Placement
- **Task**: Rewrite `placeScenery` in `packages/ui/src/lib/racing/engine/tracks/scenery-placement.ts` to be context-aware:
  - **Start/finish line** (index 0): `flagCheckers` + `banner` towers
  - **Track borders**: `fence` along outer edge on all segments; `barrier` at sharper corners
  - **Long straights**: `light` posts spaced evenly; `grandStand` on outer side
  - **Pit area** (near start): `pitBuilding` cluster
  - **Apexes/corners**: `pylon` markers; `cone` at runoff zones
  - **Billboards**: scattered on outer edges of straights
  - **Radar/tech**: near start/finish
  - **Overhead**: start/finish gantry
- Use segment curvature analysis to classify segments into: straight, gentle curve, sharp corner.
- Place props on outer edge of corners, both sides of straights for lights/fences.
- **File**: `packages/ui/src/lib/racing/engine/tracks/scenery-placement.ts`

### Iteration 4: Track Surface Visual Polish
- **Task**: Improve the track ribbon in `packages/ui/src/lib/racing/engine/three-renderer.ts`:
  - Kerbs: Red/white alternating rectangular prisms placed along the ribbon edges, using `curbWidth` and `curbProfile` from `TrackPreset`
  - Rubber line: Darker strip at center of track where cars drive
  - Surface variation: Tint track based on `gravelZones`, `dampZones`
- **File**: `packages/ui/src/lib/racing/engine/three-renderer.ts`

### Iteration 5: Environment & Atmosphere
- **Task**: Dramatically improve scene environment in `packages/ui/src/lib/racing/engine/three-renderer.ts`:
  - Replace flat green ground plane with a more realistic look: asphalt color around track, grass/gravel beyond. Consider a ground texture or at least a color gradient from the track outward.
  - Add `scene.fog` for depth perception (`Fog` or `FogExp2`)
  - Enable shadows: `sun.castShadow = true`, `renderer.shadowMap.enabled = true`, add `ShadowMaterial` or set `ground.receiveShadow = true`
  - Improve lighting: tune `HemisphereLight` for warmer outdoor feel
  - Sky dome: Add a large sphere with a gradient or simple sky color to replace the flat dark background
  - Optional: simple exhaust/dust particle system (only if trivial to add)
- **File**: `packages/ui/src/lib/racing/engine/three-renderer.ts`

### Iteration 6: Asset Loading & Caching Polish
- **Task**: Review and polish asset loading in `packages/ui/src/lib/racing/engine/three-renderer.ts`:
  - Ensure all 12 prop asset files are correctly mapped and load
  - Ensure `primeAssets` preloads all kinds needed for current track
  - Test fallback for each asset family by temporarily renaming files
  - Make `placeScenery` resilient to `assetCache` misses
- **Testing**: Run the browser test; update it to cover new prop kinds.

### Iteration 7: Integration & Final Polish
- **Task**: Wire everything together:
  - Update track presets to set meaningful `propCadence` values with new prop kinds
  - Update `racing-kenney-assets.test.ts` to verify new asset families exist on disk
  - Run ALL tests in `packages/ui` and `apps/desktop-app`
  - Fix any TypeScript errors
  - Ensure no console warnings during normal operation
- Verify the visual result is a dramatic improvement.

## Acceptance Criteria
- [ ] `race-future.glb` used as player vehicle (DONE)
- [ ] At least 10 of 30 Kenny assets actively placed around track
- [ ] Track has visible kerbs, rubber line, and surface variation
- [ ] Scene has fog, shadows, and improved lighting
- [ ] No console errors from missing assets (graceful fallback)
- [ ] All existing tests pass
- [ ] Visual result is dramatically improved

## Model Override
Use `@cf/moonshotai/kimi-k2.6` for all subagents.
