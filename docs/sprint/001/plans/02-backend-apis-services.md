# Title

Backend APIs, Agent Catalog Service, And AI SDK Chat Services Plan

## Goal

Create the chat domain, persistence model, agent-catalog merge rules, routing rules, and thin delivery adapters needed to support multi-agent, multi-LLM conversations, with execution powered by Vercel AI SDK `streamText` and `generateText`, while preserving the repository’s clean-architecture boundaries.

## Scope

- Add a new chat subdomain in `packages/domain`.
- Keep browser-safe chat contracts in `packages/domain/src/shared/chat`.
- Keep use cases, ports, routing, agent-catalog merging, and model-runtime orchestration in `packages/domain/src/application/chat`.
- Keep SurrealDB repositories, backend JSON system-agent loading, and AI SDK registry wiring in `packages/domain/src/infrastructure`.
- Keep HTTP and Electrobun RPC handlers thin inside `apps/desktop-app`.
- Support one-level reply threads, streamed assistant responses, and model-card-driven runtime behavior.

Out of scope for this step:

- Final chat UI layout and visual components.
- Rich tool rendering beyond normalized transcript events.
- Copying file contents into app-managed storage.

## Architecture

- `packages/domain/src/shared/chat`
  - Holds browser-safe DTOs and helper types only.
  - Owns `ChatThread`, `ThreadParticipant`, `ChatMessage`, `ChatRun`, `RouterDecision`, `SystemAgentDefinition`, `StoredUserAgent`, and `ResolvedAgentProfile`.
  - Must stay free of AI SDK, SurrealDB, SvelteKit, and Electrobun imports.
- `packages/domain/src/application/chat`
  - Holds use cases, repository ports, routing rules, `AgentCatalogService`, model-runtime ports, and orchestration.
  - Owns merge rules for system JSON + DB user agents.
  - Depends only on shared types and abstract ports.
- `packages/domain/src/infrastructure/database/chat`
  - Holds Surreal repositories, query shapes, record mappers, and id normalization for DB-backed user agents only.
  - System defaults are not stored here.
- `packages/domain/src/infrastructure/ai`
  - Holds AI SDK provider registry creation, wrapped model construction, and runtime adapter wiring.
  - Implements the application-facing model runtime port.
- `packages/domain/src/infrastructure/agents`
  - Holds raw JSON loading for backend-owned system agent definitions.
  - Can embed internal constants like `Gemini3FamilyModelCard`.
- `apps/desktop-app`
  - Acts only as an adapter and composition boundary.
  - HTTP route handlers and Bun RPC handlers translate transport payloads to application use-case inputs and stream outputs back to the client.
  - Must not own business rules, routing policy, persistence logic, merge rules, or model fallback policy.

## Implementation Plan

1. Create the chat subdomain folders.
   - Add `packages/domain/src/shared/chat/README.md`.
   - Add `packages/domain/src/application/chat`.
   - Add `packages/domain/src/infrastructure/database/chat`.
   - Add `packages/domain/src/infrastructure/ai`.
   - Add an infrastructure area for backend-owned system agent JSON loading.
   - Export the new chat surfaces through `domain/shared`, `domain/application`, and `domain/infrastructure`.
2. Define shared persistence-facing and controller-facing concepts without leaking infrastructure details.
   - Add shared types for:
     - `ChatThread`
     - `ThreadParticipant`
     - `ChatMessage`
     - `ChatRun`
     - `AttachmentRef`
     - `RouterDecision`
     - `SystemAgentDefinition`
     - `StoredUserAgent`
     - `ResolvedAgentProfile`
   - Keep these types browser-safe and free of Surreal record-id types.
3. Define agent-catalog persistence rules.
   - System agents are never stored in the DB.
   - System defaults live in backend-owned raw JSON.
   - DB user agents store user-owned fields and overrides only.
   - Duplicated system agents are stored as full user agents with no future linkage.
   - Inherited agents store `inheritsFromSystemAgentId` plus override fields.
   - DB records may store `modelCardId`, while the service layer resolves the full embedded `modelCard`.
4. Define thread and message rules in the application layer.
   - Every thread must have at least one agent participant.
   - A message may optionally reference `parentMessageId`.
   - Reply chains are one level deep only.
   - Assistant messages are linked to the `chat_run` that produced them.
   - Each assistant run persists the model snapshot resolved from the effective agent.
5. Define repository and runtime ports in `packages/domain/src/application/chat`.
   - `ISystemAgentDefinitionSource`
   - `IUserAgentRepository`
   - `IChatThreadRepository`
   - `IChatMessageRepository`
   - `IChatRunRepository`
   - `IAttachmentRepository`
   - `IChatRouter`
   - `IModelRuntimeService`
6. Add `AgentCatalogService` in the application layer.
   - Load system agent definitions from the backend JSON source.
   - Load user agents from the DB repository.
   - Resolve duplicates and inherited overrides.
   - Return one merged list of `ResolvedAgentProfile`.
   - Preserve system JSON order first, then append user agents by `updatedAt desc`.
7. Add explicit agent actions in the application layer.
   - `ListAgents`
   - `CreateUserAgent`
   - `UpdateUserAgent`
   - `DuplicateSystemAgent`
   - `InheritSystemAgent`
   - Keep edit permissions explicit:
     - system agents are not edited in place
     - user-owned duplicates are fully editable
     - inherited agents edit only their override layer
8. Add `ModelRuntimeService` or `ChatModelRuntime` in the application layer.
   - Resolve the effective `ResolvedAgentProfile`.
   - Resolve the embedded `ModelCard`.
   - Resolve the wrapped AI SDK model through an infrastructure-backed registry port.
   - Apply model-card hooks and policies before invocation.
   - Invoke `streamText` or `generateText` through the runtime port.
   - Normalize stream parts into app-level run and transcript events.
