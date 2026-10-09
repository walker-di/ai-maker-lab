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
