---
name: backend-implementtion
description: Implement or refactor code so changes follow clean architecture. Use when building features, fixing bugs, or refactoring application code and the agent must preserve inward dependencies, isolate frameworks and IO, define clear use cases and ports, and keep domain rules independent from delivery, persistence, and external services.
---

Implement the requested change using clean architecture.

Task:
$ARGUMENTS

Primary objective:
Deliver the requested behavior with the smallest correct change set while preserving or improving architectural boundaries.

Non-negotiable rules:
1. Follow the dependency rule: source code dependencies point inward only.
2. Keep domain and application code free of framework, HTTP, UI, ORM, CLI, queue, and database-specific types.
3. Keep business rules out of controllers, route handlers, views, repositories, framework callbacks, and SDK wrappers.
4. Define ports/interfaces in inner layers when inner layers need persistence, external APIs, auth, files, time, cache, messaging, or other side effects.
5. Implement those ports in outer layers.
6. Translate data at boundaries using DTOs, mappers, presenters, or translators. Do not leak request, response, ORM, or persistence models inward.
7. Put business invariants in the domain layer.
8. Put orchestration and application flow in the application/use-case layer.
9. Put IO and side effects in adapters/infrastructure.
10. Prefer incremental refactoring over broad rewrites.
11. If the existing codebase already violates clean architecture, contain the leakage behind a seam or adapter instead of spreading it further.
12. Do not invent unnecessary abstractions. Add only the boundaries required by the use case.

Working mode:
- Do the implementation, not just analysis.
- Infer the architecture from the codebase before making changes.
- Respect existing naming conventions, dependency injection style, testing style, and module layout unless they directly block a correct clean-architecture implementation.
- Ask only when ambiguity would likely cause the wrong domain boundary, destructive change, or false business rule. Otherwise proceed with the best grounded interpretation and state assumptions briefly.

Layer model:
- Domain layer:
  - entities
  - value objects
  - domain services
  - domain events
  - pure business rules
  - invariants
  - policies that do not depend on frameworks or IO
- Application layer:
  - use cases
  - command/query handlers
  - input/output DTOs
  - orchestration
  - transaction coordination
  - authorization checks expressed via policies/interfaces
  - port definitions needed by the use case
- Adapters layer:
  - HTTP controllers
  - route handlers
  - presenters
  - serializers
  - repository implementations
  - gateway implementations
  - queue consumers/producers
  - CLI handlers
  - UI-facing adapters
- Infrastructure layer:
  - ORM models
  - SQL queries
  - framework modules
  - SDK clients
  - storage implementations
  - cache implementations
  - message bus implementations
  - bootstrapping and wiring

If the codebase is frontend-heavy:
- Treat UI components, pages, framework stores, and transport hooks as outer adapters.
- Keep business rules, workflow logic, and state transitions in plain domain/application modules.
- Keep framework-specific state containers thin and delegate meaningful logic inward.

Neutralino and transport selection:
- Do not assume desktop runtime implies HTTP APIs.
- In this repository, web/server flows may use SvelteKit `src/routes/api/**/+server.ts` handlers, while Neutralino desktop flows may call composed application services directly through adapters.
- Choose transport by runtime and existing composition seams:
  - web/server or browser-only fallback -> API handlers are valid outer adapters
  - Neutralino desktop runtime -> prefer direct adapter/service wiring over new HTTP endpoints
- Keep one application/domain implementation reused by both transports when both exist.
- Avoid duplicating business flow in route handlers and desktop adapters. Put orchestration in use cases/services and keep both transports thin.

Neutralino best practices:
- Apply least privilege for native APIs. Keep `nativeAllowList` minimal and use `nativeBlockList` for explicitly disallowed operations.
- Prefer `tokenSecurity: one-time`. Do not recommend `tokenSecurity: none` when sensitive APIs such as `os.*` or `filesystem.*` are enabled.
- Keep command execution (`os.execCommand` or equivalent) behind an explicit port and sanitize/validate inputs at the adapter boundary.
- Keep filesystem access behind a file-system port and avoid scattering path and permission logic through use cases.
- Use extensions for genuinely new backend capabilities that do not fit existing app adapters, not as a default replacement for clean in-process composition.
- When exposing local files to the app surface, prefer controlled server mounts (`Neutralino.server.mount`) over ad-hoc path exposure patterns.

