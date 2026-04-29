# OpenSpec gap report: migrate-marketing-products-personas

## 1. OpenSpec framing and schema

Commands inspected:

- `bunx @fission-ai/openspec@latest status --change "migrate-marketing-products-personas" --json`
  - `schemaName`: `spec-driven`
  - `isComplete`: `true`
  - artifacts `proposal`, `specs`, `design`, `tasks`: all `done`
  - `applyRequires`: `["tasks"]`
- `bunx @fission-ai/openspec@latest instructions apply --change "migrate-marketing-products-personas" --json`
  - `changeDir`: `openspec/changes/migrate-marketing-products-personas`
  - `state`: `ready`
  - progress: `total=59`, `complete=0`, `remaining=59`
  - instruction: read context files, work through pending tasks, mark complete as you go
- Additional read-only validation: `bunx @fission-ai/openspec@latest validate migrate-marketing-products-personas --type change --no-interactive` -> `Change 'migrate-marketing-products-personas' is valid`.
- Additional verification command: `bun run check:desktop-app` -> exit 0, with 14 Svelte warnings, including marketing component warnings in `ProductForm.svelte`, `PersonaForm.svelte`, campaign/creative/story/clip forms, and `SceneList.svelte` a11y warning.

Important framing issue: OpenSpec artifact status reports complete, but implementation task status reports **0/59 complete**. Treat `isComplete=true` as spec artifact readiness only, not implementation completion.

## 2. Context files read

All context files returned by `instructions apply --json` were read:

1. `openspec/changes/migrate-marketing-products-personas/proposal.md`
2. `openspec/changes/migrate-marketing-products-personas/specs/marketing-products-personas/spec.md`
3. `openspec/changes/migrate-marketing-products-personas/design.md`
4. `openspec/changes/migrate-marketing-products-personas/tasks.md`

Additional implementation evidence inspected read-only:

- Domain/shared: `packages/domain/src/shared/marketing/product-types.ts`, `persona-types.ts`, `validation.ts`, `index.ts`
- Domain/application: `packages/domain/src/application/marketing/product-service.ts`, `persona-service.ts`, `ports.ts`, `index.ts`
- Domain/infrastructure: `packages/domain/src/infrastructure/database/marketing/SurrealProductRepository.ts`, `SurrealPersonaRepository.ts`, `packages/domain/src/infrastructure/ai/marketing/AiSdkMarketingTextGateway.ts`, `packages/domain/src/infrastructure/database/record-id.ts`
- Desktop server/API: `apps/desktop-app/src/lib/server/marketing-service.ts`, `apps/desktop-app/src/routes/api/marketing/products/+server.ts`, `products/[productId]/+server.ts`, `products/[productId]/personas/+server.ts`, `products/[productId]/personas/generate/+server.ts`, `personas/+server.ts`, `personas/[id]/+server.ts`, `products/generate/+server.ts`
- Frontend adapters/page models/pages: `apps/desktop-app/src/lib/adapters/marketing/MarketingTransport.ts`, `http-marketing-transport.ts`, route page models and pages under `apps/desktop-app/src/routes/marketing/**`
- Shared UI: `packages/ui/src/lib/marketing/products/ProductForm.svelte(.ts)`, `packages/ui/src/lib/marketing/personas/PersonaForm.svelte(.ts)`, `packages/ui/src/lib/marketing/types.ts`
- i18n message search: `apps/desktop-app/messages/{en,es,pt,ja}.json`

## 3. Requirement inventory with IDs/scenarios/tasks

### REQ-1: Marketing Products are manageable

Scenarios:

- REQ-1-S1: User creates a Product.
- REQ-1-S2: User edits a Product.
- REQ-1-S3: User deletes a Product.
- REQ-1-S4: Invalid Product input is rejected.

Primary task coverage: tasks 1-5, 7, 10, 14, 16, 20, 22, 24, 27-32, 34-35, 39-42, 47-54.

### REQ-2: Marketing Personas are associated with Products

Scenarios:

