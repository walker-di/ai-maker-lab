# Title

Chat UI And Backend Integration Plan With AI SDK UI Transport

## Goal

Connect the chat page model and UI components to the web API and desktop RPC through one app-local transport layer, using AI SDK UI-compatible streaming on the web and the same normalized message-part stream over desktop RPC.

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
     - save agent
     - duplicate agent
     - add or remove thread participant
     - send message
     - send reply
     - subscribe to normalized stream events
2. Make the transport AI SDK UI-aware.
   - Define the transport in terms of `UIMessage` or an equivalent normalized message-part layer.
   - Require both web and desktop to emit the same message-part contract so the page model does not branch by runtime.
3. Add transport runtime resolution.
   - Follow the existing `createTodoTransport()` pattern.
   - Keep desktop vs web detection in the adapter layer only.
4. Implement web transport.
   - Map transport methods to `/api/chat/**` endpoints.
   - Consume AI SDK UI stream responses directly.
   - Normalize API errors into UI-safe `Error` objects.
5. Implement desktop transport.
   - Extend the Electrobun chat RPC schema with request and message channels.
   - Use RPC requests for thread and mutation commands.
   - Use RPC messages to push the same normalized message-part events the web transport yields.
6. Add route-local composition.
   - Create `chat-page.composition.ts` to build the page model and inject `createChatTransport()`.
   - Load initial thread summaries and optionally the selected thread on route start.
7. Implement page-model integration behavior.
   - optimistic user message insertion
   - placeholder assistant run creation
   - progressive text and tool event application
   - completion and failure finalization
   - thread ordering refresh after message completion
   - model-card-driven UI updates without provider-specific branching
8. Handle reload and reconnect behavior.
   - On page load, fetch persisted thread state first.
   - If an active run exists, subscribe for continuation or reload final state.
   - Never rely exclusively on in-memory stream state.
9. Unify error handling.
   - transport and network errors
   - stream interruption
   - missing-provider-key responses
   - stale thread selection or missing thread after reload
   - rejected model-card input policies such as unsupported video with no fallback hook

## Tests

- Contract tests for `ChatTransport` behavior using mocks or fakes.
- Web transport tests for AI SDK UI stream payload and error normalization.
- Desktop transport tests for RPC request and normalized stream-message handling.
- Page-model integration tests for:
  - optimistic send
  - streamed updates
  - send failure recovery
  - reload and thread rehydration
  - reply flow
  - mention-targeted send flow
  - model-card-driven warning and disabled state updates
- Parity checks to ensure the same page model behavior works in both runtime modes at the normalized message-part layer.

## Acceptance Criteria

- The same page model works in `dev:web` and desktop mode without branching on transport details.
- Web mode consumes AI SDK UI-compatible streaming directly.
- Desktop mode emits the same normalized message-part stream shape over RPC.
- Assistant output appears progressively during streaming.
- Final persisted history matches what the user saw during streaming.
- Provider and model quirks are handled through model cards and handler hooks, not view-layer branching.

## Dependencies

- `02-backend-apis-services.md` must provide AI SDK-aware endpoints, RPC contracts, and persisted stream lifecycle behavior.
- `03-chat-ui.md` must provide the page shell and page-model interaction surface.
- Existing todo transport patterns in `apps/desktop-app/src/lib/adapters/todo` should be used as the reference implementation style.
- Web protocol alignment should follow [AI SDK UI Overview](https://ai-sdk.dev/docs/ai-sdk-ui/overview).

## Risks / Notes

- Transport drift is the biggest risk here. Web and desktop must agree on the same normalized message-part contract.
- Hidden fallback logic in the transport would be a mistake; capability and policy decisions belong in model cards and the handler pipeline.
- Avoid background polling unless the backend contract truly requires it; event-driven updates are preferred for active runs.
- This step is where architecture discipline matters most: page models depend on `ChatTransport`, not on `fetch`, route handlers, or RPC directly.
