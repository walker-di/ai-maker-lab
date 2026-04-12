# Title

Chat UI And Backend Integration Plan With Merged Agent Transport

## Goal

Connect the chat page model and UI components to the web API and desktop RPC through one app-local transport layer, using AI SDK UI-compatible streaming on the web and the same normalized message-part stream over desktop RPC. The transport must expose one unified resolved agent list and keep the page model unaware of backend JSON and DB merge details.

## Scope

- Add app-local chat transport interfaces and transport factories.
- Integrate the chat page model with AI SDK-aware web endpoints and desktop RPC.
- Support optimistic updates, stream subscriptions, reload recovery, and transport-safe error handling.
- Keep `/api/**` and RPC details out of route components and page models.

Out of scope for this step:

- Provider/model execution internals already covered by the handler plan.
- Deeper UI design work already covered in file 3.
- Media transformation internals beyond transporting normalized input and output state.

## Architecture

- `apps/desktop-app/src/lib/adapters/chat`
  - Own `ChatTransport`, runtime detection, and web/desktop transport implementations.
- `apps/desktop-app/src/routes/experiments/chat/chat-page.composition.ts`
  - Own page bootstrap and dependency construction.
- `apps/desktop-app/src/routes/experiments/chat/chat-page.svelte.ts`
  - Own interaction flow and transport orchestration.
- Web mode
  - Uses `/api/chat/**` and AI SDK UI stream protocol end to end.
- Desktop mode
  - Uses Electrobun RPC requests for commands and RPC messages that mirror the same normalized message-part stream shape.

## Implementation Plan

1. Create chat transport contracts.
   - Add a `ChatTransport` interface similar to the todo reference pattern.
   - Define methods for:
     - list threads
     - load thread
     - create thread
     - list agents
     - save user agent
     - duplicate system agent
     - inherit system agent
     - add or remove thread participant
     - send message
     - send reply
     - subscribe to normalized stream events
2. Make the transport AI SDK UI-aware.
   - Define the transport in terms of `UIMessage` or an equivalent normalized message-part layer.
   - Require both web and desktop to emit the same message-part contract so the page model does not branch by runtime.
3. Make the transport agent-catalog aware without exposing merge internals.
   - `listAgents()` must return the unified resolved agent list only.
   - `saveUserAgent()` operates only on user-owned agents.
   - `duplicateSystemAgent()` and `inheritSystemAgent()` are explicit transport actions.
   - The page model must not know whether a result came from backend JSON or a DB row before resolution.
4. Add transport runtime resolution.
   - Follow the existing `createTodoTransport()` pattern.
   - Keep desktop vs web detection in the adapter layer only.
5. Implement web transport.
   - Map transport methods to `/api/chat/**` endpoints.
   - Consume AI SDK UI stream responses directly.
   - Normalize API errors into UI-safe `Error` objects.
   - Ensure agent-list responses return the full embedded `modelCard` shape for both system and user agents.
6. Implement desktop transport.
   - Extend the Electrobun chat RPC schema with request and message channels.
   - Use RPC requests for thread and mutation commands.
   - Use RPC messages to push the same normalized message-part events the web transport yields.
   - Mirror the same resolved agent-list response shape as the web transport.
7. Add route-local composition.
   - Create `chat-page.composition.ts` to build the page model and inject `createChatTransport()`.
   - Load initial thread summaries and the merged agent catalog on route start.
8. Implement page-model integration behavior.
   - optimistic user message insertion
   - placeholder assistant run creation
   - progressive text and tool event application
   - completion and failure finalization
   - thread ordering refresh after message completion
   - model-card-driven UI updates without provider-specific branching
   - merged agent-list updates after duplicate or inherit actions
9. Handle reload and reconnect behavior.
   - On page load, fetch persisted thread state first.
   - Fetch the merged agent catalog through the transport.
   - If an active run exists, subscribe for continuation or reload final state.
   - Never rely exclusively on in-memory stream state.
10. Unify error handling.
   - transport and network errors
   - stream interruption
   - missing-provider-key responses
   - stale thread selection or missing thread after reload
   - rejected model-card input policies such as unsupported video with no fallback hook
   - invalid system-agent action attempts such as editing a non-editable system default

## Tests

- Contract tests for `ChatTransport` behavior using mocks or fakes.
- Web transport tests for:
  - AI SDK UI stream payload normalization
  - merged resolved agent-list response shape
  - duplicate and inherit action calls
  - error normalization
- Desktop transport tests for:
  - RPC request and normalized stream-message handling
  - merged resolved agent-list parity with the web transport
- Page-model integration tests for:
  - merged agent-list loading
  - duplicate and inherit flows
  - user-agent save flow
  - optimistic send
  - streamed updates
  - reload and thread rehydration
  - reply flow
  - mention-targeted send flow
  - model-card-driven warning and disabled state updates
- Parity checks to ensure the same page model behavior works in both runtime modes at the normalized message-part layer and resolved agent-list layer.

## Acceptance Criteria

- The same page model works in `dev:web` and desktop mode without branching on transport details.
- Web mode consumes AI SDK UI-compatible streaming directly.
- Desktop mode emits the same normalized message-part stream shape over RPC.
- `ChatTransport.listAgents()` returns the unified resolved agent list.
- The transport exposes explicit duplicate, inherit, and save-user-agent actions.
- The page model remains unaware of how backend JSON and DB results are merged.

## Dependencies

- `02-backend-apis-services.md` must provide AI SDK-aware endpoints, agent-catalog merge behavior, RPC contracts, and persisted stream lifecycle behavior.
- `03-chat-ui.md` must provide the page shell and page-model interaction surface.
- Existing todo transport patterns in `apps/desktop-app/src/lib/adapters/todo` should be used as the reference implementation style.
- Web protocol alignment should follow [AI SDK UI Overview](https://ai-sdk.dev/docs/ai-sdk-ui/overview).

## Risks / Notes

- Transport drift is the biggest risk here. Web and desktop must agree on the same normalized message-part and resolved agent-list contracts.
- Hidden merge logic in the page model would be a mistake; merge behavior belongs in backend services.
- Hidden fallback logic in the transport would also be a mistake; capability and policy decisions belong in model cards and the handler pipeline.
- Avoid background polling unless the backend contract truly requires it; event-driven updates are preferred for active runs.
