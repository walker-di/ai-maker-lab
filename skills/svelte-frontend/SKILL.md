---
name: svelte-frontend
description: Implement or refactor Svelte and SvelteKit frontend code so changes follow clean architecture. Use when building UI features, pages, components, forms, dialogs, boards, or client workflows and the agent must separate visual elements from visual logic, keep business rules out of .svelte files, use .svelte.ts for component model logic, and preserve inward dependencies from UI toward application and domain code.
---

Implement the requested frontend change using clean architecture for Svelte/SvelteKit.

Task:
$ARGUMENTS

Primary objective:
Deliver the requested UI behavior with the smallest correct change set while preserving or improving architectural boundaries.

Repository monorepo context:
1. This repository is a Bun workspace monorepo with:
   - `apps/desktop-app`
   - `packages/ui`
   - `packages/domain`
2. Shared reusable UI belongs in `packages/ui`.
3. `apps/desktop-app` should consume shared UI from the workspace package instead of duplicating components locally.
4. Frontend code must import browser-safe shared domain code from `domain/shared`, not server entrypoints.
5. Prefer workspace package imports over relative cross-package filesystem imports.

Frontend dependency rule:
1. Visual files may depend on view-model, application, and domain code.
2. View-model files may depend on application and domain code.
3. Application code may depend on domain code and abstract ports.
4. Adapters and infrastructure may depend on inner layers.
5. Domain code must not depend on Svelte, SvelteKit, browser APIs, fetch clients, component files, route files, or UI libraries.

Non-negotiable rules:
1. Separate visual elements from visual logic.
2. `.svelte` files are for visual structure and binding only.
3. `.svelte.ts` files are for component model logic and reusable reactive UI behavior.
4. Business rules, domain invariants, and cross-screen workflow rules do not belong in `.svelte` files or `.svelte.ts` files unless they are purely presentation-specific.
5. Keep network calls, persistence calls, SDK calls, and transport details out of `.svelte` files.
6. Keep direct backend call code out of most components. Route it through application functions or adapter modules.
7. Do not leak HTTP payloads, database shapes, SDK responses, or route event objects into domain code.
8. Translate external data at the boundary using mappers, DTOs, or view-model transformers.
9. Prefer incremental refactoring over sweeping rewrites.
10. If the existing codebase already mixes layers, contain the leakage behind a boundary instead of spreading it further.

Svelte separation rule:
- A stateful or reusable interactive component should normally have a paired file:
  - `Component.svelte`
  - `Component.svelte.ts`
- Example:
  - `Modal.svelte`
  - `Modal.svelte.ts`
- Pure presentational leaf components may remain `.svelte` only if they contain no meaningful logic beyond trivial markup wiring.

What belongs in `.svelte`:
- markup
- layout structure
- classes and styling hooks
- transitions and animations
- DOM-only bindings
- snippet/render composition (use snippets by default; slots only for legacy interop)
- accessibility attributes
- binding UI events to model methods
- rendering derived values that were already prepared by the model

What belongs in `.svelte.ts`:
- reactive component state
- derived UI state
- interaction logic
- local validation for user interaction
- command methods like open, close, toggle, submit, cancel, reorder, select
- async orchestration that is specific to the component or screen
- mapping application results into display-ready state
- UI state transitions
- reusable reactive logic shared across related components

What does not belong in `.svelte.ts`:
- domain entities and domain invariants
- broad business policy
- raw HTTP client details
- direct database concerns
- route server logic
- secret handling
- user-specific server state stored at module scope

Layer model for frontend:
- Domain:
  - entities
  - value objects
  - business rules
  - invariants
  - domain services
  - pure policy
- Application:
  - use cases
  - commands and queries
  - workflow orchestration
  - UI-facing DTOs
  - ports for data, auth, analytics, files, and other side effects
- Presentation model:
  - `.svelte.ts` files
  - component models
  - page models
  - local interaction state
  - derived display state
  - event handling methods
- View:
  - `.svelte` files
  - pages, layouts, components, and visual composition
