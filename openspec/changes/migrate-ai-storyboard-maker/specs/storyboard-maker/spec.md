## ADDED Requirements

### Requirement: Storyboards are manageable

The desktop app SHALL provide a Storyboard Maker workflow where users can create, list, open, and persist storyboards through the migrated feature area.

#### Scenario: User creates a storyboard

- **WHEN** a user submits a valid storyboard name
- **THEN** the storyboard is persisted through an application service
- **AND** the storyboard appears in the storyboard list without requiring a page reload

#### Scenario: User lists persisted storyboards

- **WHEN** a user opens the Storyboard Maker route after storyboards have been created
- **THEN** the app displays persisted storyboards from SurrealDB-backed repositories
- **AND** the list uses browser-safe DTOs without infrastructure identifiers leaking to the UI

#### Scenario: Invalid storyboard input is rejected

- **WHEN** a user submits an empty or invalid storyboard request
- **THEN** the UI displays a validation error
- **AND** no invalid storyboard is persisted

### Requirement: Storyboard frames are generated from prompts

The feature SHALL generate ordered storyboard frames from a user prompt using an application-layer AI text generation port.

#### Scenario: User generates frames from a story prompt

- **WHEN** a user submits a valid story prompt and frame count
- **THEN** the application service invokes a structured storyboard generation port
- **AND** persists generated frames in deterministic order
- **AND** each generated frame includes narration, main image prompt, background image prompt, and BGM prompt data

#### Scenario: Generated frames append to existing frames

- **WHEN** a storyboard already has frames and the user generates more frames
- **THEN** the new frames are appended after the current maximum order index
- **AND** existing frame order is preserved

#### Scenario: Empty AI generation is rejected safely

- **WHEN** the AI generation port returns no frames or schema-invalid frames
- **THEN** the operation fails with a controlled error
- **AND** no partial invalid frame set is persisted

#### Scenario: Automated tests do not call live providers

- **WHEN** automated tests exercise frame generation
- **THEN** tests mock the application-layer AI generation port
- **AND** tests do not call live Gemini, OpenAI, Anthropic, Replicate, Azure, or other external providers

### Requirement: Storyboard frames are editable and orderable

The feature SHALL let users insert blank frames, edit frame text/prompts, reorder frames, delete frames, and maintain deterministic ordering semantics.

#### Scenario: User inserts a blank frame

- **WHEN** a user inserts a blank frame after an existing frame
- **THEN** later frames shift to preserve unique order positions
- **AND** the blank frame is persisted at the requested position

#### Scenario: User edits frame text and prompts

- **WHEN** a user updates narration or media prompts for a frame
- **THEN** the persisted frame reflects the edited values
- **AND** unrelated generated asset URLs are not modified by the text update

#### Scenario: User reorders a frame

- **WHEN** a user moves a frame up or down
- **THEN** the frame swaps order with the adjacent frame in that direction
- **AND** the UI displays the updated ordered frame list

#### Scenario: User deletes a frame

- **WHEN** a user deletes a frame
- **THEN** the frame is removed from the storyboard
- **AND** remaining frames preserve deterministic order according to the application contract

### Requirement: Frame prompts can be regenerated with context

The feature SHALL regenerate narration, main image, background image, or BGM prompts for a frame using storyboard context through an application-layer AI text generation port.

#### Scenario: User regenerates a frame prompt

- **WHEN** a user requests prompt regeneration for a supported prompt type
- **THEN** the application service sends ordered storyboard context to the AI prompt regeneration port
- **AND** returns the regenerated prompt text
- **AND** updates or presents the regenerated prompt according to the use-case contract

#### Scenario: Prompt regeneration provider fails

- **WHEN** the prompt regeneration provider returns an error
- **THEN** the application service maps the failure to a controlled error
- **AND** the UI displays a recoverable error state
- **AND** existing prompt text is not overwritten by a failed regeneration

### Requirement: Storyboard assets are generated or attached per frame

The feature SHALL support generating and attaching per-frame visual and audio assets while keeping provider-specific SDKs outside shared domain and UI code.

#### Scenario: User generates a main image

- **WHEN** a user requests main image generation for a frame
- **THEN** the application service invokes an image generation port with the frame's main image prompt
- **AND** the generated image URL or asset reference is persisted on the frame

#### Scenario: User generates a background image

- **WHEN** a user requests background image generation for a frame
- **THEN** the image generation request includes the intended background aspect ratio
- **AND** the generated background image URL or asset reference is persisted on the frame

#### Scenario: User generates narration audio

- **WHEN** a user requests narration audio for a frame
- **THEN** the application service invokes a narration audio port with the frame narration and voice settings
- **AND** the generated narration audio URL or asset reference is persisted on the frame

#### Scenario: User generates background music

- **WHEN** a user requests BGM generation for a frame
- **THEN** the application service invokes a BGM/media generation port with the frame BGM prompt
- **AND** the generated BGM URL or asset reference is persisted on the frame

#### Scenario: User selects or uploads an existing asset

