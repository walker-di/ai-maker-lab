## ADDED Requirements

### Requirement: Racing sim records and replays driving

The racing experiment SHALL record the player's chassis and wheel poses during a run and SHALL let the player replay the last lap, the best lap, or the last 60 seconds of driving.

#### Scenario: Recording during a run

- **WHEN** the live simulation is stepping
- **THEN** the recorder samples poses and HUD channels at about 60 Hz from engine `tick` events
- **AND** a completed lap between two start/finish crossings is stored as the last lap, and as the best lap when it is faster than the stored best
- **AND** the in-progress lap buffer is capped (10 minutes by default); past it the lap is dropped and nothing more is buffered until the next crossing

#### Scenario: Only valid laps count

- **WHEN** the car crosses the start/finish line forward without having reached every ordered sector checkpoint (25 %, 50 %, 75 % of the centerline) since the lap started, for example after reversing back over the line and recrossing it
- **THEN** no lap is finished: lap timing, the last/best replay traces, the ghost and lap persistence all ignore it
- **AND** the crossing restarts the lap in progress instead

#### Scenario: Entering and leaving replay

- **WHEN** the player presses `V` or picks a source in the replay bar
- **THEN** the live simulation stops stepping and the car, wheels, camera and HUD speed, gear, rpm and inputs follow the recorded trace
- **AND** `Space` toggles playback, `←`/`→` seek one second, and the speed can be set to 0.25×, 0.5×, 1× or 2×
- **AND** pressing `Esc` or `V` returns to the live simulation in exactly the state it was left
- **AND** these keys keep working after the player uses the scrubber, play button or speed chips

#### Scenario: Replay data lifetime

- **WHEN** the track or vehicle changes, or the run stops
- **THEN** all recorded traces are discarded
- **AND** a car reset discards only the lap in progress

### Requirement: Best-lap ghost

The racing experiment SHALL render a translucent ghost car following the best lap recorded in the current session while the player drives. The replay bar labels that source "Session best"; the HUD lap card's best is the all-time best from the server and is labelled "All-time best".

#### Scenario: Ghost follows the current lap clock

- **WHEN** a best lap exists, the ghost is enabled, and a lap is in progress
- **THEN** the ghost is drawn at the best lap's pose for the current lap's elapsed sim time
- **AND** it is hidden when the elapsed time exceeds the best lap, when no lap is running, or during replay

#### Scenario: Toggling the ghost

- **WHEN** the player presses `G` or the ghost chip in the replay bar
- **THEN** the ghost visibility toggles and the HUD chip reflects the state
