# Title

Chat UI Plan With Merged Agent Catalog And Shared UI Package

## Goal

Design and implement a polished Shadcn-style multi-agent chat experience that uses AI SDK UI in Svelte for streaming chat behavior while preserving the repo’s clean-architecture frontend boundaries: reusable UI in `packages/ui`, app-specific composition in `apps/desktop-app`, and interaction logic in `.svelte.ts` page and component models. The UI must consume one merged agent list from the backend rather than separate default and user-agent sources.

## Scope

- Build the main chat route UI in `apps/desktop-app/src/routes/experiments/chat`.
- Add reusable chat and agent-list components to `packages/ui`.
- Import shared UI into the app from `ui/source`.
- Use AI SDK UI primitives in Svelte for chat-state and streaming integration.
- Keep view behavior in `.svelte.ts` models and keep `.svelte` files visual-only.
- Support thread switching, reply state, agent visibility, model-specific presentation, and streaming message states.
- Render a single merged agent catalog with source and inheritance states.

Out of scope for this step:

- Final backend transport implementation details.
- Provider-specific request logic in the UI layer.
- Deep media transformation beyond capability state, warnings, and fallback notices.

## Architecture

- `packages/ui/src/lib`
  - Own reusable chat primitives, agent list items, agent cards, badges, and wrappers around shared shadcn components.
  - Own the public chat component surface that the desktop app imports from `ui/source`.
  - Should contain visual components, style tokens, and lightweight UI-only models when reuse is required across screens.
- `apps/desktop-app/src/routes/experiments/chat`
  - Own route-level composition, page bootstrap, and app-specific wiring.
  - Should not recreate shared chat or agent-list components locally when they belong in `packages/ui`.
- `@ai-sdk/svelte`
  - Provide frontend chat-state and streaming primitives consumed by the route model.
- `.svelte` files
  - Render layout, accessibility, bindings, snippets, and visual composition only.
- `.svelte.ts` files
  - Own thread selection, reply targeting, optimistic state, AI SDK UI integration, and interaction logic.
  - Must not contain transport details, backend merge rules, or raw system-agent JSON handling.

## Implementation Plan

1. Add the new experiment entry point in the desktop app.
   - Add a chat card on `apps/desktop-app/src/routes/+page.svelte`.
   - Create `apps/desktop-app/src/routes/experiments/chat/+page.svelte`.
   - Create `chat-page.svelte.ts` and `chat-page.composition.ts`.
2. Define the primary layout zones in the route.
   - Left sidebar: thread history and “new thread”.
   - Center panel: message timeline, reply context, streamed output.
   - Right panel: merged agent roster, selected agent details, model capabilities, and thread context.
3. Move reusable chat and agent-list UI into `packages/ui`.
   - Add shared components such as:
     - `ChatThreadListItem`
     - `ChatAgentChip`
     - `ChatAgentListItem`
     - `ChatAgentCard`
     - `ChatModelBadge`
     - `ChatMessageBubble`
     - `ChatToolEventRow`
     - `ChatAttachmentPill`
     - `ChatReplyPreview`
     - `ChatComposer`
   - Export them through `packages/ui/src/lib/index.ts`.
   - Import them in the desktop app via `ui/source`.
4. Keep the desktop app thin.
   - Route files compose shared UI and app-local page models.
   - Do not duplicate shadcn components or reusable chat widgets inside `apps/desktop-app`.
   - Keep app-local logic limited to route composition, adapter selection, and view-model wiring.
5. Make AI SDK UI an explicit part of the frontend plan.
   - Use AI SDK UI in Svelte for message streaming and chat-state primitives.
   - Keep the page model responsible for:
     - thread selection
     - agent context
     - reply state
     - optimistic UX
     - orchestration around AI SDK UI state
   - Do not move interaction logic into visual components.
