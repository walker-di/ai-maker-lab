# Title

Backend APIs And AI SDK Chat Services Plan

## Goal

Create the chat domain, persistence model, routing rules, and thin delivery adapters needed to support multi-agent, multi-LLM conversations, with execution powered by Vercel AI SDK `streamText` and `generateText`, while preserving the repository’s clean-architecture boundaries.

## Scope

- Add a new chat subdomain in `packages/domain`.
- Keep browser-safe chat contracts in `packages/domain/src/shared/chat`.
- Keep use cases, ports, routing, and model-runtime orchestration in `packages/domain/src/application/chat`.
- Keep SurrealDB repositories and AI SDK registry wiring in `packages/domain/src/infrastructure`.
- Keep HTTP and Electrobun RPC handlers thin inside `apps/desktop-app`.
- Support one-level reply threads, streamed assistant responses, and model-card-driven runtime behavior.

Out of scope for this step:

- Final chat UI layout and visual components.
- Rich tool rendering beyond normalized transcript events.
- Copying file contents into app-managed storage.

## Architecture

- `packages/domain/src/shared/chat`
  - Holds browser-safe DTOs and helper types only.
  - Owns `ChatThread`, `ThreadParticipant`, `ChatMessage`, `ChatRun`, `RouterDecision`, and model-card-facing snapshot types.
  - Must stay free of AI SDK, SurrealDB, SvelteKit, and Electrobun imports.
- `packages/domain/src/application/chat`
  - Holds use cases, repository ports, routing rules, model-runtime ports, and orchestration.
  - Owns `ModelRuntimeService` or `ChatModelRuntime`, but not concrete AI SDK provider construction.
  - Depends only on shared types and abstract ports.
- `packages/domain/src/infrastructure/database/chat`
  - Holds Surreal repositories, query shapes, record mappers, and id normalization.
  - Implements application repository ports using `SurrealDbAdapter`.
- `packages/domain/src/infrastructure/ai`
  - Holds AI SDK provider registry creation, wrapped model construction, and runtime adapter wiring.
  - Implements the application-facing model runtime port.
- `apps/desktop-app`
  - Acts only as an adapter and composition boundary.
  - HTTP route handlers and Bun RPC handlers translate transport payloads to application use-case inputs and stream outputs back to the client.
  - Must not own business rules, routing policy, persistence logic, or model fallback policy.

## Implementation Plan

1. Create the chat subdomain folders.
   - Add `packages/domain/src/shared/chat/README.md`.
   - Add `packages/domain/src/application/chat`.
   - Add `packages/domain/src/infrastructure/database/chat`.
   - Add `packages/domain/src/infrastructure/ai`.
   - Export the new chat surfaces through `domain/shared`, `domain/application`, and `domain/infrastructure`.
2. Define shared persistence-facing concepts without leaking infrastructure details.
   - Add shared types for:
     - `ChatThread`
     - `ThreadParticipant`
     - `ChatMessage`
     - `ChatRun`
     - `AttachmentRef`
     - `RouterDecision`
   - Keep these types browser-safe and free of Surreal record-id types.
3. Define thread and message rules in the application layer.
   - Every thread must have at least one agent participant.
   - A message may optionally reference `parentMessageId`.
   - Reply chains are one level deep only.
   - Assistant messages are linked to the `chat_run` that produced them.
   - Each assistant run persists the model snapshot resolved from the active `ModelCard`.
4. Define repository and runtime ports in `packages/domain/src/application/chat`.
   - `IAgentRepository`
   - `IChatThreadRepository`
   - `IChatMessageRepository`
   - `IChatRunRepository`
   - `IAttachmentRepository`
   - `IChatRouter`
   - `IModelRuntimeService`
   - `IClock` or timestamp abstraction only if the use cases need deterministic time behavior
5. Add `ModelRuntimeService` or `ChatModelRuntime` in the application layer.
   - Resolve the active agent’s `ModelCard`.
   - Resolve the wrapped AI SDK model through an infrastructure-backed registry port.
   - Apply model-card hooks and policies before invocation.
   - Invoke `streamText` or `generateText` through the runtime port.
   - Normalize stream parts into app-level run and transcript events.
6. Implement use cases from the inside out.
   - Agent use cases:
     - `CreateAgent`
     - `UpdateAgent`
     - `DuplicateAgent`
   - Thread use cases:
     - `CreateThread`
     - `ListThreads`
     - `LoadThread`
     - `AddAgentToThread`
     - `RemoveAgentFromThread`
   - Message and run use cases:
     - `SendUserMessage`
     - `SendReplyMessage`
     - `StartAssistantRun`
     - `AppendStreamEvent`
     - `FinalizeAssistantRun`
   - Keep orchestration in use cases, not repositories or route handlers.