- **WHEN** a user selects or uploads a compatible image or audio asset
- **THEN** the selected asset is associated with the requested frame field
- **AND** persistence uses the current app's asset storage conventions rather than the source repo's static folder layout

### Requirement: Frame transitions are configurable

The feature SHALL let users configure a transition after a frame and persist transition intent for export.

#### Scenario: User updates a frame transition

- **WHEN** a user selects a transition type and duration for a frame
- **THEN** the transition settings are persisted as the outgoing transition after that frame
- **AND** the storyboard editor displays the saved transition settings

#### Scenario: Transition input is invalid

- **WHEN** a user submits an unsupported transition type or invalid duration
- **THEN** the operation fails with a validation error
- **AND** previous transition settings remain unchanged

### Requirement: Storyboards are exportable

The feature SHALL provide storyboard export capabilities through an application-layer export service and infrastructure exporter.

#### Scenario: User exports a unified video

- **WHEN** a user requests unified storyboard video export for a storyboard with exportable frames
- **THEN** the application service delegates to a video exporter with ordered frame data
- **AND** the UI exposes a success/download affordance when export completes

#### Scenario: Storyboard is not exportable

- **WHEN** a user requests export for a storyboard missing required frame assets or narration according to the export contract
- **THEN** the operation fails with a controlled validation error
- **AND** the UI communicates what must be fixed before export

#### Scenario: Exporter fails

- **WHEN** FFmpeg or the export infrastructure fails
- **THEN** the failure is logged at the infrastructure/app boundary
- **AND** the application returns a controlled error to the UI
- **AND** temporary files are cleaned up where applicable

### Requirement: UI uses shared shadcn-based components

The migrated Storyboard Maker UI SHALL be implemented with this repo's shared Svelte UI package and shadcn-svelte primitives rather than Bootstrap or source-local component copies.

#### Scenario: Storyboard route renders with shared UI

- **WHEN** the Storyboard Maker route is loaded
- **THEN** pages render shared components imported from `ui/source`
- **AND** storyboard-specific visual components live under `packages/ui/src/lib/storyboard/**`

#### Scenario: Dialogs and controls are accessible

- **WHEN** users interact with create, add-frame, asset selection, prompt regeneration, transition, and export controls
- **THEN** controls have accessible labels and keyboard-operable shadcn Dialog/Tabs/Select behavior
- **AND** source Bootstrap modal/tab behavior is not required

#### Scenario: Shared UI remains domain-independent

- **WHEN** shared storyboard UI components need storyboard data
- **THEN** they use local structural UI types from `packages/ui/src/lib/storyboard/types.ts`
- **AND** `packages/ui` does not import `packages/domain`

### Requirement: Frontend uses adapter-based composition

Storyboard pages and page models SHALL depend on app-local transport adapters rather than constructing raw API URLs directly.

#### Scenario: Page model loads storyboards

- **WHEN** the storyboard page model loads data
- **THEN** it calls a `StoryboardTransport` interface supplied by route-local composition
- **AND** it does not call `fetch('/api/...')` or construct API paths directly

#### Scenario: Web transport calls HTTP endpoints

- **WHEN** the web transport performs a storyboard operation
- **THEN** only the transport adapter knows the concrete `/api/marketing/storyboards/**` endpoint paths
- **AND** non-2xx responses are mapped to useful UI-facing errors

### Requirement: Backend uses clean architecture boundaries

Storyboard backend behavior SHALL be implemented through shared contracts, application services, ports, infrastructure adapters, and thin API routes.

#### Scenario: API route handles a valid storyboard request

- **WHEN** an HTTP client sends a valid storyboard request to a Storyboard API route
- **THEN** the route parses and validates the request
- **AND** delegates business behavior to an application service
- **AND** returns a JSON response with plain DTOs

#### Scenario: API route handles invalid input

- **WHEN** an HTTP client sends invalid storyboard request data
- **THEN** the route returns a controlled 4xx JSON response
- **AND** route code does not duplicate domain behavior beyond request parsing and adapter mapping

#### Scenario: Persistence uses SurrealDB repositories

- **WHEN** storyboard data is persisted or loaded
- **THEN** infrastructure uses SurrealDB-backed repositories
- **AND** no Drizzle, SQLite, or source database schema is introduced

### Requirement: Validation covers migration-critical behavior

The change SHALL include automated validation for domain contracts, application services, persistence, transports, UI models/components, and an e2e storyboard smoke flow.

#### Scenario: Repository tests use isolated mem databases

- **WHEN** repository tests run
- **THEN** each test opens a real SurrealDB `mem://` connection with a unique namespace/database
- **AND** closes the connection after each test

#### Scenario: Frontend tests verify adapter boundary

- **WHEN** page model and component tests run
- **THEN** they use mocked `StoryboardTransport` implementations
- **AND** they verify pages/page models do not construct raw `/api/**` URLs

#### Scenario: E2E smoke test runs without live providers

- **WHEN** the storyboard e2e smoke test runs
- **THEN** AI/media/export responses are mocked or disabled behind test seams
- **AND** the test covers create storyboard, generate frames, edit/reorder frames, configure transition, attach/generate mocked assets, and export success/error affordance