9. Implement deterministic routing in the application layer.
   - Parse `@agent-name` mentions from the user message.
   - If a valid mention exists, route to that effective resolved agent.
   - Else if the user is replying, prefer the branch context of the parent message.
   - Else if the thread has a default agent, use it.
   - Else choose the best active agent using role, effective model-card capabilities, and thread heuristics.
   - Else fall back to the first active participant.
10. Implement Surreal repositories in `packages/domain/src/infrastructure/database/chat`.
   - Store DB-backed user agents only.
   - Use focused repository classes instead of one large chat repository.
   - Keep record-id normalization localized to repository mappers, following the todo reference pattern.
   - Preserve sorted history queries by thread and created time.
   - Persist normalized stream events and final assistant messages separately enough to support replay and reload.
11. Implement infrastructure for system-agent JSON loading.
   - Load raw backend JSON definitions.
   - Embed internal model-card constants there.
   - Convert JSON definitions into application/shared types without leaking file-format concerns upward.
12. Implement AI SDK runtime infrastructure in `packages/domain/src/infrastructure/ai`.
   - Build the provider registry.
   - Register wrapped OpenAI, Anthropic, and Google models.
   - Translate AI SDK output into normalized application events.
   - Keep `providerOptions`, hook application, and model resolution out of transport handlers.
13. Add thin delivery adapters in `apps/desktop-app`.
   - Web:
     - `/api/chat/threads`
     - `/api/chat/threads/[threadId]`
     - `/api/chat/threads/[threadId]/messages`
     - `/api/chat/agents`
   - Desktop:
     - extend the Electrobun RPC schema with chat requests and stream messages
   - Both transports should call the same application services and expose the same normalized stream shape.
   - `/api/chat/agents` and its RPC equivalent should return the unified resolved agent list only.

## Tests

- Shared and application tests should use `bun:test` and stay framework-free.
- Application-layer agent-catalog tests should use in-memory fakes for:
  - system JSON source
  - user-agent repository
  - model runtime if needed
  - Cover:
    - merging backend system JSON + DB user agents into one list
    - duplicate creates a snapshot user agent with no future linkage
    - inherit creates a linked override with `inheritsFromSystemAgentId`
    - system JSON changes flow through inherited agents for non-overridden fields
    - effective `modelCard` and `systemPrompt` resolution
    - merged ordering: system JSON order first, then user agents by `updatedAt desc`
- Use-case tests should follow the `TodoService` pattern in `packages/domain/src/application/todo/todo-service.test.ts`.
  - Use in-memory fakes for repositories and runtime ports.
  - Cover:
    - creating a thread
    - enforcing at least one agent participant
    - reply linkage rules
    - mention routing
    - default-agent fallback
    - model-runtime orchestration order
- Repository tests should follow the real-instance pattern in [SurrealTodoRepository.test.ts](/Users/walker/Documents/Dev/AI Maker Lab/ai-maker-lab/packages/domain/src/infrastructure/database/SurrealTodoRepository.test.ts).
  - Use `createDbConnection({ host: 'mem://', ... })`.
  - Test DB-backed user-agent repositories against an actual in-memory SurrealDB instance, not mocks.
  - Cover:
    - create, update, and list user agents
    - persistence of `inheritsFromSystemAgentId`
    - persistence of override fields
    - any accepted id normalization rules
    - thread persistence
    - participant persistence
    - message ordering
    - `parentMessageId` reply linkage
    - run-event persistence
    - attachment persistence
- Runtime adapter tests should focus on the infrastructure AI SDK layer.
  - Verify model registry lookup.
  - Verify hook application order.
  - Verify normalized stream-event translation.
  - Mock AI SDK call boundaries only at the infrastructure edge, not in application use-case tests.
- Transport adapter tests should stay thin.
  - Verify HTTP handlers and RPC handlers delegate to application services.
  - Verify the emitted web and desktop stream payloads share the same normalized message-part contract.
  - Verify agent-list transport returns the unified resolved list and never leaks raw system JSON or raw DB storage shape.

## Acceptance Criteria

- The plan clearly keeps shared, application, infrastructure, and app-adapter responsibilities separate.
- The agent catalog is explicitly modeled as backend raw JSON system definitions plus DB-backed user agents merged by an application service.
- Chat repositories are planned to be tested against a real in-memory SurrealDB instance where DB persistence is involved.
- Application-layer merge behavior is planned to be tested with in-memory fakes, not real database instances.
- Web and desktop handlers remain thin and return one resolved agent shape to the controller/UI layer.

## Dependencies

- `01-model-card-handler.md` must define stable `SystemAgentDefinition`, `StoredUserAgent`, `ResolvedAgentProfile`, `ModelCard`, and `ModelHandler` contracts first.
- SurrealDB access should reuse the existing database client conventions from `packages/domain/src/infrastructure/database`.
- Web streaming should align with [AI SDK UI Overview](https://ai-sdk.dev/docs/ai-sdk-ui/overview).
- Model/provider resolution should align with [Provider & Model Management](https://ai-sdk.dev/docs/ai-sdk-core/provider-management).

## Risks / Notes

- The biggest risk is letting system JSON format leak into the frontend. Only resolved agents should cross the controller boundary.
- Stream persistence can become noisy if every low-level SDK event is stored raw; persist normalized app events only.
- Desktop RPC must match the same message-part contract the web stream uses or the page model will drift.
- Routing, agent merging, model execution, and hook logic must remain in application services, not in HTTP handlers, RPC adapters, or repositories.
