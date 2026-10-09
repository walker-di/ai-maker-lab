## Why

The racing sim has no way to review a run. `migrate-racing-sim-prototype/follow-ups.md` (item 7) planned replays and a ghost car built on `engine.events.tick`. Lap replay and a best-lap ghost are the main tools for learning a track and judging setup changes.

## What Changes

- Add a pose recorder (`ReplayRecorder`) that samples chassis and wheel poses plus HUD channels at 60 Hz from engine `tick` events. It keeps:
  - the last lap;
  - the best lap;
  - a rolling "last 60 s" buffer.
- Add `ReplayPlayer` and `sampleTrace` for interpolated playback, with play/pause, seek, loop and 0.25–2× speed.
- Add a translucent ghost car to `RacingRenderer`, driven by the best lap and synced to the current lap's elapsed sim time.
- Add a replay mode to the page model. It freezes the live sim, plays the trace through a replay-owned camera rig, and resumes the live sim unchanged on exit.
- Add a HUD `ReplayBar` and key bindings:
  - `V` toggles replay and `G` toggles the ghost;
  - in replay, `Space`/`P` play or pause, `←`/`→` seek ±1 s, and `Esc` exits.
- Fix the HUD current-lap time, which subtracted a millisecond `lap.t0` from sim seconds.

## Capabilities

### New Capabilities
- Replay of the last lap, the best lap, or the last 60 s of driving.
- A best-lap ghost while driving.

### Modified Capabilities
- `racing-sim`: new replay and ghost requirements.

## Impact

- In-memory only. There are no persistence, transport or API changes, and traces are cleared on a track or vehicle change.
- Traces are plain data with no Three.js objects, so persisting them later is additive.
- Replays play back recorded poses rather than re-simulating inputs. The Jolt compliance path and out-of-step shifts make input replays non-reproducible.