6. Make `ModelCard.uiPresentation` drive model-specific UI.
   - capability badges
   - disabled composer affordances
   - tool toggle visibility
   - media warnings
   - fallback notices for unsupported inputs such as video
7. Change the agent panel/list plan to consume one merged list from the backend.
   - Do not split the frontend into separate “system” and “user” data sources.
   - The page model should consume only `ResolvedAgentProfile` items.
   - The page model should remain unaware of how backend JSON and DB results are merged.
8. Add agent UI states.
   - system default
   - inherited user agent
   - duplicated user agent
   - fully custom user agent
   - Show source and inheritance badges using shared components from `packages/ui`.
9. Add agent actions in the UI.
   - use system agent directly
   - duplicate
   - inherit
   - edit user-owned fields
   - Clarify visually that system agents themselves are not edited in place.
10. Define message rendering states.
   - user message
   - assistant message
   - pending or streaming assistant placeholder
   - tool activity row
   - failed message state
   - unavailable attachment state
11. Build the page model behavior in `.svelte.ts`.
   - active thread selection
   - thread list loading state
   - active reply target
   - composer draft state
   - mention suggestions or validation state
   - selected agent detail state
   - AI SDK UI message state coordination
   - optimistic message insertion
12. Support reply and mention UX.
   - reply banner above composer
   - clear reply action
   - visible mention tokens or agent chips in composed text
   - clear labeling of which effective agent answered each assistant message
13. Support responsive behavior.
   - desktop first for the Electrobun window
   - workable browser layout in `dev:web`
   - narrow-width fallback where the right panel can collapse or stack

## Tests

- Shared UI tests belong in `packages/ui`.
  - Add stories for shared chat and agent-list components with realistic sample data.
  - Add component-level rendering tests for reusable UI where behavior matters.
  - Verify new public components are exported through `src/lib/index.ts`.
- Page-model and route-composition tests belong in `apps/desktop-app`.
  - Test:
    - merged agent list rendering
    - visible source and inheritance badges
    - duplicate and inherit actions
    - editability differences between system and user-owned agents
    - thread switching
    - reply activation and clearing
    - optimistic send state
    - AI SDK UI streaming state integration
    - mention-aware composer state
    - model-card-driven warning and disabled states
- Keep tests aligned with clean architecture.
  - Reusable UI components are tested in `packages/ui`.
  - Route-local composition and adapter wiring are tested in `apps/desktop-app`.
  - Business rules and merge rules stay out of component tests and belong in the domain/application test suites.

## Acceptance Criteria

- The plan clearly places reusable chat and agent-list UI in `packages/ui` and requires the desktop app to import it from `ui/source`.
- The desktop app remains a thin composition layer instead of becoming a second shared UI surface.
- The UI consumes one merged agent list from the backend, not separate system and user collections.
- System, inherited, duplicated, and fully custom agent states are visible and understandable.
- System agents are clearly not edited in place, while user-owned agents expose the correct edit actions.
- `ModelCard.uiPresentation` clearly drives capability badges, disabled controls, tool visibility, and fallback messaging.

## Dependencies

- `01-model-card-handler.md` provides `ResolvedAgentProfile`, `ModelCard`, `ModelUiPresentation`, and agent metadata.
- `02-backend-apis-services.md` provides agent-catalog merge behavior, thread/message/run data contracts, and AI SDK-backed streaming.
- `packages/ui` remains the shared component boundary for reusable UI.
- Frontend chat-state behavior should align with [AI SDK UI Overview](https://ai-sdk.dev/docs/ai-sdk-ui/overview).

## Risks / Notes

- This screen can get crowded quickly; the right panel should prioritize the most useful model and agent context first.
- AI SDK UI should support the page model, not replace it. The repo’s clean-architecture boundary still matters.
- Mention UX does not need full autocomplete in sprint 001 if validation and highlighting cover the core flow.
- Model-specific presentation should stay declarative through `ModelCard.uiPresentation`, not turn into scattered `if provider === ...` checks.
