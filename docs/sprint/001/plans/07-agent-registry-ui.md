# Title

Agent Registry UI Plan

## Goal

Design and implement a dedicated Agent Registry screen that lets users browse, inspect, create, duplicate, inherit, and edit agents outside the chat experience, while making the home page expose Agent Registry as its own first-class AI destination.

## Scope

- Add a dedicated home menu entry for Agent Registry.
- Add a standalone registry route in `apps/desktop-app`.
- Build reusable registry UI components in `packages/ui`.
- Consume the merged resolved agent list from the backend.
- Support source-aware and inheritance-aware agent management UX.
- Show model-card-driven capabilities, warnings, tool state, and editability.

Out of scope:

- Backend merge implementation itself.
- Chat thread execution or message streaming.
- Provider or model execution logic.
- Editing backend system JSON definitions directly.

## Architecture

- `packages/ui/src/lib`
  - Own reusable registry components and visual primitives.
  - Export them through `ui/source`.
  - Contain:
    - agent list items
    - source badges
    - inheritance badges
    - agent detail cards
    - action bars
    - search and filter UI primitives where reuse makes sense
- `apps/desktop-app/src/routes/+page.svelte`
  - Add a dedicated Agent Registry home card in the AI section.
- `apps/desktop-app/src/routes/agents`
  - New first-class route for the registry screen.
  - Own route composition and page bootstrap only.
- `.svelte.ts` page model
  - Own registry state, selection, search, filtering, actions, and transport orchestration.
  - Must not contain backend merge rules.
- `ChatTransport` or a registry-specific transport surface
  - Returns unified resolved agents only.
  - Exposes:
    - `listAgents`
    - `saveUserAgent`
    - `duplicateSystemAgent`
    - `inheritSystemAgent`
    - optionally `deleteUserAgent` later if the product adds it

## Implementation Plan

1. Add a dedicated home menu card.
   - In the AI section on home, add a new `CategoryCard` for `Agent Registry`.
   - Keep `Multi-Agent Chat` as a separate card.
   - Add new paraglide messages for registry label and description if home strings remain localized.
2. Add a first-class route for the registry.
   - Create `apps/desktop-app/src/routes/agents/+page.svelte`.
   - Add:
     - `agent-registry-page.svelte.ts`
     - `agent-registry-page.composition.ts`
   - Do not hide the registry inside the chat route.
3. Build the registry layout.
   - Left column: search, filters, and agent list.
   - Center or right detail panel: selected agent overview and editable fields.
   - Optional secondary panel or stacked sections for capabilities, tool state, and inheritance metadata.
   - Design desktop first, but keep it workable in `dev:web`.
4. Move reusable registry UI into `packages/ui`.
   - Add components such as:
     - `AgentRegistryListItem`
     - `AgentRegistrySourceBadge`
     - `AgentRegistryInheritanceBadge`
     - `AgentRegistryDetailCard`
     - `AgentRegistryActionBar`
     - `AgentRegistryEmptyState`
     - `AgentRegistryFilters`
   - Reuse existing chat-agent components where they fit, but avoid overloading chat-specific components if the registry needs different density or affordances.
   - Export the new registry surface through `packages/ui/src/lib/index.ts`.
5. Consume only resolved merged agent data.
   - The registry page model loads `ResolvedAgentProfile[]`.
   - It must not know whether an item came from backend JSON or a DB row before resolution.
   - It uses `source`, `isInherited`, `isDuplicatedFromSystem`, `isEditable`, embedded `modelCard`, and `systemPrompt` to drive UI.
6. Add list behaviors.
   - Search by name and description.
   - Filter by:
     - source (`system` / `user`)
     - status (`inherited`, `duplicated`, `custom`)
     - provider or model family where useful from resolved `modelCard`
   - Preserve backend ordering by default when no filter or sort is active:
     - system JSON order first
     - then user agents by `updatedAt desc`
7. Add detail behaviors.
   - Show:
     - name
     - description
     - `systemPrompt`
     - source and inheritance metadata
     - model card label
     - capability badges
     - tool state
     - fallback warnings and hints from `ModelCard.uiPresentation`
   - Show editability clearly:
     - system agents are read-only
     - inherited agents expose an editable override surface
     - duplicated and custom agents expose a full editable user surface
8. Add registry actions.
   - For system agents:
     - `Use in Chat`
     - `Duplicate`
     - `Inherit`
   - For inherited agents:
     - `Edit`
     - `Use in Chat`
   - For duplicated and custom agents:
     - `Edit`
     - `Use in Chat`
   - If deletion is not already planned elsewhere, do not add it in this sprint plan.
9. Add create and edit flows.
   - Provide a `New Agent` action for fully custom user agents.
   - Prefer a detail panel over a modal if it keeps the workflow faster and more desktop-friendly.
   - Editable fields should include:
     - name
     - description
     - system prompt
     - model selection
     - tools toggle and allowed overrides
   - System-owned immutable fields should remain visibly locked.
10. Add chat handoff behavior.
   - From the registry, a user should be able to jump into chat using the selected agent.
   - Reserve a clear action and dependency on the chat transport and backend plan without defining thread-creation behavior here.
11. Keep clean architecture explicit.
   - Reusable registry UI lives in `packages/ui`.
   - The desktop app imports it through `ui/source`.
   - The route page model orchestrates transport calls.
   - Merge logic, inheritance resolution, and system JSON loading stay in backend and application layers.

## Tests

- `packages/ui` tests:
  - registry list item rendering
  - source badge rendering
  - inheritance badge rendering
  - detail card rendering from resolved agent data
  - capability and warning rendering from embedded `modelCard`
- `apps/desktop-app` page-model tests:
  - initial merged agent load
  - search and filter behavior
  - selection behavior
  - duplicate action
  - inherit action
  - create custom agent flow
  - editability differences between system, inherited, duplicated, and custom agents
- Home route tests:
  - `Agent Registry` card appears in the AI section
  - card links to the dedicated registry route
- Integration scenarios:
  - system agents appear first
  - inherited and duplicated agents render with distinct badges
  - editing is blocked for system agents
  - resolved `modelCard` badges and warnings render the same way for system and user agents

## Acceptance Criteria

- Home contains a dedicated `Agent Registry` AI menu entry separate from `Multi-Agent Chat`.
- The registry exists as a standalone route, not just a panel inside chat.
- The registry consumes one merged resolved agent list from the backend.
- System, inherited, duplicated, and custom agents are visually distinct.
- System agents are inspectable but not directly editable.
- Reusable registry UI lives in `packages/ui` and is imported into the desktop app from `ui/source`.
- The page model never reimplements backend merge logic.

## Dependencies

- `01-model-card-handler.md`
  - provides `ResolvedAgentProfile`, `ModelCard`, and `ModelUiPresentation`
- `02-backend-apis-services.md`
  - provides `AgentCatalogService` and merged resolved agent list behavior
- `04-ui-backend-integration.md`
  - provides `listAgents`, `duplicateSystemAgent`, `inheritSystemAgent`, and `saveUserAgent`
- Existing shared chat-agent components in `packages/ui/src/lib/chat` can be reused where appropriate, but the registry plan should allow dedicated registry-specific wrappers when the UX needs differ.

## Risks / Notes

- The current chat route already exposes some agent management concepts, so the registry plan must avoid duplicating backend logic while still offering a richer management surface than chat needs.
- The biggest UX risk is letting the registry feel like “chat settings.” It should read as a proper agent library or catalog.
- Search, filter, and sort should stay lightweight in Sprint 001; avoid turning this into a full admin console.
- The registry page should be the canonical place for agent management, while chat remains the canonical place for thread participation and conversation.
