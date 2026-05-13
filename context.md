# Storyboard Narration / Speech Provider Investigation

## Scope
Inspected the `ai-maker-lab` storyboard maker implementation to locate the narration/speech provider UI and map controlling files/functions/data structures for:
- narration provider
- audio model
- voice
- language
- local model status/download
- Hugging Face local and VibeVoice local integration

Also reviewed OpenSpec change:
- `openspec/changes/migrate-ai-storyboard-maker/proposal.md`
- `openspec/changes/migrate-ai-storyboard-maker/specs/storyboard-maker/spec.md`
- `openspec/changes/migrate-ai-storyboard-maker/tasks.md`

## Likely UI in screenshot (narration provider controls)
Primary component:
- `packages/ui/src/lib/storyboard/StoryboardModelConfig.svelte`

This file renders:
- provider select (`audioProvider`)
- audio model select (`audioModelOptions`)
- voice select (`audioVoiceOptions`)
- language select (`audioLanguageOptions`)
- local model management actions:
  - `Check local model`
  - `Download model`
- status hints (`ready/missing/error`) and provider recommendation CTA

Provider list and static provider labels are defined in:
- `packages/ui/src/lib/storyboard/StoryboardModelConfig.svelte.ts`
  - `audioProviderOptions = [azure, huggingface-local, vibevoice-local]`

## End-to-end control flow

### 1) Route/UI wiring
- `apps/desktop-app/src/routes/experiments/storyboard/+page.svelte`
  - mounts `StoryboardModelConfig`
  - passes current config values from page model
  - wires callbacks:
    - `onAudioProviderChange -> model.setAudioProvider`
    - `onAudioModelChange -> model.setAudioModel`
    - `onAudioVoiceChange/onAudioLanguageChange -> model.modelConfig update`
    - `onCheckAudioModelLocal -> model.checkNarrationModelStatus`
    - `onDownloadAudioModel -> model.downloadNarrationModel`

### 2) Page model behavior/state
- `apps/desktop-app/src/routes/experiments/storyboard/storyboard-page.svelte.ts`

Key state:
- `modelConfig` includes `audioProvider/audioModel/audioVoice/audioLanguage`
- `narrationOptions` includes provider-scoped `models/voices/languages`
- `narrationModelStatus` in `{ idle, checking, missing, downloading, ready, error }`

Key functions:
- `loadNarrationOptions({ provider?, model? })`
  - calls transport `getNarrationOptions`
  - syncs selected model/voice/language to valid options
- `setAudioProvider(provider)`
  - updates provider, resets status, reloads options
- `setAudioModel(model)`
  - updates model, resets status, reloads options
- `checkNarrationModelStatus()`
  - transport call to model status endpoint
- `downloadNarrationModel()`
  - transport call to download endpoint

### 3) Frontend transport/API clients
- `apps/desktop-app/src/lib/adapters/storyboard/StoryboardTransport.ts`
  - defines `getNarrationOptions`, `getNarrationModelStatus`, `downloadNarrationModel`
- `apps/desktop-app/src/lib/adapters/storyboard/web-storyboard-transport.ts`
  - GET `/api/marketing/narration/options?provider=&model=`
  - GET `/api/marketing/narration/models/status?provider=&model=`
  - POST `/api/marketing/narration/models/download`

### 4) Narration API routes
- `apps/desktop-app/src/routes/api/marketing/narration/options/+server.ts`
- `apps/desktop-app/src/routes/api/marketing/narration/models/status/+server.ts`
- `apps/desktop-app/src/routes/api/marketing/narration/models/download/+server.ts`

All delegate to `marketing-service` helper functions and normalize/validate provider+model input.

### 5) Backend service composition and provider behavior
- `apps/desktop-app/src/lib/server/marketing-service.ts`

Core pieces:
- `createNarrationAudioGateway(...)`
  - creates `CompositeNarrationAudioGateway` with:
    - `azure -> AzureSpeechNarrationGateway`
    - `huggingface-local -> HuggingFaceTransformersNarrationGateway`
    - `vibevoice-local -> UnconfiguredNarrationGateway` (explicit not-configured error)
- `normalizeNarrationProvider(...)`
  - accepted providers: `azure | huggingface-local | vibevoice-local`
- `getNarrationOptions(...)`
- `getNarrationModelStatus(...)`
- `downloadNarrationModel(...)`

Composite logic (`CompositeNarrationAudioGateway`):
- `getOptions(provider, model)`
  - Azure: dynamic voices from gateway `listVoices()`; languages deduped from voice langs
  - Local providers: model/voice/language from model card metadata
  - `supportsLocalModelDownload`: true only for `huggingface-local`
  - `downloadSupportMessage` populated for `vibevoice-local`
- `getModelStatus(provider, model)`
  - non-HF local providers report non-downloadable metadata status
  - HF local checks actual local presence via `isModelLocal()` if gateway supports it
- `downloadModel(provider, model)`
  - only `huggingface-local` allowed
  - `vibevoice-local` rejected with model-card reason

## Hugging Face local integration details
Primary gateway:
- `apps/desktop-app/src/lib/server/marketing/gateways/HuggingFaceTransformersNarrationGateway.ts`

Important behavior:
- Uses `@huggingface/transformers` pipeline (`text-to-speech` task)
- Defaults to model `Xenova/mms-tts-eng`
- Supports language option passthrough to pipeline
- Persists generated WAV via app `assetStorage`
- Implements local model management methods used by composite gateway:
  - `isModelLocal(model)` via `pipeline(..., { local_files_only: true })`
  - `ensureModelReady(model)` for download/prepare
