# Title

Phase 1 Native Tool Support Plan With Effective Agent Resolution

## Goal

Implement Phase 1 native tool support through the AI SDK runtime for provider-hosted tools only. Sprint 001 should let an effective resolved agent expose supported hosted tools per model card, shape provider options safely, stream normalized tool activity into the transcript, and persist the result without introducing local shell, editor, computer-use, or approval-driven execution loops.

## Scope

- Add per-agent `toolsEnabled` behavior for hosted native tools.
- Gate tool availability through effective model-card capabilities and tool policy.
- Normalize hosted tool activity into the shared event stream and transcript.
- Allow model cards to shape the final hosted tool set and provider options for a run.
- Persist hosted tool run history and expose it cleanly to the UI.
- Clarify inheritance behavior for hosted tool configuration on linked user agents.

Out of scope for this phase:

- Anthropic `bash`, `text_editor`, `computer`, or `memory`.
- OpenAI `shell`, `local_shell`, `apply_patch`, provider-native `mcp`, or `toolSearch`.
- Sandbox, container, approval, or computer-use execution loops.
- A user-defined tool marketplace.
- Arbitrary plugin or MCP execution inside the chat loop.

Future Phase 2:

- Expand to all provider-native tools that require host callbacks, approvals, local execution, or persistent tool sessions.

## Phase 1 Provider Matrix

Phase 1 is intentionally limited to provider-hosted tools. The effective model card stays authoritative for whether any specific tool is exposed.

- Google Gemini hosted tools:
  - `google_search`
  - `file_search`
  - `url_context`
  - `google_maps`
  - `code_execution`
- Anthropic hosted tools:
  - `web_search`
  - `web_fetch`
  - `code_execution`
- OpenAI hosted tools:
  - `web_search`
  - `file_search`
  - `image_generation`
  - `code_interpreter`

Planning notes against the current catalog in `packages/domain/src/shared/chat/model-cards.ts`:

- `gemini25` is the strongest initial Phase 1 target because the current catalog already includes Gemini 2.5 cards and those models align well with hosted grounding and code-execution tools.
- Anthropic cards should support hosted web/code tools in policy planning, while explicitly deferring `bash`, `text_editor`, `computer`, and `memory` to Phase 2.
- OpenAI cards must not assume the full Responses API hosted tool surface is available uniformly across all current OpenAI cards. The model card must explicitly list the hosted tools that are allowed for a given model/runtime combination.

## Architecture

- `packages/domain/src/shared/chat`
  - Own browser-safe hosted-tool capability metadata, `ModelToolPolicy`, transcript-safe tool event shapes, and UI-facing summaries.
  - Stay browser-safe and free of AI SDK tool definitions.
- `packages/domain/src/application/chat`
  - Resolve hosted tool availability from the effective `ResolvedAgentProfile`, not directly from raw system JSON or raw DB rows.
  - Decide which hosted tools are available for a run from:
    - effective `ModelCard.capabilities.tools`
    - effective model-card hosted-tool metadata
    - effective agent `toolsEnabled`
    - model-card hook output
  - Orchestrate hosted tool runs and transcript event persistence.
- `packages/domain/src/infrastructure/ai`
  - Hold provider-specific AI SDK hosted tool registrations and model-card-driven tool shaping.
  - Translate provider metadata, citations, grounding details, and hosted tool execution into normalized transcript events.
- `packages/domain/src/infrastructure/database/chat`
  - Persist run events and any hosted-tool-related message metadata.
- `packages/ui`
  - Render tool activity rows, tool badges, citations, and hosted-tool availability indicators.
- `apps/desktop-app`
  - Compose the UI and transport only.
  - Must not decide tool policy locally in the route layer.

## Implementation Plan

1. Extend shared capability metadata for Phase 1.
   - Keep effective `ModelCard.capabilities.tools` as the coarse gate.
   - Add richer browser-safe hosted-tool metadata alongside it, such as:
     - `nativeToolSupportLevel`
     - `nativeTools`
     - `nativeToolFamilies`
   - Keep the model card authoritative for which hosted tools are allowed.
2. Extend agent configuration.
   - Keep `toolsEnabled` as a first-class effective agent field.
   - Treat it as an on/off gate for hosted native tools in Phase 1.
   - Show per-agent hosted-tool state in the agent editor and thread participant context.
3. Refine `ModelToolPolicy` for hosted tools.
   - Include:
     - default enabled hosted tools
     - optional hosted tools to add for a specific model
     - hosted tools to strip for a specific model
     - `providerOptions` to inject when hosted tools are enabled
     - optional hook outputs that further reshape the hosted tool set per request
4. Define inheritance behavior for tool state.
   - System default tool configuration lives in backend JSON definitions.
   - Duplicated agents snapshot the hosted-tool state at duplication time.
   - Inherited agents can override hosted-tool state where allowed.
   - Unresolved tool fields continue to inherit from the system agent definition.
5. Define normalized hosted tool events in shared/application contracts.
   - `tool-call-started`
   - `tool-call-output`
   - `tool-call-finished`
   - `tool-call-failed`
   - Include:
     - `runId`
     - `messageId`
     - `toolName`
     - `provider`
     - concise transcript-safe summaries
     - optional source and citation summaries
     - optional structured payload references when needed for replay
6. Update handler contracts for hosted AI SDK tool execution.
   - Accept a tool-policy input derived from the effective resolved agent.
   - Use provider-native AI SDK tool registrations as the runtime surface for Phase 1.
   - Keep provider-specific tool registration inside infrastructure, not in use cases or UI.
7. Implement effective-agent-controlled hosted tool shaping.
   - Allow effective model cards and resolved agent overrides to:
     - enable or disable hosted tools
     - add extra hosted tools for a model
     - strip unsupported hosted tools
     - inject provider-specific `providerOptions`
     - react to input-policy hooks when hosted tools are needed for fallback handling
