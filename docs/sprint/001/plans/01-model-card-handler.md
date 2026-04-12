# Title

Model Card And Configurable AI SDK Handler Plan

## Goal

Define the Vercel AI SDK-based provider/model management layer for Sprint 001 so GPT, Claude, and Gemini are executed through one configurable `ModelHandler`, while `ModelCard` remains the single source of truth for model-specific behavior, capability gating, fallback policy, tool exposure, and UI presentation.

## Scope

- Standardize on `Vercel AI SDK Core + AI SDK UI` for the chat runtime.
- Use direct provider packages:
  - `ai`
  - `@ai-sdk/svelte`
  - `@ai-sdk/openai`
  - `@ai-sdk/anthropic`
  - `@ai-sdk/google`
- Create browser-safe shared chat metadata under `packages/domain/src/shared/chat`.
- Define the application-layer model runtime contract under `packages/domain/src/application/chat`.
- Define configurable model-card-driven hooks for attachment handling, tool shaping, provider options, and UI presentation.
- Seed the initial role-based agent catalog for sprint 001.

Out of scope for this step:

- SurrealDB persistence details for threads and messages.
- Final route wiring and transport integration.
- A full media-transcoding pipeline beyond the hook seam and default fallback rules.

## Architecture

- `packages/domain/src/shared/chat`
  - Own `ModelCard`, `ModelUiPresentation`, `ModelCapabilityMatrix`, `ModelInputPolicy`, `ModelToolPolicy`, `AgentProfile`, `AgentRole`, and model snapshot types.
  - Stay browser-safe so the UI can render capability badges and disabled affordances directly from shared metadata.
- `packages/domain/src/application/chat`
  - Own `ModelCatalog`, `ModelHandler`, `ModelHandlerConfig`, and `ModelHookContext`.
  - Define the normalized request/response/event contracts consumed by chat use cases.
- `packages/domain/src/infrastructure`
  - Own the AI SDK provider registry and wrapped language-model instances.
  - Use `createProviderRegistry`, `customProvider`, `wrapLanguageModel`, `providerOptions`, `streamText`, and `generateText` as the primary execution seams.
- `apps/desktop-app`
  - Consume only shared metadata and application contracts.
  - Never branch on provider-specific SDK details in page models or components.

## Implementation Plan

1. Create the new shared chat surface in `packages/domain/src/shared/chat`.
   - Add `README.md` describing boundaries and browser-safe import rules.
   - Add `index.ts` exports for chat models and capability helpers.
2. Define shared provider and model metadata for AI SDK resolution.
   - Add `ModelProvider` enum values for `openai`, `anthropic`, and `google`.
   - Add stable `modelId` values for the initial supported GPT, Claude, and Gemini models.
   - Add `registryId` so each card resolves cleanly through the AI SDK provider registry.
3. Define `ModelCapabilityMatrix`.
   - Include capability flags for:
     - `text`
     - `image`
     - `file`
     - `pdf`
     - `video`
     - `streaming`
     - `tools`
     - `replyThreads`
   - Keep capabilities explicit so the UI and runtime can make the same decision from the same metadata.
4. Define `ModelUiPresentation`.
   - Include UI-facing fields for:
     - badges
     - warnings
     - disabled composer controls
     - fallback hints
     - hidden or conditionally shown tool toggles
   - Use this type so model-specific UI behavior is declared in data instead of scattered through Svelte components.
5. Define `ModelInputPolicy`.
   - Support policy outcomes:
     - `pass-through`
     - `transform`
     - `augment-with-tools`
     - `reject`
   - Allow per-modality behavior for text, image, pdf, file, and video.
6. Define `ModelToolPolicy`.
   - Include:
     - default enabled tool set
     - removable tools
     - model-specific tool additions
     - provider option presets needed for a given tool configuration
7. Define `ModelCard`.
   - Include:
     - `provider`
     - `modelId`
     - `registryId`
     - `label`
     - `description`
     - `capabilities`
     - `uiPresentation`
     - `inputPolicy`
     - `toolPolicy`
     - `providerOptionsPreset`
   - Make `ModelCard` the authoritative control plane for runtime and UI behavior.
8. Define agent metadata in shared types.
   - Add `AgentRole` values for `builder`, `reviewer`, and `researcher`.
   - Add `AgentProfile` fields for:
     - `id`
     - `name`
     - `role`
     - `description`
     - `instructions`
     - `provider`
     - `modelId`
     - `toolsEnabled`
     - `isBuiltIn`
     - `createdAt`
     - `updatedAt`
   - Include a model snapshot shape that is stored on each assistant run.