- Explicit model guardrails:
  - rejects VibeVoice models in this gateway (`not supported by @huggingface/transformers in this app yet`)
  - rejects some unsupported patterns (e.g. kokoro/speecht5)

Related tests:
- `apps/desktop-app/src/lib/server/marketing/gateways/HuggingFaceTransformersNarrationGateway.test.ts`
- `apps/desktop-app/src/lib/server/marketing-service.test.ts`

## VibeVoice local integration details
Data/model metadata source:
- `packages/domain/src/shared/ai-models/narration-model-cards.ts`

VibeVoice cards exist for:
- `microsoft/VibeVoice-1.5B` with `availability/status = blocked`
- `microsoft/VibeVoice-Realtime-0.5B` with `availability = missing`, `status = experimental`

Current runtime reality:
- `vibevoice-local` is selectable in UI/provider options
- narration options/status are exposed from metadata
- local download is not supported (`supportsLocalModelDownload = false`)
- synthesis runtime is intentionally unconfigured in service composition
- attempting VibeVoice download is rejected with explicit reason

Related feasibility artifact:
- `apps/desktop-app/scripts/vibevoice-onnx-feasibility.mjs`
  - diagnostic script for ONNX/runtime metadata viability
  - indicates exploratory/prototyping status rather than integrated production adapter

## Data structures controlling provider/model/voice/language

### UI/shared types
- `packages/ui/src/lib/storyboard/types.ts`
  - `StoryboardAudioProvider = 'azure' | 'huggingface-local' | 'vibevoice-local'`
  - `StoryboardNarrationOption` with `availability/status/reason/badges/warning/capabilities/stability`
  - `StoryboardModelConfigState` includes `audioProvider/audioModel/audioVoice/audioLanguage`

### Domain/shared contracts
- `packages/domain/src/shared/marketing/storyboard-types.ts`
  - `StoryboardModelConfig` fields for text/image/audio provider+model+voice+language
- `packages/domain/src/shared/marketing/validation.ts`
  - `StoryboardModelConfigSchema`
  - `StoryboardAudioProviderSchema` enum includes all three providers

### Model card catalog
- `packages/domain/src/shared/ai-models/narration-model-cards.ts`
  - canonical catalog used for narration option metadata and statuses

## Where narration config is applied in actual asset generation
- `packages/domain/src/application/marketing/story-service.ts`
  - `StoryboardService.generateAssetUrl(..., assetType, modelConfig)`
  - for `narrationAudio` asset type:
    - `narration.synthesize(frame.narration, modelConfig.audioVoice, modelConfig.audioLanguage, { provider: modelConfig.audioProvider, model: modelConfig.audioModel })`

This is the key point where selected UI provider/model/voice/language influence generation.

## OpenSpec relevance
`migrate-ai-storyboard-maker` spec/tasks broadly align with current implementation:
- migration to shared UI + clean architecture completed
- storyboard asset generation includes narration provider + voice settings
- tests mention no live providers in automated runs

OpenSpec does not appear to define a concrete VibeVoice runtime adapter requirement; current implementation exposes VibeVoice as metadata/selection but keeps runtime unconfigured.

## Likely change points (if enabling/adjusting narration provider behavior)
1. UI/provider presentation and local-model UX
- `packages/ui/src/lib/storyboard/StoryboardModelConfig.svelte`
- `packages/ui/src/lib/storyboard/StoryboardModelConfig.svelte.ts`

2. Client orchestration and narration option synchronization
- `apps/desktop-app/src/routes/experiments/storyboard/storyboard-page.svelte.ts`

3. API transport surface
- `apps/desktop-app/src/lib/adapters/storyboard/web-storyboard-transport.ts`
- `apps/desktop-app/src/routes/api/marketing/narration/**/+server.ts`

4. Provider capability/routing and download policy
- `apps/desktop-app/src/lib/server/marketing-service.ts`
  - `createNarrationAudioGateway`
  - `CompositeNarrationAudioGateway.{getOptions,getModelStatus,downloadModel}`

5. Provider/model catalog metadata
- `packages/domain/src/shared/ai-models/narration-model-cards.ts`

6. Concrete gateway implementation
- `apps/desktop-app/src/lib/server/marketing/gateways/HuggingFaceTransformersNarrationGateway.ts`
- (new future adapter likely needed for real VibeVoice runtime)

## Validation commands
From repo root:
- `bunx @fission-ai/openspec@latest validate migrate-ai-storyboard-maker --type change --no-interactive`
- `bun run check:desktop-app`

Targeted storyboard/narration tests:
- `cd apps/desktop-app && bun run test:unit`
- `cd apps/desktop-app && bun test src/lib/server/marketing-service.test.ts`
- `cd apps/desktop-app && bun test src/lib/server/marketing/gateways/HuggingFaceTransformersNarrationGateway.test.ts`
- `cd apps/desktop-app && bun test src/routes/experiments/storyboard/storyboard-page.test.ts`
- `cd apps/desktop-app && bun test src/lib/adapters/storyboard/web-storyboard-transport.test.ts`

Domain/shared validation/tests:
- `cd packages/domain && bun test`
- `cd packages/domain && bun test src/shared/ai-models/narration-model-cards.test.ts`

Optional manual diagnostic (non-production path):
- `cd apps/desktop-app && bun run scripts/vibevoice-onnx-feasibility.mjs`