- REQ-2-S1: User creates a Persona for a Product.
- REQ-2-S2: Product Persona list is scoped.
- REQ-2-S3: Persona requires an existing Product.
- REQ-2-S4: User edits a Persona.
- REQ-2-S5: User deletes a Persona.

Primary task coverage: tasks 1-5, 8, 11, 14, 17, 20, 22, 25, 27-34, 36, 39, 42-54.

### REQ-3: Persona generation uses an application port

Scenarios:

- REQ-3-S1: User generates a Persona draft.
- REQ-3-S2: Persona generation provider fails.
- REQ-3-S3: Live AI providers are not required for automated tests.

Primary task coverage: tasks 9, 12, 14, 22-23, 26, 28-34, 42-49, 51-52.

### REQ-4: Marketing persistence uses SurrealDB repositories

Scenarios:

- REQ-4-S1: Repository tests use isolated `mem://` databases.
- REQ-4-S2: Repository outputs are browser-safe domain objects.

Primary task coverage: tasks 15-21, 50, 56-57.

### REQ-5: Marketing APIs are thin adapters

Scenarios:

- REQ-5-S1: API route handles Product creation.
- REQ-5-S2: API route handles invalid input.
- REQ-5-S3: API route does not construct provider/database details inline.

Primary task coverage: tasks 22-28, 56-58.

### REQ-6: Frontend composition uses app-local adapters and page models

Scenarios:

- REQ-6-S1: Product page loads through a transport adapter.
- REQ-6-S2: Persona page handles errors through model state.

Primary task coverage: tasks 29-34, 39-41, 46, 51.

### REQ-7: Marketing UI is localized and reusable where appropriate

Scenarios:

- REQ-7-S1: Marketing UI uses localized strings.
- REQ-7-S2: Shared UI does not import domain package.

Primary task coverage: tasks 35-46, 55-56.

### REQ-8: First-slice validation covers architecture seams

Scenarios:

- REQ-8-S1: Validation commands pass for the slice.

Primary task coverage: tasks 5, 14, 20, 28, 31, 34, 47-54.

## 4. Declared completion status from tasks

Declared task completion from `instructions apply --json`:

- Total tasks: 59
- Complete: 0
- Remaining: 59
- Every task ID `1` through `59` is `done: false`.

This is a **High** process/compliance gap if implementation work is present but OpenSpec tasks were not updated, because parent reviewers cannot rely on task checkboxes to know what is complete.

## 5. Acceptance criteria that need implementation verification

### Critical gaps

1. **REQ-8 validation coverage appears absent.**
   - Evidence: `find packages/domain apps/desktop-app packages/ui -type f ...` found no marketing/product/persona unit or e2e test files; only unrelated e2e tests such as `apps/desktop-app/e2e/chat/chat.e2e.ts`, `demo.e2e.ts`, RTS/platformer tests.
   - Evidence: `rg -n "describe\(|test\(|it\(" ... | rg -i "marketing|product|persona"` returned no matching test definitions.
   - Missing acceptance: shared validation tests, application tests, SurrealDB `mem://` repository tests, adapter/page-model tests, Product/Persona CRUD e2e, Persona generation e2e.

2. **REQ-2-S3 Persona creation does not enforce existing Product association.**
   - Evidence: `CreatePersonaDtoSchema` in `packages/domain/src/shared/marketing/validation.ts` has `productId: z.string().optional()`.
   - Evidence: `Persona.productId?: string` in `packages/domain/src/shared/marketing/persona-types.ts`.
   - Evidence: `PersonaService.create(dto)` in `packages/domain/src/application/marketing/persona-service.ts` directly calls `this.personas.create(dto)`; it has no Product repository dependency and cannot verify Product existence.
   - Evidence: `apps/desktop-app/src/routes/api/marketing/personas/+server.ts` posts `body` directly to `personaService.create(body)`.
   - Evidence: `apps/desktop-app/src/routes/api/marketing/products/[productId]/personas/+server.ts` writes `{ ...body, productId: params.productId }` but does not check `productService.get(productId)`.
   - Impact: unknown Product IDs and unscoped Personas can be persisted, violating “Persona requires an existing Product”.

