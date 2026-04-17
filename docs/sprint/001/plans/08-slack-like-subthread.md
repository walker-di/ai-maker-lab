# Title

Slack-Like Subthread UI And Threaded Conversation Plan

## Goal

Design and implement a Slack-like subthread experience for multi-agent chat that keeps the main timeline focused while letting users open a dedicated reply thread for a top-level message. The feature must build on the repo's existing one-level reply model using `parentMessageId`, preserve clean architecture across `packages/domain`, `packages/ui`, and `apps/desktop-app`, and keep the UI and transport aligned with the existing AI SDK chat flow.

## Scope

- Add a dedicated subthread interaction model to the chat experience.
- Build reusable subthread UI in `packages/ui`.
- Keep route composition and subthread state orchestration in `apps/desktop-app`.
- Reuse the existing one-level reply foundation in the domain and database layers.
- Support opening a thread from a root message, browsing replies, and posting new replies into that thread.
- Show reply summaries in the main timeline so the subthread feature is discoverable without cluttering the root conversation.
- Keep threaded replies one level deep only for Sprint 001.

Out of scope for this step:

- Deep recursive threads or nested replies.
- A separate standalone route for subthreads outside chat.
- Cross-thread reply search or global inbox features.
- Reworking the persistence model away from `parentMessageId`.
- Full Slack parity such as unread markers, emoji reactions, or per-thread notification settings.

## Architecture

- `packages/domain/src/shared/chat`
  - Continues to own browser-safe chat contracts such as `ChatMessage` with `parentMessageId`.
  - Must remain the shared source for one-level reply semantics.
- `packages/domain/src/application/chat`
  - Owns reply and subthread use cases.
  - Builds on the existing `sendMessage(..., parentMessageId?)` and `listReplies(parentMessageId)` contract.
  - Keeps the rule that only root messages can have replies.
- `packages/domain/src/infrastructure/database/chat`
  - Continues to persist `parentMessageId` and query replies through the real Surreal repositories.
  - Repository tests must keep using real `mem://` SurrealDB instances, following `SurrealTodoRepository.test.ts` and `surreal-chat-repositories.test.ts`.
- `packages/ui/src/lib/chat`
  - Owns reusable subthread UI primitives and visual wrappers.
  - Must not import `packages/domain`; use local UI-safe chat types that are structurally compatible with the domain contracts.
- `apps/desktop-app/src/routes/experiments/chat`
  - Owns route composition and `.svelte.ts` page-model orchestration for subthread selection, open and close state, reply loading, and send flows.
  - Must stay thin and import reusable UI from `ui/source`.
- `apps/desktop-app/src/lib/adapters/chat`
  - Owns CRUD transport for subthread operations such as loading replies.
  - Streaming remains on the AI SDK chat path; CRUD remains on the chat transport path.

## Implementation Plan

1. Formalize the Slack-like subthread UX model.
   - Treat each top-level message as a possible thread anchor.
   - A subthread is not a new entity; it is the UI projection of all messages whose `parentMessageId` points to the selected root message.
   - Replies cannot themselves be replied to in Sprint 001.
   - The UX should feel like "reply in thread" rather than "quote reply in the main timeline."
2. Keep the data model aligned with the existing domain contracts.
   - Reuse `ChatMessage.parentMessageId` as the only reply linkage field.
   - Reuse `IChatMessageRepository.listReplies(parentMessageId)` as the read path for subthreads.
   - Keep the application-layer validation that rejects reply-to-reply chains.
   - If additional UI metadata is needed, prefer derived read models or service-level summary DTOs instead of changing the write model unnecessarily.
3. Add explicit subthread-focused application behavior.
   - Add or document a dedicated use case for:
     - loading a root message together with its replies
     - listing reply summaries for timeline rendering when needed
     - sending a reply scoped to a selected root message
   - Keep the one-level reply rule in the application layer, not in UI conditionals.
   - If reply summary data becomes expensive to derive on the client, add an application/read-model contract such as `listThreadMessagesWithReplySummary(threadId)`.