8. Normalize provider metadata for transcript and storage.
   - Google:
     - map `sources`
     - map `groundingMetadata`
     - map URL-context metadata when present
   - Anthropic:
     - map hosted search/fetch/code tool summaries
     - keep provider-specific error details out of browser-safe types
   - OpenAI:
     - map hosted search/file/image/code tool summaries
     - map citations or generated-file references into transcript-safe summaries
9. Plan transcript persistence in detail.
   - Store hosted tool lifecycle events as part of `chat_run` history.
   - Keep ordering stable so replayed stream history matches the original UI sequence.
   - Separate transcript-safe summaries from raw provider details to avoid leaking low-level payloads into browser-safe types.
10. Plan UI rendering in detail.
   - Render compact inline rows between assistant message blocks.
   - Distinguish started, output, completed, and failed states.
   - Show sources and citations when a hosted tool returns them.
   - Show effective hosted tool availability in agent and model UI for both system and user agents.
   - Keep raw provider payloads hidden unless a later sprint explicitly asks for inspection UI.
11. Keep Sprint 001 intentionally narrow.
   - Support provider-hosted native tools only.
   - Do not introduce sandbox or computer-use loops.
   - Do not expose a full per-tool management UI beyond what the effective model card and agent toggle require.
   - Explicitly defer host-executed native tools to Phase 2.

## Tests

- Shared and application tests should use `bun:test`.
- Policy and orchestration tests in the application layer should cover:
  - effective agent `toolsEnabled` toggling
  - unsupported hosted tool capability
  - hosted tool add/remove policy evaluation
  - injected `providerOptions`
  - interaction between hosted tool policy and model-card hook output
  - inherited agent hosted-tool overrides vs unresolved inherited defaults
  - duplicated agent snapshot behavior
- AI SDK infrastructure tests should verify:
  - provider-native hosted tool registration
  - effective-agent-driven hosted tool shaping
  - normalized tool-event translation
  - provider option application at the infrastructure edge
  - provider metadata normalization for citations, sources, and generated artifacts
- Repository tests for persisted tool activity should use a real in-memory SurrealDB instance, matching the pattern in [SurrealTodoRepository.test.ts](/Users/walker/Documents/Dev/AI Maker Lab/ai-maker-lab/packages/domain/src/infrastructure/database/SurrealTodoRepository.test.ts).
  - Cover:
    - hosted tool event persistence
    - event ordering
    - reload behavior
    - any associated run-message linkage
- UI tests should verify:
  - hosted tool rows render correctly
  - citations and source summaries render correctly when available
  - unsupported hosted tool states are hidden or disabled from effective `ModelCard.uiPresentation`
  - transcript rendering remains stable around interleaved text and hosted tool events
  - tool badges and toggles render the same way for system and user agents once resolved

## Acceptance Criteria

- Phase 1 tool support is controlled by the combination of effective `ModelCard.capabilities.tools`, effective hosted-tool metadata, effective agent `toolsEnabled`, and model-card hook output.
- The docs clearly place hosted tool policy in shared/application layers and provider-native AI SDK tool wiring in infrastructure.
- Tool availability is explicitly resolved from the merged effective agent, not directly from raw system JSON or raw DB rows.
- Inherited agents can override hosted tool state where allowed, while unresolved values continue to inherit from the system agent.
- Hosted tool event persistence is planned to be verified with a real SurrealDB instance, not only mocks.
- Host-executed native tools are explicitly deferred and do not leak into Sprint 001 scope.

## Dependencies

- `01-model-card-handler.md` provides `ResolvedAgentProfile`, `ModelCard`, `ModelToolPolicy`, and handler-hook contracts.
- `02-backend-apis-services.md` provides agent-catalog merge behavior plus AI SDK-backed run persistence and event storage.
- `03-chat-ui.md` provides transcript components and agent editor affordances.
- `04-ui-backend-integration.md` provides stream delivery from backend to page model.
- Tool planning should align with [AI SDK Overview](https://ai-sdk.dev/docs), [Google Generative AI provider docs](https://ai-sdk.dev/v5/providers/ai-sdk-providers/google-generative-ai), [Anthropic provider docs](https://v5.ai-sdk.dev/providers/ai-sdk-providers/anthropic), and [OpenAI provider docs](https://ai-sdk.dev/providers/ai-sdk-providers/openai.md).

## Phase 2 Roadmap

Phase 2 should expand the same model-card-driven policy system to all native tools that require host execution or approvals, including:

- Anthropic `bash`, `text_editor`, `computer`, and `memory`
- OpenAI `shell`, `local_shell`, `apply_patch`, provider-native `mcp`, and `toolSearch`
- any future provider-native tools that require local execution callbacks, sandboxing, approval prompts, or persistent execution state

Phase 2 prerequisites:

- a clear approval model for risky tool calls
- sandbox or container abstractions in infrastructure
- richer session state for long-lived tool environments
- more detailed tool-request and tool-result event schemas
- UI affordances for approval, inspection, retry, and interruption

## Risks / Notes

- Tool semantics vary across providers and models, so the effective model-card policy layer must stay authoritative.
- Hosted tools and host-executed tools have different safety, metadata, and UX needs; keeping them in separate phases reduces churn.
- Overly detailed tool payload rendering will clutter the transcript quickly; concise summaries are the right Sprint 001 default.
- Provider-specific options may still be necessary, but they should be injected via `providerOptions`, not hardcoded in view or transport code.
- OpenAI hosted native tools must be guarded carefully because support may depend on API surface and exact model selection, not just provider family.
- Keep the v1 contract small enough that file handling and core streaming are not blocked by tool-specific complexity.