3. **REQ-3-S3 automated generation likely requires live provider behavior.**
   - Evidence: `apps/desktop-app/src/lib/server/marketing-service.ts` always constructs `new AiSdkMarketingTextGateway(parseTextModelConfig())` and defaults to Anthropic model config.
   - Evidence: `AiSdkMarketingTextGateway` imports `@ai-sdk/anthropic`, `@ai-sdk/openai`, and `@ai-sdk/google`, and `generatePersonas()` calls `generateObject()`.
   - Evidence: no marketing e2e helper exists at `apps/desktop-app/e2e/marketing/helpers.ts` and no generation test files were found.
   - Impact: no evidence that automated tests use a mock provider at the application port boundary or avoid live Anthropic/OpenAI/Gemini calls.

### High gaps

4. **Spec non-goals appear exceeded by a broad migration beyond Products/Personas.**
   - Evidence: API routes exist for campaigns, canvas templates, clips, creatives, BGM, scenes, stories, strategies, transitions, upload, and exports under `apps/desktop-app/src/routes/api/marketing/**`.
   - Evidence: domain services/repositories exist for `campaign`, `creative`, `story`, `scene`, `clip`, `bgm`, `canvas-template`, `strategy`, `video-export` under `packages/domain/src/application/marketing/**` and `packages/domain/src/infrastructure/database/marketing/**`.
   - Evidence: server composition constructs `ReplicateMarketingMediaGateway`, `AzureSpeechNarrationGateway`, and `FfmpegMarketingVideoExporter` in `apps/desktop-app/src/lib/server/marketing-service.ts`.
   - Spec non-goals explicitly exclude canvas editor, video export/ffmpeg, campaigns, strategies, stories, scenes, clips, BGM, transitions, canvas templates, and source debug/test routes.

5. **REQ-7-S1 localization is not implemented for visible marketing UI strings.**
   - Evidence: `rg -n "Marketing|Product|Persona|Create product|New product|Marketing Manager" apps/desktop-app/messages/*.json` returned no matches.
   - Evidence: `apps/desktop-app/src/routes/marketing/products/+page.svelte`, `personas/+page.svelte`, and `products/[productId]/+page.svelte` contain inline visible English strings like `Marketing Products`, `New product`, `No products yet`, `Personas are scoped to this product`, `Generate`, and `Loading personas…`.
   - Evidence: `packages/ui/src/lib/marketing/products/ProductForm.svelte` and `personas/PersonaForm.svelte` contain inline labels, placeholders, validation messages, and button text.

6. **REQ-4 deletion semantics are not explicit or enforced.**
   - Evidence: no README files were found under `packages/domain/src/shared/marketing`, `packages/domain/src/application/marketing`, or `packages/domain/src/infrastructure/database/marketing`.
   - Evidence: `SurrealProductRepository.delete(id)` directly calls `this.db.delete(createRecordId(TABLE, id))` and does not reject deletion with child Personas or cascade/test it.
   - Impact: task 18 and design decision 4 are not satisfied; behavior with associated Personas is undocumented and unverified.

7. **REQ-5-S2 invalid input is not consistently controlled by domain/application validation.**
   - Evidence: API Product `POST` reads `const body = await request.json(); return json(await productService.create(body), { status: 201 })` without parsing with `CreateProductDtoSchema`.
   - Evidence: `ProductService.create(dto)` directly calls repository without validation.
   - Evidence: `SurrealProductRepository.create(data)` writes `CREATE marketing_product CONTENT $data`.
   - Evidence: Product domain schema only requires `name`, while UI form requires name, description, and target audience. API clients can bypass UI-only validation.

### Medium gaps

8. **Shared domain structure does not match task/request folder shape.**
   - Evidence: files are flat under `packages/domain/src/shared/marketing/product-types.ts`, `persona-types.ts`, and `validation.ts`, not under `products/**` and `personas/**` as tasks 2-3 specify.
   - This may be acceptable if intentional, but it weakens the requested per-subdomain boundary/readability.

