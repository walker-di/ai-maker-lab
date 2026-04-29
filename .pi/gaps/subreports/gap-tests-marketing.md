# Test Coverage Gap Report — migrate-marketing-products-personas

## 1. Test areas inspected

OpenSpec change inspected:
- `openspec/changes/migrate-marketing-products-personas/specs/marketing-products-personas/spec.md`
- `openspec/changes/migrate-marketing-products-personas/tasks.md`
- `openspec/changes/migrate-marketing-products-personas/design.md`

Implementation/test areas inspected:
- Shared domain marketing types/validation: `packages/domain/src/shared/marketing/**`
- Application services and ports: `packages/domain/src/application/marketing/**`
- SurrealDB repositories: `packages/domain/src/infrastructure/database/marketing/**`
- AI gateway boundary: `packages/domain/src/infrastructure/ai/marketing/AiSdkMarketingTextGateway.ts`
- Desktop server composition/API routes: `apps/desktop-app/src/lib/server/marketing-service.ts`, `apps/desktop-app/src/routes/api/marketing/**`
- App-local frontend adapters/page models/routes: `apps/desktop-app/src/lib/adapters/marketing/**`, `apps/desktop-app/src/routes/marketing/**`
- Shared UI marketing components: `packages/ui/src/lib/marketing/**`
- i18n message files: `apps/desktop-app/messages/{en,es,pt,ja}.json`
- Existing unit/browser/e2e tests in `packages/domain/src/**`, `apps/desktop-app/src/**`, `packages/ui/src/**`, `apps/desktop-app/e2e/**`

Assumption: OpenSpec scenarios do not have explicit stable IDs, so this report refers to them as `Requirement / Scenario` names from `spec.md`.

## 2. Existing tests and commands found

Existing relevant marketing tests found: **none**.

Evidence:
- `find packages/domain/src apps/desktop-app/src packages/ui/src apps/desktop-app/e2e ... | grep -i marketing` returned no marketing test files.
- `rg -n "marketing|Product|Persona|persona|product" ... --glob '*test.ts' --glob '*.e2e.ts' --glob '*browser.test.ts'` returned no relevant marketing test hits.
- Existing e2e files are only:
  - `apps/desktop-app/e2e/chat/chat-streaming.e2e.ts`
  - `apps/desktop-app/e2e/chat/chat.e2e.ts`
  - `apps/desktop-app/e2e/demo.e2e.ts`
  - `apps/desktop-app/e2e/home.e2e.ts`
  - `apps/desktop-app/e2e/platformer/editor.e2e.ts`
  - `apps/desktop-app/e2e/platformer/platformer.e2e.ts`
  - `apps/desktop-app/e2e/rts/rts.e2e.ts`

Targeted discovery commands run:
- `bunx @fission-ai/openspec@latest validate migrate-marketing-products-personas --type change --no-interactive`
  - Result: passed, `Change 'migrate-marketing-products-personas' is valid`.
- `bun test packages/domain/src/shared/marketing packages/domain/src/application/marketing packages/domain/src/infrastructure/database/marketing`
  - Result: failed with no matching tests: `The following filters did not match any test files`.
- `bun run --filter desktop-app test:unit -- --run src/routes/marketing src/lib/adapters/marketing`
  - Result: failed with no matching tests: `No test files found` for filters `src/routes/marketing`, `src/lib/adapters/marketing`.
- `cd apps/desktop-app && bun run test:e2e -- e2e/marketing`
  - Result: failed with `No tests found`.

Useful existing validation scripts:
- Root: `bun run check:desktop-app`
- Desktop unit: `bun run --filter desktop-app test:unit`
- Desktop e2e: `cd apps/desktop-app && bun run test:e2e`
- UI browser tests: `bun run --filter ui test:browser`
- OpenSpec validation: `bunx @fission-ai/openspec@latest validate migrate-marketing-products-personas --type change --no-interactive`

## 3. Requirements covered by tests

Automated coverage for the OpenSpec marketing slice is effectively **0%**.

Only OpenSpec structural validation is covered by a command that passed:
- `bunx @fission-ai/openspec@latest validate migrate-marketing-products-personas --type change --no-interactive`