- Adapters/infrastructure:
  - HTTP clients
  - repository implementations
  - SDK wrappers
  - persistence implementations
  - browser API wrappers
  - route integrations
  - analytics adapters
  - framework wiring

Naming and file rules:
- Prefer paired naming for interactive components:
  - `Card.svelte` + `Card.svelte.ts`
  - `Modal.svelte` + `Modal.svelte.ts`
  - `BoardColumn.svelte` + `BoardColumn.svelte.ts`
- Keep model files close to the visual file they support unless the repository has a clear shared-model convention.
- If logic is shared across multiple components, extract a shared model helper in a dedicated `.svelte.ts` module or move application/domain logic into plain `.ts` modules as appropriate.
- Do not move domain/application logic into `.svelte.ts` just because the UI uses it.

Svelte 5 rules:
1. Prefer runes-based reactive logic in `.svelte.ts` for component model state.
2. Do not introduce stores merely to extract logic when a `.svelte.ts` model is sufficient.
3. Use stores only when they are genuinely the right abstraction for shared async streams or explicit subscription behavior.
4. Keep component models small, explicit, and named after the UI concept they serve.

Svelte 5 syntax contract (default for all new or touched code):
1. Props:
   - In runes-mode components, declare props with `$props()` destructuring.
   - Prefer typed props in TypeScript with a `Props` interface or inline type annotation.
   - Do not introduce new `export let` in runes-mode updates unless the user explicitly requests legacy syntax.
2. Reactivity:
   - Use `$state` for mutable reactive state.
   - Use `$derived` for derived values.
   - Use `$effect` (or `$effect.pre` when required) for side effects.
   - Avoid top-level `$:` in runes-mode updates.
3. DOM events:
   - Prefer event attributes such as `onclick`, `onchange`, `oninput`, `onkeydown`.
   - Avoid introducing new `on:` event directive syntax in modernized code.
4. Component events and communication:
   - Prefer callback props and typed function props for parent-child communication.
   - Do not introduce `createEventDispatcher` in newly touched runes-mode components.
5. Bindings:
   - In runes mode, opt in explicitly with `$bindable()` for bindable props.
   - Do not assume all props are bindable by default.
6. Composition:
   - Prefer snippet props (`{#snippet ...}` + `{@render ...}`) over new `<slot>` usage.
   - Use `children` snippet conventions when passing inline component content.
   - Avoid adding normal props named `children` when inline content is used.
   - Do not mix new snippets and legacy slots in the same API design unless migration constraints require it.

Svelte 5 quick replacement guide:
- `export let foo` -> `let { foo }: Props = $props()`
- `export let foo = 1` -> `let { foo = 1 }: Props = $props()`
- `$: doubled = count * 2` -> `let doubled = $derived(count * 2)`
- `$: { sideEffect(); }` -> `$effect(() => { sideEffect(); })`
- `on:click={handleClick}` -> `onclick={handleClick}`
- `createEventDispatcher` component events -> callback props (for example `onSave?: (value: SaveInput) => void`)
- `<slot />` composition -> snippet props and `{@render ...}` (for example `let { children } = $props();` + `{@render children?.()}`)

Legacy interop rule:
1. If a file is intentionally legacy and migration is out of scope, keep local syntax consistency and avoid mixed partial rewrites that increase risk.
2. If touching a syntax-heavy area (props/reactivity/events), migrate the touched section to Svelte 5 runes syntax in the same change when safe.
3. If touching component composition, prefer snippet-based APIs over introducing new slots.
4. Do not perform broad migration churn unless requested. Prefer minimal, behavior-preserving modernization.
5. When preserving legacy syntax temporarily, add a concise follow-up note in the handoff summary describing why migration was deferred.

Svelte 5 best-practices guardrails:
1. Prefer `$derived` over `$effect` when computing values; reserve `$effect` for true side effects.
2. Keep `$effect` blocks minimal, explicit, and cleanup-safe.
3. Do not mutate props you do not own; communicate changes via callback props or explicit bindable contracts.
4. Type component props and snippet props in TypeScript (`Props`, `Snippet` from `svelte`) for API clarity.
5. Prefer callback props for component interaction over event-dispatch patterns in new runes-mode code.
6. Avoid overusing two-way bindings; use one-way data flow and intent methods unless bidirectional sync is necessary.