7. Implement deterministic routing in the application layer.
   - Parse `@agent-name` mentions from the user message.
   - If a valid mention exists, route to that agent.
   - Else if the user is replying, prefer the branch context of the parent message.
   - Else if the thread has a default agent, use it.
   - Else choose the best active agent using role, model-card capabilities, and thread heuristics.
   - Else fall back to the first active participant.
8. Implement Surreal repositories in `packages/domain/src/infrastructure/database/chat`.
   - Use focused repository classes instead of one large chat repository.
   - Keep record-id normalization localized to repository mappers, following the todo reference pattern.
   - Preserve sorted history queries by thread and created time.
   - Persist normalized stream events and final assistant messages separately enough to support replay and reload.
9. Implement AI SDK runtime infrastructure in `packages/domain/src/infrastructure/ai`.
   - Build the provider registry.
   - Register wrapped OpenAI, Anthropic, and Google models.
   - Translate AI SDK output into normalized application events.
   - Keep `providerOptions`, hook application, and model resolution out of transport handlers.
10. Add thin delivery adapters in `apps/desktop-app`.
   - Web:
     - `/api/chat/threads`
     - `/api/chat/threads/[threadId]`
     - `/api/chat/threads/[threadId]/messages`
     - `/api/chat/agents`
   - Desktop:
     - extend the Electrobun RPC schema with chat requests and stream messages
   - Both transports should call the same application services and expose the same normalized stream shape.
11. Add composition services.
   - Create a `chat-service` equivalent to the current `todo-service` for web mode.
   - Reuse the same domain/application orchestration in both desktop and web entrypoints.

## Tests

- Shared and application tests should use `bun:test` and stay framework-free.
- Use-case tests should follow the `TodoService` pattern in `packages/domain/src/application/todo/todo-service.test.ts`.
  - Use in-memory fakes for repositories and runtime ports.
  - Cover:
    - creating a thread
    - enforcing at least one agent participant
    - duplicating agents
    - reply linkage rules
    - mention routing
    - default-agent fallback
    - model-runtime orchestration order
- Repository tests should follow the real-instance pattern in [SurrealTodoRepository.test.ts](/Users/walker/Documents/Dev/AI Maker Lab/ai-maker-lab/packages/domain/src/infrastructure/database/SurrealTodoRepository.test.ts).
  - Use `createDbConnection({ host: 'mem://', ... })`.
  - Test chat repositories against an actual in-memory SurrealDB instance, not mocks.
  - Cover:
    - thread persistence
    - participant persistence
    - message ordering
    - `parentMessageId` reply linkage
    - run-event persistence
    - attachment persistence
    - record-id normalization if the repository accepts prefixed ids
- Runtime adapter tests should focus on the infrastructure AI SDK layer.
  - Verify model registry lookup.
  - Verify hook application order.
  - Verify normalized stream-event translation.
  - Mock AI SDK call boundaries only at the infrastructure edge, not in use-case tests.
- Transport adapter tests should stay thin.
  - Verify HTTP handlers and RPC handlers delegate to application services.
  - Verify the emitted web and desktop stream payloads share the same normalized message-part contract.

## Acceptance Criteria

- The plan clearly keeps shared, application, infrastructure, and app-adapter responsibilities separate.
- Chat execution is clearly planned around AI SDK `streamText` and `generateText`, without leaking AI SDK specifics into shared types.
- Chat repositories are planned to be tested against a real in-memory SurrealDB instance, matching repository test conventions already used in the repo.
- Use-case tests are planned with in-memory fakes, not real database instances, matching the current application-layer testing style.
- Web and desktop handlers remain thin and use the same application services and normalized stream event model.

## Dependencies

- `01-model-card-handler.md` must define stable `ModelCard`, `ModelHandler`, and hook contracts first.
- SurrealDB access should reuse the existing database client conventions from `packages/domain/src/infrastructure/database`.
- Web streaming should align with [AI SDK UI Overview](https://ai-sdk.dev/docs/ai-sdk-ui/overview).
- Model/provider resolution should align with [Provider & Model Management](https://ai-sdk.dev/docs/ai-sdk-core/provider-management).

## Risks / Notes

- Stream persistence can become noisy if every low-level SDK event is stored raw; persist normalized app events only.
- Desktop RPC must match the same message-part contract the web stream uses or the page model will drift.
- Thread titles can stay simple in sprint 001 as long as the behavior is documented.
- Routing, model execution, and hook logic must remain in application services, not in HTTP handlers, RPC adapters, or repositories.