No automated tests currently cover:
- Product CRUD scenarios.
- Product invalid input scenarios.
- Persona Product association/scoping scenarios.
- Persona missing Product behavior.
- Persona CRUD scenarios.
- Persona generation success/failure through an application port.
- SurrealDB marketing repository behavior with `mem://` isolation and RecordId leak prevention.
- API route thin-adapter behavior and controlled 4xx errors.
- Frontend adapter/page-model behavior.
- Shared UI marketing forms/cards/lists.
- Marketing i18n key coverage for `en`, `es`, `pt`, `ja`.
- Any Product/Persona Playwright e2e flow.

## 4. Requirements not covered or weakly covered

### Critical — No repository tests for required SurrealDB persistence seam

OpenSpec scenarios:
- `Marketing persistence uses SurrealDB repositories / Repository tests use isolated mem databases`
- `Marketing persistence uses SurrealDB repositories / Repository outputs are browser-safe domain objects`

Evidence:
- No test files under `packages/domain/src/infrastructure/database/marketing/**`.
- Targeted command `bun test packages/domain/src/shared/marketing packages/domain/src/application/marketing packages/domain/src/infrastructure/database/marketing` found no tests.
- Implementations exist in:
  - `packages/domain/src/infrastructure/database/marketing/SurrealProductRepository.ts`
  - `packages/domain/src/infrastructure/database/marketing/SurrealPersonaRepository.ts`
- Repositories normalize IDs via `normalizeRecordIdValue(String(record.id))`, but no tests verify no `RecordId` leaks.
- `SurrealProductRepository.delete()` deletes directly and does not document/test Product deletion behavior when Personas exist, despite `design.md` requiring an explicit documented/tested choice.

### Critical — No application service tests for Product/Persona use cases or Product association invariants

OpenSpec scenarios:
- `Marketing Products are manageable / User creates a Product`
- `Marketing Products are manageable / User edits a Product`
- `Marketing Products are manageable / User deletes a Product`
- `Marketing Products are manageable / Invalid Product input is rejected`
- `Marketing Personas are associated with Products / User creates a Persona for a Product`
- `Marketing Personas are associated with Products / Product Persona list is scoped`
- `Marketing Personas are associated with Products / Persona requires an existing Product`
- `Marketing Personas are associated with Products / User edits a Persona`
- `Marketing Personas are associated with Products / User deletes a Persona`

Evidence:
- No tests under `packages/domain/src/application/marketing/**`.
- `packages/domain/src/application/marketing/persona-service.ts` constructor only receives `IPersonaRepository` and `IMarketingTextGenerationGateway`; `create(dto)` delegates directly to `this.personas.create(dto)` and cannot verify the Product exists.
- `packages/domain/src/shared/marketing/validation.ts` defines `CreatePersonaDtoSchema.productId` as optional, weakening the Product association requirement.
- `packages/domain/src/application/marketing/product-service.ts` imports `uuidv4` but does not use it; not a coverage issue itself, but suggests the service has not been exercised by tests/lint-focused validation.

### Critical — No automated tests for Persona generation success/failure or no-live-provider guarantee

OpenSpec scenarios:
- `Persona generation uses an application port / User generates a Persona draft`
- `Persona generation uses an application port / Persona generation provider fails`
- `Persona generation uses an application port / Live AI providers are not required for automated tests`

Evidence:
- No tests cover `PersonaService.generateForProduct()` in `packages/domain/src/application/marketing/persona-service.ts`.
- `apps/desktop-app/src/lib/server/marketing-service.ts` always composes `new AiSdkMarketingTextGateway(parseTextModelConfig())`, defaulting to `anthropic:claude-3-5-haiku-20241022`.
- `packages/domain/src/infrastructure/ai/marketing/AiSdkMarketingTextGateway.ts` imports live AI SDK providers (`@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`) and calls `generateObject`/`generateText`.
- No test-only composition, mock provider, or route test verifies generation can be exercised without live Anthropic/OpenAI/Google credentials.
- No tests verify provider failures map to controlled use-case errors or that no partial invalid Persona is persisted.

### High — No API route tests for thin adapters, invalid input, not-found, or generation failure