SvelteKit rules:
1. Do not store user-specific or request-specific data in shared module-level server state.
2. In `apps/desktop-app`, avoid per-route `+page.ts` for client-side composition unless the repository explicitly requires an exception.
3. For client-side route initialization in `apps/desktop-app`, prefer `.svelte.ts` page models plus route-local composition helpers and adapter factories.
4. If `load` is used, keep it pure. Do not write to global state or trigger side effects from `load`.
5. Keep server-only concerns in server files and browser-only concerns out of SSR-sensitive code paths.
6. Do not let page/server transport details leak into domain or application modules.

Implementation process:
1. Inspect the relevant routes, pages, layouts, and components.
2. Identify:
   - the user-facing workflow
   - the affected screen or component boundary
   - current coupling between view, model, application, and infrastructure
   - existing seams that can be preserved
3. Build a change map with five buckets:
   - domain changes
   - application changes
   - presentation-model changes
   - view changes
   - adapter/infrastructure changes
4. Decide whether the task is mainly:
   - visual-only
   - presentation-model
   - application workflow
   - domain rule
   - integration/adaptor
   - or cross-layer
5. Implement from the inside out:
   a. Add or update domain rules if behavior changed.
   b. Add or update application use cases and ports.
   c. Add or update adapters for APIs, persistence, analytics, browser wrappers, or backend calls.
   d. Add or update the `.svelte.ts` model for the screen/component.
   e. Keep the `.svelte` file focused on rendering and event binding.
6. Wire the page or component last.
7. Add or update tests at the correct layer.
8. Run the narrowest relevant validation first, then broader checks.

Decision rules:
- If logic answers "what must be true for the business?", it belongs in domain.
- If logic answers "what happens and in what order for this user workflow?", it belongs in application.
- If logic answers "how should this screen/component behave and react?", it belongs in `.svelte.ts`.
- If logic answers "how is this rendered?", it belongs in `.svelte`.
- If logic answers "how do we talk to fetch, browser APIs, storage, analytics, or external SDKs?", it belongs in adapters/infrastructure.
- If logic needs to be reused by multiple screens and is not presentation-specific, move it out of `.svelte.ts` into application or domain modules.
- If a value is merely display formatting, keep it near the presentation boundary.
- If a component starts accumulating business decisions, extract them inward immediately.

Thin view rules:
- `.svelte` files must stay thin.
- `.svelte` files should not become the place where feature behavior is invented.
- Event handlers in `.svelte` should usually delegate to model methods rather than embed complex branching.
- Inline async blocks and multi-step submit flows in `.svelte` are a smell.
- Large computed expressions in markup are a smell.
- Data normalization inside markup is a smell.

Component model rules:
- Prefer a clear model factory, class, or exported reactive state object in `.svelte.ts`.
- Expose intent-based methods such as:
  - `open()`
  - `close()`
  - `toggle()`
  - `startEdit()`
  - `save()`
  - `archive()`
  - `assignToAi()`
- Prefer derived properties for display state rather than scattering condition logic through the markup.
- Keep DOM access out of the model unless it is truly UI-only and unavoidable.
- Keep browser APIs behind narrow wrappers when they are not purely presentational.

Page rules:
- Pages and layouts are composition roots for frontend concerns.
- Pages may create or assemble models but should not absorb domain/application logic.
- In `apps/desktop-app`, prefer route-local composition helpers or `.svelte.ts` page models over per-route `+page.ts` files for client-loaded screens.
- If route data is supplied from an allowed route file, transform it into view-ready state at the page boundary.
- Avoid giant `+page.svelte` files. Extract stateful sections into paired component/model files.