4. Add reusable subthread UI primitives in `packages/ui`.
   - Create components such as:
     - `ChatSubthreadPreview`
     - `ChatSubthreadCountBadge`
     - `ChatSubthreadPanel`
     - `ChatSubthreadHeader`
     - `ChatSubthreadMessageList`
     - `ChatSubthreadEmptyState`
   - Reuse existing shared components where it improves consistency:
     - `ChatMessageBubble`
     - `ChatComposer`
     - `ChatReplyPreview`
     - `ChatAttachmentPill`
     - `ChatToolEventRow`
   - Export the new subthread surface through `packages/ui/src/lib/index.ts` so the desktop app imports it through `ui/source`.
5. Design the main-timeline affordance for thread discovery.
   - Each eligible root message should expose a visible `Reply in thread` action.
   - Show a compact reply summary under root messages that already have replies.
   - Summary content should include at least:
     - reply count
     - small preview of latest reply or participant set
     - clear affordance to open the thread panel
   - Reply summaries should appear only for root messages, never for replies.
6. Add the dedicated subthread surface in the chat screen.
   - Preferred layout for Sprint 001:
     - main conversation stays center
     - subthread opens in a dedicated right-side pane on desktop
     - narrower viewports can use a stacked panel or full-width overlay
   - The panel should pin the selected parent message at the top.
   - The reply list should appear beneath the parent message, ordered oldest-to-newest.
   - The panel should include its own composer scoped to the selected parent message.
7. Extend the chat page model in `.svelte.ts`.
   - Add state for:
     - selected subthread parent message
     - subthread open or closed state
     - replies loading state
     - reply collection for the active parent message
     - subthread send pending state
   - Keep the page model responsible for:
     - opening a thread from a root message
     - clearing or switching the active thread
     - loading replies through the CRUD transport
     - keeping main composer reply state and subthread panel state from conflicting
   - Avoid duplicating business rules such as "replies cannot have replies."
8. Clarify the composer behavior.
   - The existing main composer reply banner can remain as a lightweight path, but the new canonical Slack-like flow should be the dedicated thread panel.
   - When a thread panel is open, its composer should automatically send with `parentMessageId = selectedParent.id`.
   - Replies sent from the thread panel should update:
     - the subthread panel immediately
     - the main timeline reply summary
     - any thread ordering metadata affected by activity
   - Decide one clear rule for Sprint 001:
     - either keep both main-composer reply mode and thread-panel reply mode
     - or migrate reply mode fully into the panel and reserve the inline banner for jumping into the panel
   - The plan should favor a single canonical reply flow to avoid duplicated UX.
9. Add CRUD transport support for subthreads.
   - Extend the dedicated chat CRUD transport with methods such as:
     - `listReplies(parentMessageId)`
     - optional `getSubthread(parentMessageId)` if a richer response is needed
   - Keep streaming chat transport separate from CRUD transport, consistent with repo guidance.
   - The desktop and web transports must return the same normalized reply message shape.
10. Integrate subthread sends with the existing AI SDK chat flow.
   - Keep assistant response streaming behavior aligned with the current chat implementation.
   - When replying in a subthread, assistant messages created from that reply path must persist with the same `parentMessageId`.
   - Ensure streamed assistant replies land in the correct panel and do not appear as top-level messages in the main timeline.
11. Define ordering and visibility rules.
   - Main timeline:
     - render only top-level messages where `parentMessageId` is absent
     - render reply summaries beneath those messages
   - Subthread panel:
     - render the parent message first
     - render replies where `parentMessageId === parent.id`
   - Assistant and user replies belong in the same flat reply list inside the panel.
12. Plan for thread-aware agent and routing context.
   - Replies should preserve the existing application behavior where reply sends use parent context first.
   - The panel should clearly show which agent responded in each reply.
   - Mention and model-card presentation rules must work the same inside the subthread as in the main timeline.
