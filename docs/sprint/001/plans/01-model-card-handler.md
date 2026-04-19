# Title

Model Card, Agent Definitions, And Configurable AI SDK Handler Plan

## Goal

Define the Vercel AI SDK-based provider/model management layer for Sprint 001 so GPT, Claude, and Gemini are executed through one configurable `ModelHandler`, while `ModelCard` remains the single source of truth for model-specific behavior, capability gating, fallback policy, tool exposure, and UI presentation. The runtime must consume a resolved agent shape that can come from either backend-owned system JSON or DB-backed user agents.

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
- Replace the old “seeded default agent” concept with a merged agent catalog composed of:
  - backend raw JSON system agent definitions
  - DB-backed user agents
  - resolved controller-facing agent shapes with embedded `modelCard`

Out of scope for this step:

- SurrealDB repository details for agent persistence.
- Final route wiring and transport integration.
- A full media-transcoding pipeline beyond the hook seam and default fallback rules.

## Architecture

- `packages/domain/src/shared/chat`
  - Own `ModelCard`, `ModelUiPresentation`, `ModelCapabilityMatrix`, `ModelInputPolicy`, `ModelToolPolicy`, `AgentSource`, `SystemAgentDefinition`, `StoredUserAgent`, `ResolvedAgentProfile`, and model snapshot types.
  - Stay browser-safe so the UI can render capability badges and disabled affordances directly from shared metadata.
- `packages/domain/src/application/chat`
  - Own `ModelCatalog`, `ModelHandler`, `ModelHandlerConfig`, `ModelHookContext`, and the contract that runtime code consumes resolved agents only.
  - Define the normalized request/response/event contracts consumed by chat use cases.
- `packages/domain/src/infrastructure`
  - Own the AI SDK provider registry and wrapped language-model instances.
  - Own backend JSON loading for system agent definitions.
  - Use `createProviderRegistry`, `customProvider`, `wrapLanguageModel`, `providerOptions`, `streamText`, and `generateText` as the primary execution seams.
- `apps/desktop-app`
  - Consume only shared metadata and application contracts.
  - Never branch on provider-specific SDK details or raw system-agent JSON in page models or components.

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
4. Define `ModelUiPresentation`.
   - Include UI-facing fields for:
     - badges
     - warnings
     - disabled composer controls
     - fallback hints
     - hidden or conditionally shown tool toggles
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
8. Replace the old simple agent shape with three explicit shapes.
   - `SystemAgentDefinition`
     - backend-only raw JSON shape
     - includes:
       - `id`
       - `name`
       - `description`
       - full embedded `modelCard`
       - `systemPrompt`
       - default tool state
       - any system-owned metadata
   - `StoredUserAgent`
     - DB persistence shape
     - includes:
       - `id`
       - `source: 'user'`
       - `inheritsFromSystemAgentId?`
       - `modelCardId`
       - user overrides
       - `systemPrompt`
       - tool overrides
       - timestamps
   - `ResolvedAgentProfile`
     - unified controller/API shape
     - always includes full embedded `modelCard`
     - includes:
       - `source: 'system' | 'user'`
       - `systemAgentId?`
       - `inheritsFromSystemAgentId?`
       - `isInherited`
       - `isDuplicatedFromSystem?`
       - `isEditable`
9. Keep `systemPrompt` first-class.
   - Do not bury agent prompt behavior inside `ModelCard`.
   - System and resolved agents must expose `systemPrompt` explicitly.
10. Define runtime behavior around resolved agents only.
   - `ModelHandler` must consume `ResolvedAgentProfile`, not raw system JSON or raw DB rows.
   - Model resolution and inheritance merging happen before runtime execution begins.
11. Define `ModelHandler` in `packages/domain/src/application/chat`.
   - Back it with AI SDK model resolution and execution.
   - Add configuration hooks:
     - `beforeNormalizeInput`
     - `beforeBuildMessages`
     - `beforeResolveTools`
     - `beforeModelCall`
     - `afterStreamPart`
     - `afterCompletion`
   - Use `ModelHookContext` to pass the active resolved agent, model card, thread context, attachments, and requested tool state through the hook chain.
12. Define handler execution rules.
   - Resolve the effective `ResolvedAgentProfile`.
   - Resolve the embedded `ModelCard`.
   - Resolve the wrapped model from the AI SDK provider registry.
   - Apply model-card-driven hooks in a fixed order.
   - Call `streamText` or `generateText`.
   - Normalize stream parts and usage into application events.
13. Make the unsupported-capability fallback rule explicit.
   - If the model supports the input directly, pass it through.
   - If the model does not support it, run the configured fallback hook from `ModelCard.inputPolicy`.
   - If no fallback hook is configured, block the send and surface a clear UI message.
14. Make the video example explicit.
   - GPT and Claude model cards can declare `video: unsupported`.
   - A configured fallback hook may:
     - transform video into images
     - extract text
     - add tools that preprocess the input
   - If no fallback hook exists, the UI blocks video send for that model.
15. Build the AI SDK provider registry plan.
   - Register OpenAI, Anthropic, and Google providers with direct provider packages.
   - Use `customProvider` and `wrapLanguageModel` as the main extension seams for behavior injection.
   - Use `providerOptions` as the per-request and per-model override channel.
16. Replace “seeded default agents” with backend system definitions.
   - System defaults live in backend raw JSON.
   - Backend JSON can embed internal constants like `Gemini3FamilyModelCard`.
   - Controller responses must serialize those defaults into the same shape returned for user agents.

## Tests

- Shared helper tests for model-card lookup by `registryId`, `provider`, and `modelId`.
- Capability tests for tools, image, file, pdf, and video support.
- Hook-order tests to verify `ModelHandler` applies hooks in the expected order.
- Fallback tests for:
  - unsupported video with no fallback hook
  - unsupported video with a transform hook
  - unsupported video with tool augmentation
- Registry tests to confirm wrapped models preserve aliases, defaults, and `providerOptionsPreset`.
- Agent-shape tests for:
  - `SystemAgentDefinition` serialization
  - `StoredUserAgent` to `ResolvedAgentProfile` model-card population
  - resolved `systemPrompt` behavior
  - inheritance metadata presence
- Duplication and inheritance tests to verify:
  - duplicate becomes an independent resolved user agent
  - inherited agents preserve linkage metadata and unresolved fields flow from the system definition

## Acceptance Criteria

- Sprint 001 docs clearly specify `Vercel AI SDK Core + AI SDK UI` as the model runtime foundation.
- `ModelCard` is the single source of truth for capability gating, fallback behavior, tool policy, and UI presentation.
- The docs define `SystemAgentDefinition`, `StoredUserAgent`, `ResolvedAgentProfile`, and `AgentSource`.
- `ModelHandler` is clearly documented as AI SDK-based and configurable through hooks instead of provider-specific conditionals.
- Runtime code is documented to consume resolved agents only, after model resolution and inheritance merging.

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
- System agent JSON is a backend concern. The frontend should never depend on its storage format directly.
