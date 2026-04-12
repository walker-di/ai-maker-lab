# Title

Native Tool Support Plan With Effective Agent Resolution

## Goal

Support tools through the Vercel AI SDK runtime while keeping Sprint 001 intentionally limited to provider-native and app-defined AI SDK tools, all controlled through model cards, effective resolved agents, and handler hooks, with clear clean-architecture boundaries and test expectations.

## Scope

- Add per-agent tools toggle behavior.
- Gate tool availability through model capabilities and model-card tool policies.
- Normalize tool activity into the shared event stream and transcript.
- Allow model cards to shape the final tool set and provider options for a run.
- Persist tool-related run history and expose it cleanly to the UI.
- Clarify inheritance behavior for tool configuration on linked user agents.

Out of scope for this step:

- Sandbox, computer-use, bash, or editor execution loops.
- A user-defined tool marketplace.
- Arbitrary plugin or MCP execution inside the chat loop.

## Architecture

- `packages/domain/src/shared/chat`
  - Own `ModelToolPolicy`, transcript-safe tool event shapes, tool-capability flags, and UI-facing summaries.
  - Stay browser-safe and free of AI SDK tool definitions.
- `packages/domain/src/application/chat`
  - Resolve tool availability from the effective `ResolvedAgentProfile`, not directly from raw system JSON or raw DB rows.
  - Decide which tools are available for a run from:
    - effective `ModelCard.capabilities.tools`
    - effective agent `toolsEnabled`
    - model-card hook output
  - Orchestrate tool-enabled runs and transcript event persistence.
- `packages/domain/src/infrastructure/ai`
  - Hold AI SDK `tool()` definitions and model-card-driven tool shaping.
  - Translate AI SDK tool execution into normalized transcript events.
- `packages/domain/src/infrastructure/database/chat`
  - Persist run events and any tool-related message metadata.
- `packages/ui`
  - Render tool activity rows, tool badges, and tool-availability indicators.
- `apps/desktop-app`
  - Compose the UI and transport only.
  - Must not decide tool policy locally in the route layer.

## Implementation Plan

1. Extend shared capability metadata.
   - Make effective `ModelCard.capabilities.tools` authoritative for sprint 001.
   - Add UI-safe `toolFamilies`, `toolBadges`, or similar presentation metadata if needed.
2. Extend agent configuration.
   - Keep `toolsEnabled` as a first-class effective agent field.
   - Show per-agent tool state in the agent editor and thread participant context.
3. Define `ModelToolPolicy`.
   - Include:
     - default enabled tools
     - optional tools to add for a specific model
     - tools to strip for a specific model
     - `providerOptions` to inject when tools are enabled
     - optional hook outputs that further reshape the tool set per request
4. Define inheritance behavior for tool state.
   - System default tool configuration lives in backend JSON definitions.
   - Duplicated agents snapshot the tool state at duplication time.
   - Inherited agents can override tool state where allowed.
   - Unresolved tool fields continue to inherit from the system agent definition.
5. Define normalized tool events in shared/application contracts.
   - `tool-call-started`
   - `tool-call-output`
   - `tool-call-finished`
   - `tool-call-failed`
   - Include:
     - `runId`
     - `messageId`
     - `toolName`
     - concise transcript-safe summaries
     - optional structured payload references when needed for replay
6. Update handler contracts for AI SDK tool execution.
   - Accept a tool-policy input derived from the effective resolved agent.
   - Use AI SDK `tool()` definitions as the runtime surface.
   - Keep provider-specific tool registration inside infrastructure, not in use cases or UI.
7. Implement effective-agent-controlled tool shaping.
   - Allow effective model cards and resolved agent overrides to:
     - enable or disable tools
     - add extra tools for a model
     - strip unsupported tools
     - inject provider-specific `providerOptions`
     - react to input-policy hooks when tools are needed for fallback handling
8. Plan transcript persistence in detail.
   - Store tool lifecycle events as part of `chat_run` history.
   - Keep ordering stable so replayed stream history matches the original UI sequence.
   - Separate transcript-safe summaries from raw provider details to avoid leaking low-level payloads into browser-safe types.
9. Plan UI rendering in detail.
   - Render compact inline rows between assistant message blocks.
   - Distinguish started, output, completed, and failed states.
   - Show effective tool availability in agent and model UI for both system and user agents.
   - Keep raw tool payloads hidden unless a later sprint explicitly asks for inspection UI.
10. Keep sprint 001 intentionally narrow.
   - Support provider-native and app-defined AI SDK tools only.
   - Do not introduce sandbox or computer-use loops.
   - Do not expose a full per-tool management UI beyond what the effective model card and agent toggle require.

## Tests

- Shared and application tests should use `bun:test`.
- Policy and orchestration tests in the application layer should use in-memory fakes.
  - Cover:
    - effective agent `toolsEnabled` toggling
    - unsupported model capability
    - tool add/remove policy evaluation
    - injected `providerOptions`
    - interaction between tool policy and model-card hook output
    - inherited agent tool overrides vs unresolved inherited defaults
    - duplicated agent snapshot behavior
- AI SDK infrastructure tests should verify:
  - `tool()` definition registration
  - effective-agent-driven tool shaping
  - normalized tool-event translation
  - provider option application at the infrastructure edge
- Repository tests for persisted tool activity should use a real in-memory SurrealDB instance, matching the pattern in [SurrealTodoRepository.test.ts](/Users/walker/Documents/Dev/AI Maker Lab/ai-maker-lab/packages/domain/src/infrastructure/database/SurrealTodoRepository.test.ts).
  - Cover:
    - tool event persistence
    - event ordering
    - reload behavior
    - any associated run-message linkage
- UI tests should verify:
  - tool rows render correctly
  - unsupported tool states are hidden or disabled from effective `ModelCard.uiPresentation`
  - transcript rendering remains stable around interleaved text and tool events
  - tool badges and toggles render the same way for system and user agents once resolved

## Acceptance Criteria

- Tool support is controlled by the combination of effective `ModelCard.capabilities.tools`, effective agent `toolsEnabled`, and model-card hook output.
- The docs clearly place tool policy in shared/application layers and AI SDK `tool()` wiring in infrastructure.
- Tool availability is explicitly resolved from the merged effective agent, not directly from raw system JSON or raw DB rows.
- Inherited agents can override tool state where allowed, while unresolved values continue to inherit from the system agent.
- Tool-event persistence is planned to be verified with a real SurrealDB instance, not only mocks.

## Dependencies

- `01-model-card-handler.md` provides `ResolvedAgentProfile`, `ModelCard`, `ModelToolPolicy`, and handler-hook contracts.
- `02-backend-apis-services.md` provides agent-catalog merge behavior plus AI SDK-backed run persistence and event storage.
- `03-chat-ui.md` provides transcript components and agent editor affordances.
- `04-ui-backend-integration.md` provides stream delivery from backend to page model.
- Tool planning should align with [AI SDK Overview](https://ai-sdk.dev/docs) and the package-level `tool()` runtime surface.

## Risks / Notes

- Tool semantics vary across providers and models, so the effective model-card policy layer must stay authoritative.
- Overly detailed tool payload rendering will clutter the transcript quickly; concise summaries are the right sprint 001 default.
- Provider-specific options may still be necessary, but they should be injected via `providerOptions`, not hardcoded in view or transport code.
- Keep the v1 contract small enough that file handling and core streaming are not blocked by tool-specific complexity.