AI SDK Svelte rules:
- Use `@ai-sdk/svelte` `Chat` class for streaming chat UIs, not React hooks.
- Never destructure `Chat` properties (`let { messages } = chat` breaks reactivity). Always access via `chat.messages`, `chat.status`, etc.
- Use reactive getters for `Chat` constructor arguments that may change: `new Chat({ get id() { return threadId; } })`.
- The page model owns the `Chat` instance. The `+page.svelte` file renders from `model.chatMessages` and `model.chatStatus`.
- Keep `DefaultChatTransport` pointed at the streaming API endpoint. Keep CRUD operations (list threads, list agents) in a separate `ChatTransport` adapter.
- When switching threads, recreate the `Chat` instance with the new thread's streaming URL.

Chat UI composition rules:
- Chat UI components live in `packages/ui/src/lib/chat/` and are imported from `ui/source`.
- `ChatComposer` follows the shadcn-svelte `notion-prompt-form` pattern (InputGroup + DropdownMenu + Tooltip).
- `ChatComposer` requires `Tooltip.Provider` from `ui/source` as an ancestor in the component tree. Pages that include `ChatComposer` — even conditionally inside `{#if}` branches — must wrap content with `<Tooltip.Provider>`. A missing provider causes a context error that silently prevents the branch from rendering.
- The `packages/ui` chat types in `src/lib/chat/types.ts` are structural mirrors of domain types. Do not import `domain/shared` from `packages/ui`; domain types satisfy UI types structurally at the app boundary.
- The chat page model + composition helper pattern follows the same layout as other experiment routes (e.g. `experiments/todo`).

Lucide Svelte icon rule:
- Prefer direct per-icon imports from `@lucide/svelte/icons/<icon-name>`.
- Do not use named imports from `@lucide/svelte` as the default pattern in touched code.
- Avoid `import * as icons from '@lucide/svelte'` in normal components because it weakens the bundle/build advantages of direct imports.
- If a dynamic icon loader is truly required, keep it isolated, justify it in the change, and document the bundle-size/build-time tradeoff.

Adapter rules:
- API clients, local storage, analytics, and drag-drop/platform integrations belong in adapters.
- Components and page models should depend on adapter abstractions or thin wrappers, not raw SDK usage everywhere.
- Mapping from transport payloads to domain/application data should happen outside the view.

Testing rules:
- Test domain rules in plain unit tests.
- Test application workflows with mocked or fake ports.
- Test `.svelte.ts` presentation models for state transitions and interaction behavior.
- Test `.svelte` components for rendering, accessibility, and wiring.
- Add regression coverage for the changed scenario.
- Do not over-test framework internals.

Refactoring rules:
- Preserve user-visible behavior unless the task explicitly changes it.
- When fixing legacy code, first extract model logic out of `.svelte` into `.svelte.ts`.
- Then move non-presentation logic inward into application/domain modules if needed.
- Improve one seam at a time.
- Do not create generic `utils.ts` dumping grounds when a named domain, application, or presentation concept is available.

Quality bar before finishing:
1. Interactive components are split correctly between `.svelte` and `.svelte.ts`.
2. `.svelte` files are primarily visual.
3. `.svelte.ts` files contain presentation logic, not business policy.
4. Domain/application code is free of Svelte and browser-specific leakage.
5. No new request-specific server state is stored in shared module-level variables.
6. No side effects were introduced into `load`.
7. Backend/integration code is not scattered through component markup.
8. Touched runes-mode components use Svelte 5 props syntax (`$props`) instead of introducing `export let`.
9. Touched runes-mode components use modern event attributes (`onclick`, etc.) instead of introducing `on:`.
10. Touched runes-mode components use `$state`/`$derived`/`$effect` instead of introducing top-level `$:` statements.
11. Any legacy syntax intentionally left in place is documented briefly in the final handoff.
12. Changed behavior is covered by tests at the correct layer.
13. Naming matches the project's UI and domain language.

Output behavior:
- Implement the change.
- Then briefly summarize:
  - what changed
  - which files are view files
  - which files are `.svelte.ts` presentation-model files
  - which files are application/domain/adapters
  - any assumptions made
  - any architectural debt intentionally left in place
