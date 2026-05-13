# Racing Sim Graphics Improvement — Kenny Asset Utilization

## Context
The AML Racing sim prototype has **30 Kenny GLB assets** in `apps/desktop-app/static/racing/extracted/` but only **4 are used**:
- cone.glb → cone
- barrierWhite.glb → barrier  
- lightPostModern.glb → light
- billboard.glb → billboard

The rest sit unused: `race-future.glb`, `grandStand.glb`, `grandStandCovered.glb`, `pitsGarage.glb`, `pitsOffice.glb`, `fenceStraight.glb`, `fenceCurved.glb`, `flagCheckers.glb`, `flagGreen.glb`, `flagRed.glb`, `pylon.glb`, `bannerTowerGreen.glb`, `bannerTowerRed.glb`, `radarEquipment.glb`, `overheadLights.glb`, `overhead.glb`, etc.

The renderer is in `packages/ui/src/lib/racing/engine/three-renderer.ts` and uses `packages/ui/src/lib/racing/engine/tracks/scenery-placement.ts` for prop placement.

## Goal
Make the racing sim look visually rich by leveraging ALL available Kenny assets. The car should look like a car, the track should feel like a real race circuit with environment, and the overall scene should be dramatically more immersive.

## Iteration Plan

### Iteration 1: Vehicle Model (race-future.glb)
- **Task**: Replace the primitive box+cylinder chassis with `race-future.glb`
- **Details**: Load the GLB via GLTFLoader, cache it. When `setVehiclePreset()` is called, remove old meshes and add the loaded GLB scene as the chassis group child. Wheels: still use cylinder primitives OR load `race-future.glb` and find wheel meshes by name if present. The GLB must be scaled/positioned to match physics wheel positions.
- **File**: `packages/ui/src/lib/racing/engine/three-renderer.ts`

### Iteration 2: Prop Kind Expansion
- **Task**: Expand `PropKind` from 4 to ~12 types, mapping to all available GLBs
- **New kinds to add**: `flag`, `fence`, `grandStand`, `pitBuilding`, `pylon`, `banner`, `radar`, `overhead`
- **File**: `packages/ui/src/lib/racing/engine/tracks/scenery-placement.ts` (update types)
- **File**: `packages/ui/src/lib/racing/types.ts` (update `SceneryHint`)

### Iteration 3: Better Scenery Placement
- **Task**: Rewrite `placeScenery` to be context-aware:
  - **Start/finish line**: `flagCheckers.glb` + `bannerTowerGreen.glb`/`bannerTowerRed.glb`  
  - **Track borders**: `fenceStraight.glb`/`fenceCurved.glb` along the outer edge, `barrierRed.glb`/`barrierWall.glb` at sharper corners
  - ** straights**: `lightPostLarge.glb` / `lightPostModern.glb` spaced evenly
  - **Grandstand areas**: `grandStand.glb` / `grandStandCovered.glb` / `grandStandAwning.glb` on long straights (outer side)
  - **Pit lane**: `pitsGarage.glb` / `pitsOffice.glb` / `pitsGarageClosed.glb` near start/finish
  - **Corner marshaling**: `pylon.glb` at apexes, `cone.glb` / `cone-flat.glb` at runoff zones
  - **Billboards**: `billboard.glb` scattered on outer edges
  - **Radar/tech**: `radarEquipment.glb` near start/finish
  - **Overhead**: `overhead.glb` / `overheadLights.glb` at start/finish
- **File**: `packages/ui/src/lib/racing/engine/tracks/scenery-placement.ts`

### Iteration 4: Track Surface Visual Polish
- **Task**: Improve the track ribbon appearance
  - Darker asphalt with subtle center line
  - Kerbs using `curbWidth` and `curbProfile` data (red/white alternating)
  - Rubber line (dark streak) where `rubberWidth` applies
  - Gravel zone coloring from `gravelZones`
  - Damp zone visual variation
- **File**: `packages/ui/src/lib/racing/engine/three-renderer.ts`

### Iteration 5: Environment & Atmosphere
- **Task**: Dramatically improve the scene environment
  - Replace flat green ground with a more realistic racing-circuit terrain (asphalt color around track, grass/gravel beyond)
  - Add fog for depth (`scene.fog = new Fog(...)`)
  - Improve lighting: add shadows (DirectionalLight with shadow map), tune HemisphereLight
  - Add a sky dome or gradient background (consider a simple sky shader or CSS fallback)
  - Consider adding a simple particle system for dust/exhaust (optional, only if easy)
- **File**: `packages/ui/src/lib/racing/engine/three-renderer.ts`

### Iteration 6: Asset Loading & Caching
- **Task**: Ensure all new assets load efficiently and fallback gracefully
  - Extend `PROP_ASSET_FILE` mapping
  - Ensure `primeAssets` preloads everything needed for the current track
  - Fallback primitives for every new prop kind
  - Handle loading errors without breaking the renderer
- **File**: `packages/ui/src/lib/racing/engine/three-renderer.ts`

### Iteration 7: Integration & Polish
- **Task**: Wire everything together and fix any issues
  - Update `SceneryHint` defaults in track presets to include new prop counts
  - Update `TrackPreset` defaults or specific presets to showcase new scenery
  - Fix any TypeScript errors
  - Ensure the `racing-kenney-assets.test.ts` still passes (or update it to cover new asset families)
  - Run unit tests for affected modules

## Acceptance Criteria
- [ ] `race-future.glb` is used as the player vehicle model
- [ ] At least 10 of the 30 Kenny assets are actively placed around the track
- [ ] Track has visible kerbs, rubber line, and surface variation
- [ ] Scene has fog and improved lighting with shadows
- [ ] No console errors from missing assets (graceful fallback)
- [ ] All existing tests pass (`bun test` in affected packages)
- [ ] The visual result is a dramatic improvement over the current flat gray ribbon + green plane

## Model Override
Use `@cf/moonshotai/kimi-k2.6` for all subagents in this loop.