OpenSpec scenarios:
- `Marketing APIs are thin adapters / API route handles Product creation`
- `Marketing APIs are thin adapters / API route handles invalid input`
- `Marketing APIs are thin adapters / API route does not construct provider/database details inline`
- Persona API portions of Product/Persona CRUD and missing Product scenarios.

Evidence:
- No tests under `apps/desktop-app/src/routes/api/marketing/**`.
- `apps/desktop-app/src/routes/api/marketing/products/+server.ts` parses `await request.json()` and calls `productService.create(body)` with no schema parse in the route.
- `apps/desktop-app/src/routes/api/marketing/products/[productId]/personas/+server.ts` posts directly to `personaService.create({ ...body, productId: params.productId })`; no route test verifies unknown Product returns 404/400 and no Persona persists.
- `apps/desktop-app/src/routes/api/marketing/personas/+server.ts` exposes global Persona create/list; no test asserts whether this is allowed by the Product-scoped workflow.
- `apps/desktop-app/src/lib/server/marketing-service.ts` composes repositories and live provider gateways centrally, but no route tests or architecture tests guard against future route-level provider/database imports.

### High — No frontend adapter or page-model unit tests

OpenSpec scenarios:
- `Frontend composition uses app-local adapters and page models / Product page loads through a transport adapter`
- `Frontend composition uses app-local adapters and page models / Persona page handles errors through model state`
- CRUD UI update portions of Product/Persona requirements.

Evidence:
- No tests under:
  - `apps/desktop-app/src/lib/adapters/marketing/**`
  - `apps/desktop-app/src/routes/marketing/**`
- Targeted desktop unit command found no test files for `src/routes/marketing` or `src/lib/adapters/marketing`.
- Page models exist and use injected transport:
  - `apps/desktop-app/src/routes/marketing/products/products-page.svelte.ts`
  - `apps/desktop-app/src/routes/marketing/products/[productId]/product-detail-page.svelte.ts`
  - `apps/desktop-app/src/routes/marketing/personas/personas-page.svelte.ts`
- Error state exists as `errorMessage`, but no tests verify load/save/delete/generation errors surface in model state or that successful create/edit/delete refreshes lists without page reload.
- Raw `/api/marketing` URLs are isolated in `apps/desktop-app/src/lib/adapters/marketing/http-marketing-transport.ts`, but no tests guard that URL construction stays out of page models/shared UI.

### High — No Playwright e2e coverage for required first-slice flow

OpenSpec scenario:
- `First-slice validation covers architecture seams / Validation commands pass for the slice`

Evidence:
- No `apps/desktop-app/e2e/marketing/**` files.
- `cd apps/desktop-app && bun run test:e2e -- e2e/marketing` failed with `No tests found`.
- Existing e2e coverage is for chat, home, platformer, and RTS only.
- No browser-level test covers the minimum Product/Persona CRUD path, Product-scoped Persona list behavior, invalid input UI, or mocked Persona generation.

### High — No UI/component/browser tests for marketing forms/lists/cards

OpenSpec scenarios:
- `Marketing UI is localized and reusable where appropriate / Shared UI does not import domain package`
- UI portions of Product/Persona create/edit/delete/invalid-input scenarios.

Evidence:
- Marketing UI components exist in `packages/ui/src/lib/marketing/**`, including:
  - `packages/ui/src/lib/marketing/products/ProductForm.svelte`
  - `packages/ui/src/lib/marketing/products/ProductCard.svelte`
  - `packages/ui/src/lib/marketing/personas/PersonaForm.svelte`
  - `packages/ui/src/lib/marketing/personas/PersonaCard.svelte`
- No `*.browser.test.ts` files exist under `packages/ui/src/lib/marketing/**`.
- `packages/ui/src/lib/marketing/types.ts` mirrors domain types locally, and `rg` found no `domain` imports in `packages/ui/src/lib/marketing`; this is good but unguarded by tests.
- Form validation currently lives in Svelte form models (`ProductForm.svelte.ts`, `PersonaForm.svelte.ts`) with inline English errors, but no browser tests verify accessible validation behavior, required fields, submit payloads, or edit mode.

