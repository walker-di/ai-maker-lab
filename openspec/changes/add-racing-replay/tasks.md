## Implementation Tasks

- [x] 1.1 `packages/ui/src/lib/racing/engine/replay.ts`: `ReplayRecorder`, `ReplayPlayer`, `sampleTrace`, `stepReplayCamera`
- [x] 1.2 Export the replay API from `engine/index.ts`
- [x] 1.3 Unit tests in `engine/replay.test.ts`, driving a real `RacingEngine`
- [x] 2.1 `RacingRenderer` ghost group with `setGhostPose(pose | null, wheels?)` and translucent cloned materials
- [x] 3.1 HUD `replay` state, `setReplay()`, and the `ReplayBar` component mounted by `RacingHud`
- [x] 4.1 Page model replay mode, ghost sync and recorder lifecycle
- [x] 4.2 Fix the `currentMs` unit mismatch
- [x] 5.1 Route key bindings and control hints
- [x] 6.1 Page model unit tests and Playwright e2e for replay and the ghost toggle

## Review follow-ups (PR #5 review)

- [x] 7.1 Engine lap validation: ordered sector checkpoints gate `lapFinished`; a line hop restarts the lap (timing, replay and persistence share the rule)
- [x] 7.2 `ReplayRecorder.hasRecent` O(1) availability query used by the per-frame HUD sync
- [x] 7.3 Cap the in-progress lap buffer (`maxLapSeconds`, default 600 s)
- [x] 7.4 Page model tests mount a real engine with a fake renderer and assert replay gating and ghost effects
- [x] 7.5 Replay keys keep working after the scrubber, play button and speed chips
- [x] 7.6 Honest labels: "Session best" (replay/ghost) vs "All-time best" (HUD)
- [x] 7.7 Telemetry export `currentStartS` in seconds; drop unused `toggleReplay`
