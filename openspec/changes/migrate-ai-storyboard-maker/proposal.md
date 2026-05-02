## Why

The AI storyboard maker currently lives in a separate SvelteKit project at `/Users/walker/Documents/Dev/vibe-coding/003-ai-storyboard-creator`. Bringing it into `ai-maker-lab` lets the desktop app offer prompt-driven storyboard creation alongside the existing lab/marketing workflows while reusing the monorepo's shared UI, domain contracts, SurrealDB persistence, and AI/media infrastructure.

The source project cannot be copied directly because it uses Bootstrap, Drizzle/SQLite, route-level business logic, direct `fetch('/api/...')` calls in UI components, and mixed Svelte component state/transport/export orchestration. The migration should re-express the same product capability through this repo's clean architecture boundaries and shadcn-svelte design system.

## What Changes

- Add an AI Storyboard Maker feature to the desktop app.
- Add storyboard-oriented browser-safe contracts and validation in `packages/domain`.
- Add application use cases for storyboard creation, frame generation, frame editing, asset generation, transitions, and export.
- Persist storyboard data through existing SurrealDB infrastructure instead of the source repo's Drizzle/SQLite schema.
- Reuse or extend existing marketing AI/media/export gateways for structured text generation, image generation, narration audio, BGM, asset storage, and FFmpeg export.
- Add VibeVoice narration support through a GGUF-capable local runtime, including model discovery for `gguf-org/vibevoice-gguf` or equivalent published VibeVoice GGUF repos.
- Add app-local transport adapters so pages/page models never construct `/api/**` URLs directly.
- Add shared shadcn-based UI components under `packages/ui` for storyboard list, editor, frame controls, dialogs, and export state.
- Add tests across shared validation, application use cases, Surreal repositories, adapters, Svelte page models/components, and e2e smoke coverage.

## Capabilities

### New Capabilities

- Create and list storyboards.
- Generate narration audio with a VibeVoice local provider backed by a GGUF-capable runtime, including multilingual narration and prompt/reference-audio speaker guidance.
- Generate ordered storyboard frames from a story prompt.
- Insert blank frames into an existing storyboard.
- Edit narration and media prompts per frame.
- Regenerate narration/image/BGM prompts using storyboard context.
- Generate or attach per-frame assets:
  - main image
  - background image
  - narration audio
  - background music
- Reorder and delete frames while preserving deterministic frame order.
- Configure transitions after frames.
- Export storyboard media, including at least a unified video export path.
- Access the feature through a SvelteKit route using shared shadcn UI components.

### Modified Capabilities

- Existing marketing story/scene/clip domain and infrastructure may gain storyboard-specific metadata, validation, ports, repositories, or use cases.
- Existing narration model catalogs and gateways may gain dedicated VibeVoice GGUF model cards and runtime wiring while keeping MMS/Qwen Hugging Face local support intact.
- Existing AI/media/export gateways may gain structured storyboard generation, aspect-ratio-aware image generation, and transition-aware export support.
- Desktop app navigation gains an entry for Storyboard Maker.

## Impact

- Adds new UI under the desktop app and shared `packages/ui` storyboard components.
- Extends `packages/domain` marketing/story contracts and application services while preserving browser-safe imports through `domain/shared` and server composition through `domain/application`/`domain/infrastructure`.
- Adds thin SvelteKit API route adapters under the app boundary.
- Adds new automated tests and e2e coverage.
- Does not migrate Bootstrap, Drizzle, SQLite, source static file storage assumptions, or route-level business logic from the reference project.