### High — No i18n test or static check for required marketing strings/locales

OpenSpec scenario:
- `Marketing UI is localized and reusable where appropriate / Marketing UI uses localized strings`

Evidence:
- `rg -n "marketing|Marketing|product|Product|persona|Persona" apps/desktop-app/messages ...` found no marketing keys in `apps/desktop-app/messages/{en,es,pt,ja}.json` beyond unrelated generic product wording.
- Marketing routes/components contain inline English visible strings, e.g.:
  - `apps/desktop-app/src/routes/marketing/+page.svelte`
  - `apps/desktop-app/src/routes/marketing/products/+page.svelte`
  - `apps/desktop-app/src/routes/marketing/products/[productId]/+page.svelte`
  - `apps/desktop-app/src/routes/marketing/personas/+page.svelte`
  - `packages/ui/src/lib/marketing/products/ProductForm.svelte`
  - `packages/ui/src/lib/marketing/personas/PersonaForm.svelte`
- No test/static check ensures message keys exist for `en`, `es`, `pt`, and `ja` or that visible marketing strings come from paraglide.

### Medium — Shared validation tests are missing and implementation validation appears weak

OpenSpec scenarios:
- `Marketing Products are manageable / Invalid Product input is rejected`
- Product/Persona shared model and validation tasks in `tasks.md` section 1.

Evidence:
- No tests under `packages/domain/src/shared/marketing/**`.
- `packages/domain/src/shared/marketing/validation.ts` uses `z.string().min(1)` but does not trim strings, so whitespace-only values may pass unless UI catches them.
- Product schema requires only `name`; UI form model also requires `description` and `targetAudience`, creating an untested mismatch between API/domain and UI validation.
- Persona schema makes `productId` optional, while OpenSpec requires Personas associated with a Product and creation for unknown Product to fail.

### Medium — Test command surface is incomplete for domain package

Evidence:
- `packages/domain/package.json` has only `dev`; no `test` script.
- Existing domain tests are run via direct `bun test ...` commands today, but no package script documents the intended marketing-targeted command.
- This increases risk that repository/application/shared marketing tests are not run consistently once added.

### Medium — No manual/browser acceptance checklist or screenshot evidence

OpenSpec/user audit requested concrete browser/manual evidence where applicable.

Evidence:
- No screenshots, Playwright traces, or documented manual route checks were found for:
  - `/marketing`
  - `/marketing/products`
  - `/marketing/products/[productId]`
  - `/marketing/personas`
- No console/network observations exist proving UI calls only app-local transport methods or proving list updates happen without reload.

### Low — OpenSpec task checklist is not updated to reflect current test status

Evidence:
- `openspec/changes/migrate-marketing-products-personas/tasks.md` still has all test-related boxes unchecked.
- This is accurate for tests, but there is no nearby note summarizing that implementation files exist while tests are absent.

## 5. Recommended tests to add/fix

Smallest meaningful test additions, in priority order:

1. **Shared validation tests** — `packages/domain/src/shared/marketing/validation.test.ts`
   - Product required fields, trimming/whitespace rejection/default arrays.
   - Persona required fields and Product association invariant.
   - Invalid URL and invalid enum cases.

2. **Surreal repository tests** — suggested files:
   - `packages/domain/src/infrastructure/database/marketing/SurrealProductRepository.test.ts`
   - `packages/domain/src/infrastructure/database/marketing/SurrealPersonaRepository.test.ts`
   - Use real `createDbConnection({ host: 'mem://' })`, unique namespace/database per `beforeEach`, and close in `afterEach`.
   - Cover create/list/find/update/delete, Product-scoped Persona list exclusion, not-found lookup after delete, RecordId leak assertions, and documented Product deletion-with-children behavior.

3. **Application service tests** — suggested file `packages/domain/src/application/marketing/marketing-services.test.ts`
   - Product CRUD.
   - Persona CRUD with existing Product.
   - Unknown Product rejected and no Persona persisted.
   - Scoped Persona listing excludes other Products.
   - Persona generation success uses mock `IMarketingTextGenerationGateway`, persists only valid generated Personas.
   - Persona generation provider failure maps to controlled error and persists no partial invalid Persona.
   - Prefer real Surreal repositories for DB-backed service tests; mock only the AI provider port.