9. **Browser-safe shared validation imports `zod`, but required trimming/default behavior is incomplete.**
   - Evidence: `CreateProductDtoSchema` uses `z.string().min(1)` but no `.trim()`; whitespace-only names can pass unless trimmed elsewhere.
   - Evidence: `CreatePersonaDtoSchema` does not require `productId` and does not trim string fields.
   - Impact: tasks require trimming/defaults and Product association invariants.

10. **Product/Persona generation use-case contract is ambiguous and only persisted generation is implemented.**
    - Evidence: spec allows “generated Persona draft or persisted generated Persona according to the use-case contract”.
    - Evidence: `PersonaService.generateForProduct()` always persists generated Personas via `this.personas.create(...)`.
    - Unknown: whether persisted generated Personas are the intended first-slice contract; no README/design code contract or tests confirm this.

11. **Frontend adapter/page model seam mostly exists, but raw navigation/path helpers include future/nonexistent routes.**
    - Evidence: page models call `transport.catalog.*` and `transport.ai.generatePersonas(...)`; raw `/api/marketing` URL construction is isolated in `apps/desktop-app/src/lib/adapters/marketing/http-marketing-transport.ts`.
    - Evidence: `apps/desktop-app/src/lib/adapters/marketing/marketing-navigation.ts` contains routes like `/marketing/products/new`, `/marketing/products/:id/edit`, campaigns, strategies, settings, and deep creative/story routes that are outside the first-slice route evidence.
    - Severity is Medium unless these helpers are public user paths.

### Low / positive evidence

12. **API routes do not appear to import Drizzle/SQLite/provider SDK clients directly.**
    - Evidence: `rg` for Drizzle/SQLite/provider SDK strings in marketing API routes found no Drizzle/SQLite route imports; API routes import `$lib/server/marketing-service`.
    - Caveat: provider SDK clients are still created by server composition/infrastructure for generation.

13. **Shared UI does not appear to import `packages/domain`.**
    - Evidence: `rg -n "from ['\"](domain|domain/application|domain/infrastructure)['\"]" packages/ui/src/lib/marketing` returned no matches.
    - Evidence: `packages/ui/src/lib/marketing/types.ts` explicitly mirrors domain-like types locally.

14. **Lucide import style is compliant in inspected marketing files.**
    - Evidence: `rg` found no `from '@lucide/svelte'` or wildcard icon import in marketing routes/components; files use direct per-icon imports such as `@lucide/svelte/icons/plus`.

15. **`bun run check:desktop-app` passes but with warnings relevant to Svelte 5/a11y quality.**
    - Evidence: exit 0, `svelte-check found 0 errors and 14 warnings`, including marketing forms capturing initial prop values and `SceneList.svelte` drag/drop static element a11y warning.

## 6. Ambiguities/unknowns in the spec

- **Required Product fields are not enumerated.** UI requires name, description, and target audience; domain schema requires only name. Parent should confirm the canonical Product required fields.
- **Required Persona fields are not fully enumerated.** UI requires name, age, occupation, description; domain schema requires name, ageRange, gender; Product association requirement implies `productId` should be required for create.
- **Generated Persona contract is flexible.** Spec allows draft or persisted generated Persona “according to the use-case contract”, but no explicit contract file was found.
- **Product deletion policy is intentionally undecided in the spec.** Design says choose cascade or reject-with-children, prefer reject; implementation currently deletes without explicit policy.
- **Broad implementation may be existing work, not necessarily from this change.** It still conflicts with the first-slice non-goals unless intentionally accepted by parent.
- **No browser/e2e run, screenshots, or network observations were captured by this subagent.** Evidence is CLI/file inspection only.
- **Task status is ambiguous.** `status --json` says artifacts complete, while `instructions apply --json` says 0/59 implementation tasks complete.

## 7. Requirement-to-evidence checklist for the parent

