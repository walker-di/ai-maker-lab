# Marketing Manager Gap Fixes — Implementation Plan

## Summary
- **Goal:** Fix the five High/Medium gaps identified in `.pi/gaps/migrate-marketing-products-personas-implementation-gap.md`.
- **Assumptions:**
  - i18n scope limited to Products/Personas slice files (routes + shared marketing components for those two areas). Out-of-scope nav items (campaigns/creatives/etc.) deferred.
  - Package boundary: `packages/ui` components import `$lib/paraglide/messages.js`. Checked via `bun run check:desktop-app` after changes.
  - Persona "Product (optional)" label stays optional (open question deferred to product decision).
- **Non-goals:** Edit/delete button fix (confirmed these already exist via CSS opacity-0 hover). Persona product enforcement. Out-of-scope nav stubs.

## Source Reports
- [x] ✅ UI/frontend planning report incorporated: `plan-ui-marketing-gaps`
- [x] ✅ Backend planning report incorporated: `plan-backend-marketing-gaps`
- [x] ✅ Tests planning report incorporated: `plan-tests-marketing-gaps`

## Architecture Validation
- ✅ Clean architecture: repository fixes at infra layer, config check at server composition layer, no domain changes required.
- ✅ Svelte 5 idioms: `$props()`, `$derived()`, no stores for local state.
- ✅ API boundaries: thin routes call services, errors mapped via `toMarketingErrorResponse`.
- ✅ i18n: paraglide messages consumed via `m.*()` calls, message keys in `messages/*.json`.
- ✅ Testing: real SurrealDB `mem://` for repo tests, fake gateway for service tests, Bun test runner.

## Implementation Checklist

### Backend
- [ ] `packages/domain/src/infrastructure/database/marketing/SurrealProductRepository.ts` — change `update()` to use `this.db.merge()` instead of `this.db.update()`.
- [ ] `apps/desktop-app/src/lib/server/marketing-service.ts` — add `MarketingProviderConfigurationError`; check `parseTextModelConfig().apiKey`; use throwing fallback gateway when no key; update `toMarketingErrorResponse` to map config error → 503.

### UI/frontend
- [ ] `packages/ui/src/lib/marketing/products/ProductDetailView.svelte` — guard `createdAt`/`updatedAt` against `Invalid Date`; show fallback when missing.
- [ ] `packages/ui/src/lib/marketing/products/ProductCard.svelte` — add `detailHref?: string` prop; render product title as `<a>` when `detailHref` provided.
- [ ] `apps/desktop-app/src/routes/marketing/products/+page.svelte` — pass `detailHref="/marketing/products/{product.id}"` to `ProductCard`.
- [ ] i18n message keys — add `marketing_*` keys to `en.json`, `es.json`, `pt.json`, `ja.json`.
- [ ] Update marketing route Svelte files to use `m.*()` for visible strings.
- [ ] Update shared `packages/ui` marketing components to use `m.*()` for visible strings.

### Tests
- [ ] `packages/domain/src/infrastructure/database/marketing/product-persona-repository.test.ts` — add test: `update preserves createdAt and untouched fields`.
- [ ] `packages/domain/src/application/marketing/persona-service.test.ts` — add test: `generateForProduct maps AI config failures to a friendly error without persisting personas`.

### Validation
- [ ] Run: `bun test packages/domain/src/infrastructure/database/marketing/product-persona-repository.test.ts`
- [ ] Run: `bun test packages/domain/src/application/marketing/persona-service.test.ts`
- [ ] Run: `bun run check:desktop-app`
- [ ] Browser verify: product detail date renders correctly (no "Invalid Date")
- [ ] Browser verify: product cards link to detail page
- [ ] Browser verify: generate personas returns friendly 503 message
- [ ] Browser verify: `/es/marketing/products` renders Spanish strings

## Dependencies and Sequencing
1. Backend first: repository merge fix → marketing-service config error → toMarketingErrorResponse update.
2. UI: ProductDetailView date guard (standalone) → ProductCard detailHref (standalone).
3. i18n: add message keys to JSON files → update components to use `m.*()`.
4. Tests: after each backend change.
5. Type check: `bun run check:desktop-app` after all UI/i18n changes.

## Risks and Mitigations
- ⚠️ `db.merge()` in SurrealDB merges at top level but not nested — `features`/`benefits` arrays passed in update will be replaced (not merged element-by-element), which is the desired behavior.
  - Mitigation: verify in repo test that full update DTO fields are applied.
- ⚠️ i18n boundary — `packages/ui` importing `$lib/paraglide/messages.js` couples it to desktop-app.
  - Mitigation: run `bun run check:desktop-app` after changes; if resolution fails, pass strings via props from routes.
- ⚠️ Fallback gateway affects all AI calls — ensure CRUD routes still work when AI key missing.
  - Mitigation: fallback gateway only throws on AI-specific methods; CRUD services never call it.

## Open Questions
- ❓ Should "Product (optional)" become required on persona form? Deferred pending product decision.
- ❓ i18n for out-of-scope marketing components (campaigns/creatives/etc.) — deferred.