4. **API route tests/smoke tests** — suggested files under `apps/desktop-app/src/routes/api/marketing/**`
   - Product create/list/get/update/delete happy paths.
   - Invalid input returns controlled 4xx JSON.
   - Persona create/list for Product, unknown Product returns 404/400 and no persistence.
   - Generation route uses mock provider/composition and no live provider credentials.
   - Architecture guard: route files do not import Drizzle/SQLite/provider SDK clients directly.

5. **App-local transport tests** — `apps/desktop-app/src/lib/adapters/marketing/http-marketing-transport.test.ts`
   - Verify raw URL paths/methods/bodies for Product CRUD, Product-scoped Personas, generation.
   - Verify non-2xx JSON errors throw useful errors.
   - Verify not-found mapping behavior.

6. **Page-model unit tests** — suggested files:
   - `apps/desktop-app/src/routes/marketing/products/products-page.test.ts`
   - `apps/desktop-app/src/routes/marketing/products/[productId]/product-detail-page.test.ts`
   - `apps/desktop-app/src/routes/marketing/personas/personas-page.test.ts`
   - Use fake app-local transport objects only; no raw `/api/**` in tests/page models.
   - Cover initial load, create/edit/delete refresh without reload, validation/transport errors in `errorMessage`, Persona generation success/failure.

7. **UI browser/component tests** — suggested files under `packages/ui/src/lib/marketing/**`
   - `ProductForm.browser.test.ts`
   - `PersonaForm.browser.test.ts`
   - Card/list rendering tests as needed.
   - Cover accessible labels/errors, required fields, submit payloads, edit mode, Product selector behavior, and no `domain` imports in `packages/ui` marketing components.

8. **Marketing e2e tests** — suggested files:
   - `apps/desktop-app/e2e/marketing/helpers.ts`
   - `apps/desktop-app/e2e/marketing/products-personas.e2e.ts`
   - Run against `SURREAL_HOST=mem://` via existing Playwright config.
   - Cover create Product, see it in list without reload, open Product detail, create Persona, verify Product-scoped Persona list, edit/delete Persona, delete Product/not-found behavior according to chosen deletion policy.
   - Add mocked generation route/provider coverage so no live AI credentials are required.

9. **i18n/static architecture checks**
   - Add a lightweight test or script asserting marketing message keys exist in all four locale files.
   - Add a static guard that `packages/ui/src/lib/marketing/**` does not import `domain` and marketing routes/page models do not construct raw `/api/**` URLs.

## 6. Required validation commands

Smallest meaningful command set once tests are added:

```bash
# OpenSpec validity
bunx @fission-ai/openspec@latest validate migrate-marketing-products-personas --type change --no-interactive

# Domain shared/application/infrastructure marketing tests
bun test \
  packages/domain/src/shared/marketing \
  packages/domain/src/application/marketing \
  packages/domain/src/infrastructure/database/marketing

# Desktop marketing unit tests for API routes/adapters/page models
bun run --filter desktop-app test:unit -- --run \
  src/routes/api/marketing \
  src/lib/adapters/marketing \
  src/routes/marketing

# Shared UI browser/component tests for marketing UI
bun run --filter ui test:browser -- --run src/lib/marketing

# Marketing e2e only
cd apps/desktop-app && bun run test:e2e -- e2e/marketing

# Required slice type/check gate
bun run check:desktop-app
```

Current status of targeted commands:
- OpenSpec validation passes.
- Domain marketing test command fails because no matching tests exist.
- Desktop marketing unit command fails because no matching tests exist.
- Marketing e2e command fails because no matching tests exist.

## 7. Test gap checklist with severity and file paths