13. Handle empty and edge states.
   - No replies yet: show an empty state encouraging the first reply.
   - Missing parent message: show a recoverable error state and close or reset the panel.
   - Parent deleted or unavailable after reload: show a safe fallback state.
   - Rejected reply-to-reply attempts should never surface from normal UI flows, but transport and app errors should still be handled gracefully if they occur.
14. Keep the UI plan aligned with clean architecture.
   - Shared visual building blocks stay in `packages/ui`.
   - The desktop app imports those components through `ui/source`.
   - The route page model owns orchestration, not rendering primitives.
   - Threading business rules remain in domain and application code.

## Tests

- Domain and application tests:
  - Verify the existing one-level reply rule continues to reject reply-to-reply sends.
  - Add service-level tests for any new subthread read-model or reply-summary use case.
  - Keep external mocks limited to truly external boundaries only.
- Repository tests in `packages/domain/src/infrastructure/database/chat`:
  - Use a real `mem://` SurrealDB instance per test file with unique namespace and database.
  - Follow the same pattern as `SurrealTodoRepository.test.ts` and `surreal-chat-repositories.test.ts`.
  - Cover:
    - persisting `parentMessageId`
    - `listReplies(parentMessageId)`
    - empty reply lists on fresh databases
    - ordering of replies by `createdAt ASC`
- Shared UI tests in `packages/ui`:
  - render reply summary components
  - render subthread panel states
  - render empty state and count badge variants
  - verify root-message-only affordances
- Desktop app page-model tests in `apps/desktop-app`:
  - open subthread from a root message
  - close or switch active subthread
  - load replies through the transport
  - send a reply from the subthread composer
  - update main timeline reply summary after send
  - keep reply messages out of the top-level timeline render set
  - preserve agent labels and model-card-driven warnings inside the thread panel
- E2E tests in `apps/desktop-app/e2e`:
  - open a message thread from the main chat timeline
  - view existing replies in the side panel
  - send a reply and observe it in the thread panel
  - confirm the main timeline shows a reply summary instead of duplicating reply messages inline
  - continue using the existing `mem://` and AI SDK SSE mocking rules from the repo test setup

## Acceptance Criteria

- Sprint 001 has a dedicated plan for Slack-like subthreads instead of only an inline reply banner.
- The plan explicitly builds on the existing `parentMessageId` and `listReplies` foundation.
- The main timeline remains top-level-only and does not inline reply messages as full nested trees.
- A root message can open a dedicated subthread panel that shows the parent message and its replies.
- Reply sends from the thread panel stay scoped to the selected parent message.
- The plan keeps reusable subthread UI in `packages/ui` and app-local orchestration in `apps/desktop-app`.
- Repository tests are specified to use real in-memory SurrealDB instances rather than hand-rolled fakes.
- The plan keeps reply depth limited to one level for Sprint 001.

## Dependencies

- `02-backend-apis-services.md`
  - provides the shared chat domain, repository contracts, routing rules, and Surreal persistence model.
- `03-chat-ui.md`
  - provides the base chat screen, shared chat component strategy, and `.svelte.ts` page-model boundary.
- `04-ui-backend-integration.md`
  - provides CRUD transport wiring and normalized message handling between web and desktop.
- Existing domain implementation in:
  - `packages/domain/src/shared/chat/chat-types.ts`
  - `packages/domain/src/application/chat/ports.ts`
  - `packages/domain/src/application/chat/chat-service.ts`
  - `packages/domain/src/infrastructure/database/chat/SurrealChatMessageRepository.ts`

## Risks / Notes

- The biggest UX risk is duplicating reply behavior between the inline composer banner and a dedicated thread pane. Sprint 001 should converge on one canonical thread-reply flow.
- The biggest architectural risk is letting the page model invent nested-thread rules that already belong in the application layer.
- Reply summary data can become expensive to derive repeatedly on the client if thread sizes grow; if that happens, add an application-level summary read model rather than bloating UI logic.
- The thread panel should feel like a focused conversation sidecar, not a second full chat screen competing with the main timeline.