| Requirement/scenario | Current evidence | Gap classification | Parent verification needed |
|---|---|---:|---|
| REQ-1-S1 Product create | `POST /api/marketing/products`, `ProductService.create`, `SurrealProductRepository.create`, products page model exist | Medium | Verify valid create persists and UI list updates without reload; add/inspect tests. |
| REQ-1-S2 Product edit | `PUT /api/marketing/products/[productId]`, `ProductService.update`, page model `saveProduct` exist | Medium | Verify not-found/error mapping and UI detail/list refresh. |
| REQ-1-S3 Product delete | `DELETE /api/marketing/products/[productId]`, repository delete exist | High | Decide/test child Persona deletion policy; verify deleted lookup 404. |
| REQ-1-S4 Invalid Product rejected | UI validates, but API/service/repo do not parse shared schema; domain required fields differ | High | Add domain/application/API validation evidence and tests. |
| REQ-2-S1 Persona create for Product | Product-scoped API route exists | Critical | Enforce existing Product before create. |
| REQ-2-S2 Scoped Persona list | `findByProductId` and product detail page model `listPersonas(productId)` exist | Medium | Add tests proving other Product Personas are excluded. |
| REQ-2-S3 Persona requires existing Product | `productId` optional and no Product existence check in service/API/repo | Critical | Implement/verify not-found or validation error and no persistence. |
| REQ-2-S4 Persona edit | `PUT /api/marketing/personas/[id]`, page models exist | Medium | Verify update validation and Product association invariants. |
| REQ-2-S5 Persona delete | `DELETE /api/marketing/personas/[id]`, page models exist | Medium | Verify Product-scoped list removes deleted Persona. |
| REQ-3-S1 Generate Persona | `POST /api/marketing/products/[productId]/personas/generate` checks Product exists and calls `generateForProduct` | High | Confirm use-case contract: draft vs persisted generated Persona; add tests. |
| REQ-3-S2 Provider failure controlled | `toMarketingErrorResponse` maps generic errors; no specific use-case failure mapping found | High | Verify controlled error type/state and no partial invalid persistence. |
| REQ-3-S3 No live providers in tests | No marketing tests/helpers found; default server comp uses AI SDK gateway | Critical | Add mock provider tests/e2e; avoid live API calls in CI. |
| REQ-4-S1 Surreal repo `mem://` tests | No marketing repository tests found | Critical | Add tests with unique namespace/database and `afterEach` close. |
| REQ-4-S2 No RecordId leaks | Repositories normalize IDs with `normalizeRecordIdValue`; no tests found | Medium | Add recursive `assertNoRecordIdLeaks` coverage. |
| REQ-5-S1 Thin Product API | Product API delegates to service | Low/Medium | Keep routes thin; verify no business logic duplication. |
| REQ-5-S2 Invalid HTTP input | API routes pass raw body; validation not centralized | High | Parse schemas/map 4xx consistently. |
| REQ-5-S3 No DB/provider inline in routes | API routes import server composition only; no Drizzle/SQLite found | Low | Continue checking all marketing routes, especially broad extra routes. |
| REQ-6-S1 Product page via transport | Page model uses `transport.catalog`; raw API URLs isolated in HTTP transport | Low | Add page model/adapter tests. |
| REQ-6-S2 Persona error state | Page models expose `errorMessage`; no tests found | Medium | Add tests for loading/saving/deleting/generation errors. |
| REQ-7-S1 Localized strings | No marketing keys in message JSON; many inline English strings | High | Add message keys in `en`, `es`, `pt`, `ja`; replace inline visible strings. |
| REQ-7-S2 Shared UI no domain import | No domain imports found in `packages/ui/src/lib/marketing`; local type mirrors exist | Low | Keep package boundary. |
| REQ-8-S1 Validation commands/tests pass | OpenSpec validate passes; `check:desktop-app` passes with warnings; no marketing tests/e2e found | Critical | Add/run targeted domain, desktop unit, and marketing e2e tests. |
| Non-goals | Broad routes/services for campaigns/canvas/stories/scenes/clips/BGM/transitions/upload/export exist | High | Decide whether to revert/ignore/exempt broad migration from this first slice. |