| Severity | Gap | OpenSpec scenario(s) | Evidence paths |
|---|---|---|---|
| Critical | No SurrealDB marketing repository tests with `mem://`, unique DBs, close-after-each, RecordId leak assertions, or Product deletion semantics | `Marketing persistence uses SurrealDB repositories/*` | `packages/domain/src/infrastructure/database/marketing/SurrealProductRepository.ts`, `packages/domain/src/infrastructure/database/marketing/SurrealPersonaRepository.ts` |
| Critical | No Product/Persona application service tests; unknown Product association cannot be verified by current `PersonaService` constructor | Product CRUD scenarios; Persona association/scoping/missing Product scenarios | `packages/domain/src/application/marketing/product-service.ts`, `packages/domain/src/application/marketing/persona-service.ts`, `packages/domain/src/application/marketing/ports.ts` |
| Critical | No Persona generation tests for success/failure/no-live-provider guarantee | `Persona generation uses an application port/*` | `packages/domain/src/application/marketing/persona-service.ts`, `apps/desktop-app/src/lib/server/marketing-service.ts`, `packages/domain/src/infrastructure/ai/marketing/AiSdkMarketingTextGateway.ts` |
| High | No API route tests for Product/Persona CRUD, invalid 4xx JSON, unknown Product, generation failure, or thin-adapter architecture | `Marketing APIs are thin adapters/*` plus Product/Persona API scenarios | `apps/desktop-app/src/routes/api/marketing/products/+server.ts`, `apps/desktop-app/src/routes/api/marketing/products/[productId]/+server.ts`, `apps/desktop-app/src/routes/api/marketing/products/[productId]/personas/+server.ts`, `apps/desktop-app/src/routes/api/marketing/personas/+server.ts` |
| High | No app-local transport tests for URL/method/body/error mapping | `Frontend composition uses app-local adapters and page models / Product page loads through a transport adapter` | `apps/desktop-app/src/lib/adapters/marketing/http-marketing-transport.ts`, `apps/desktop-app/src/lib/adapters/marketing/MarketingTransport.ts` |
| High | No page-model tests for load/create/edit/delete/generation/error state/list refresh | `Frontend composition uses app-local adapters and page models/*`; Product/Persona UI update scenarios | `apps/desktop-app/src/routes/marketing/products/products-page.svelte.ts`, `apps/desktop-app/src/routes/marketing/products/[productId]/product-detail-page.svelte.ts`, `apps/desktop-app/src/routes/marketing/personas/personas-page.svelte.ts` |
| High | No marketing Playwright e2e flow | `First-slice validation covers architecture seams / Validation commands pass for the slice` | Missing `apps/desktop-app/e2e/marketing/**`; existing e2e files only chat/home/platformer/rts |
| High | No marketing UI browser/component tests | `Marketing UI is localized and reusable where appropriate / Shared UI does not import domain package`; invalid input UI scenarios | `packages/ui/src/lib/marketing/products/ProductForm.svelte`, `packages/ui/src/lib/marketing/personas/PersonaForm.svelte`, `packages/ui/src/lib/marketing/products/ProductCard.svelte`, `packages/ui/src/lib/marketing/personas/PersonaCard.svelte` |
| High | No i18n coverage; marketing UI strings are inline English and message keys are absent in locales | `Marketing UI is localized and reusable where appropriate / Marketing UI uses localized strings` | `apps/desktop-app/messages/en.json`, `apps/desktop-app/messages/es.json`, `apps/desktop-app/messages/pt.json`, `apps/desktop-app/messages/ja.json`, `apps/desktop-app/src/routes/marketing/**`, `packages/ui/src/lib/marketing/**` |
| Medium | Shared validation tests missing; schemas do not appear to enforce all UI/OpenSpec invariants | `Invalid Product input is rejected`; Persona Product association scenarios | `packages/domain/src/shared/marketing/validation.ts`, `packages/domain/src/shared/marketing/product-types.ts`, `packages/domain/src/shared/marketing/persona-types.ts` |
| Medium | No domain test script documents the intended marketing test command | Validation command hygiene | `packages/domain/package.json` |
| Medium | No manual/browser acceptance evidence, screenshots, or network/console observations for marketing routes | Browser/manual coverage requested by audit task | `/marketing`, `/marketing/products`, `/marketing/products/[productId]`, `/marketing/personas` |
| Low | Test-related OpenSpec task checklist remains unchecked without a nearby status note | `tasks.md` validation tasks | `openspec/changes/migrate-marketing-products-personas/tasks.md` |