9. Define `ModelHandler` in `packages/domain/src/application/chat`.
   - Back it with AI SDK model resolution and execution.
   - Add configuration hooks:
     - `beforeNormalizeInput`
     - `beforeBuildMessages`
     - `beforeResolveTools`
     - `beforeModelCall`
     - `afterStreamPart`
     - `afterCompletion`
   - Use `ModelHookContext` to pass the active agent, model card, thread context, attachments, and requested tool state through the hook chain.
10. Define handler execution rules.
   - Resolve the active `ModelCard`.
   - Resolve the wrapped model from the AI SDK provider registry.
   - Apply model-card-driven hooks in a fixed order.
   - Call `streamText` or `generateText`.
   - Normalize stream parts and usage into application events.
11. Make the unsupported-capability fallback rule explicit.
   - If the model supports the input directly, pass it through.
   - If the model does not support it, run the configured fallback hook from `ModelCard.inputPolicy`.
   - If no fallback hook is configured, block the send and surface a clear UI message.
12. Make the video example explicit.
   - GPT and Claude model cards can declare `video: unsupported`.
   - A configured fallback hook may:
     - transform video into images
     - extract text
     - add tools that preprocess the input
   - If no fallback hook exists, the UI blocks video send for that model.
13. Build the AI SDK provider registry plan.
   - Register OpenAI, Anthropic, and Google providers with direct provider packages.
   - Use `customProvider` and `wrapLanguageModel` as the main extension seams for behavior injection.
   - Use `providerOptions` as the per-request and per-model override channel.
14. Seed default role-based agents.
   - Builder defaults to GPT.
   - Reviewer defaults to Claude.
   - Researcher defaults to Gemini.
   - Keep the seed list editable later through duplication and custom creation.

## Tests

- Shared helper tests for model-card lookup by `registryId`, `provider`, and `modelId`.
- Capability tests for tools, image, file, pdf, and video support.
- Hook-order tests to verify `ModelHandler` applies hooks in the expected order.
- Fallback tests for:
  - unsupported video with no fallback hook
  - unsupported video with a transform hook
  - unsupported video with tool augmentation
- Registry tests to confirm wrapped models preserve aliases, defaults, and `providerOptionsPreset`.
- Seed tests to verify the role-based default agents map to the expected model cards.
- Duplication tests to verify copied agents preserve provider, model, instructions, and tool state.

## Acceptance Criteria

- Sprint 001 docs clearly specify `Vercel AI SDK Core + AI SDK UI` as the model runtime foundation.
- `ModelCard` is the single source of truth for capability gating, fallback behavior, tool policy, and UI presentation.
- `ModelHandler` is clearly documented as AI SDK-based and configurable through hooks instead of provider-specific conditionals.
- Provider-specific SDK types do not leak into shared or application-layer contracts.
- Unsupported input behavior is explicit, deterministic, and model-card-driven.

## Dependencies

- Planned package adoption:
  - `ai`
  - `@ai-sdk/svelte`
  - `@ai-sdk/openai`
  - `@ai-sdk/anthropic`
  - `@ai-sdk/google`
- Environment variables for provider keys:
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `GEMINI_API_KEY`
- New shared chat exports from `packages/domain/src/shared/index.ts`.
- New application chat exports from `packages/domain/src/application/index.ts`.
- Reference docs the implementation should align with:
  - [AI SDK Overview](https://ai-sdk.dev/docs)
  - [AI SDK UI Overview](https://ai-sdk.dev/docs/ai-sdk-ui/overview)
  - [Provider & Model Management](https://ai-sdk.dev/docs/ai-sdk-core/provider-management)
  - [`streamText`](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
  - [`customProvider`](https://ai-sdk.dev/docs/reference/ai-sdk-core/custom-provider)

## Risks / Notes

- Model capabilities and provider options can change over time, so model cards must stay centralized and easy to update.
- The hook system should stay configurable without turning into an unbounded plugin framework during sprint 001.
- Video fallback behavior is intentionally a policy seam, not a fully solved media pipeline in this sprint.
- This step must be completed before backend services because routing, file handling, tool policy, and UI presentation all depend on stable model-card and handler contracts.