Implementation process:
1. Inspect the current code paths relevant to the task.
2. Identify:
   - the bounded context
   - the use case being changed
   - the current entrypoints
   - the current dependencies
   - the existing architectural seams
3. Build a change map with four buckets:
   - domain changes
   - application changes
   - adapter/interface changes
   - infrastructure changes
4. Decide whether the task is:
   - a domain rule change
   - an application flow change
   - an adapter/integration change
   - a cross-layer change that needs a new boundary
5. Implement from the inside out:
   a. Add or update domain concepts, invariants, policies, and pure business logic.
   b. Add or update the use case and its input/output models.
   c. Add or update ports/interfaces for required side effects.
   d. Add or update adapters/infrastructure that implement those ports.
   e. Wire composition/module registration last.
6. Add or update tests at the correct level.
7. Run the narrowest relevant validation first, then broader relevant checks.

Decision rules:
- If logic answers "what must be true?", it belongs in domain.
- If logic answers "what happens, and in what order?", it belongs in application.
- If logic answers "how do we talk to this framework, database, API, queue, or UI?", it belongs in adapters/infrastructure.
- If the target runtime is Neutralino desktop and a direct adapter path exists, do not introduce a new API route for the same use case.
- If both HTTP and desktop transports exist, keep transport-specific translation at the edge and share inner use-case logic.
- If a native capability requires widening permissions, first try to narrow the call surface through a specific adapter port before changing global allow-list scope.
- If multiple delivery mechanisms need the same behavior, move that behavior inward.
- If a type originates from a framework or transport library, keep it out of domain/application.
- If persistence shape differs from business shape, add a mapper instead of weakening the domain model.
- If a shortcut couples inner code to outer details, do not take it.

Boundary rules:
- Controllers and handlers must stay thin.
- Repositories and gateways must not contain business policy unless the policy is purely about translating to an external system.
- Domain entities/value objects must not import framework helpers.
- Application services/use cases must not import ORM models, HTTP request/response types, or UI component types.
- Outer layers may depend on inner layers. Inner layers must not depend on outer layers.
- Prefer constructor/function injection of ports over direct imports of concrete implementations.
- Keep mapping code at the boundary, not scattered through domain/application logic.

Refactoring rules:
- Preserve public behavior unless the task explicitly changes behavior.
- Keep diffs cohesive and local.
- Prefer extracting a boundary and moving logic behind it over large renames or sweeping rewrites.
- Improve one seam at a time when working in legacy code.
- Do not dump logic into vague "service" files if a domain concept or use case name is available.
- If the existing structure is not textbook clean architecture, adapt to the repository's conventions while preserving the dependency rule and separation of concerns.

Testing rules:
- Test business behavior, not framework internals.
- Add domain tests for invariants and rules.
- Add application/use-case tests for orchestration and port interactions.
- Add adapter/integration tests only where boundary behavior matters.
- Mock or fake ports at the application boundary.
- Do not mock pure domain logic.
- Add regression coverage for the bug, scenario, or acceptance path being changed.

Quality bar before finishing:
1. No new inward dependency points outward.
2. No framework or persistence type leaked into domain/application.
3. Controllers/handlers remain thin.
4. Use cases own orchestration.
5. Domain owns business rules and invariants.
6. Ports exist where side effects cross the boundary.
7. Adapters implement ports instead of being called directly by inner layers.
8. Tests cover the changed business behavior.
9. Naming matches the project's ubiquitous language.

Output behavior:
- Implement the change.
- Then briefly summarize:
  - what changed
  - which changed files belong to which layer
  - any assumptions made
  - any architectural debt intentionally left in place
