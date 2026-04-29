# migrate-marketing-products-personas Implementation Gap Report

## Summary
- **OpenSpec change:** `migrate-marketing-products-personas`
- **Audit goal:** Browser-verify the Marketing Manager UI (Products + Personas) against OpenSpec acceptance criteria
- **Overall status:** ⚠️ Partial
- **Highest severity:** High
- **Audit date:** 2026-04-28
- **Dev server:** `http://localhost:5174` (port 5174 — 5173 was occupied by another agent)

## Source Reports
- [x] ✅ OpenSpec requirements incorporated: inline (parent session)
- [x] ✅ Browser verification: headless Playwright, 6 scripts, 37 screenshots at `/tmp/marketing-screenshots/`
- [ ] ⚠️ Static code / test subagents not spawned — user requested direct browser check only

## Browser Verification
- **Mode:** headless
- **Reason:** deterministic flows, no auth required
- **URLs exercised:**
  - `http://localhost:5174/marketing`
  - `http://localhost:5174/marketing/products`
  - `http://localhost:5174/marketing/products/[productId]`
  - `http://localhost:5174/marketing/personas`
  - `http://localhost:5174/es/marketing/products`
  - `http://localhost:5174/ja/marketing/products`
- **Screenshots:** `/tmp/marketing-screenshots/` (01–37)
- **Console errors observed:**
  - `500` from `POST /api/marketing/products/[id]/personas/generate`
  - `Error: model: claude-3-5-haiku-20241022` — raw provider error leaked through page model (`product-detail-page.svelte.ts:120`)
  - `Error: Cannot delete Product with 1 associated Persona(s). Delete all Personas first.` (409) — correctly surfaced but triggers a console error
- **Network errors:**
  - `500 /api/marketing/products/[id]/personas/generate` — AI provider call fails at runtime

---

## Requirement Gap Matrix

| Requirement / Scenario | Spec Source | Browser Evidence | Status | Severity | Next Action |
|---|---|---|---|---|---|
| User creates a Product | spec.md | ✅ Created "Browser Test Product" via form, appeared in list without reload | ✅ Satisfied | — | None |
| User edits a Product | spec.md | ✅ Edit form pre-filled, "Save Changes" persisted name edit, reflected in list | ✅ Satisfied | — | None |
| User deletes a Product | spec.md | ✅ Delete blocked by 409 with inline message when personas exist; delete works when no personas | ✅ Satisfied | — | Minor UX polish |
| Invalid Product input is rejected | spec.md | ✅ `aria-invalid` + `border-destructive` + `<p class="text-sm text-destructive">` per field (name, description, audience) | ✅ Satisfied | — | None |
| User creates a Persona for a Product | spec.md | ✅ Created "Full Test Persona" linked to product via dropdown; appeared in personas list | ✅ Satisfied | — | None |
| Product Persona list is scoped | spec.md | ✅ Product detail shows `1 Personas` count; persona appears under correct product | ✅ Satisfied | — | None |
| User edits a Persona | spec.md | ❌ No edit button found on persona list items in `/marketing/personas` or product detail persona list | ❌ Missing | High | Add edit affordance to persona list items |
| User deletes a Persona | spec.md | ❓ No delete button visible on persona cards; not confirmed present or absent | ❓ Unknown | High | Verify persona delete UI |
| Persona requires an existing Product | spec.md | ⚠️ UI labels product "Product (optional)"; personas can be submitted without product association | ⚠️ Partial | Medium | Enforce or clarify spec intent |
| User generates a Persona draft | spec.md | 🐛 "Generate Personas" button returns 500; raw error `model: claude-3-5-haiku-20241022` shown in UI | 🐛 Broken | High | Fix error handling; wire mock provider for dev |
| Persona generation provider failure → controlled error | spec.md | 🐛 Provider error leaks model name to UI instead of user-friendly state | 🐛 Broken | High | Map error to controlled use-case error in page model |
| Marketing persistence uses SurrealDB repositories | spec.md | ✅ `/api/marketing/products` returns persisted data with UUIDs; persists across navigations | ✅ Satisfied | — | None |
| API route handles Product creation | spec.md | ✅ POST creates product, GET returns list with created object | ✅ Satisfied | — | None |
| API route handles invalid input | spec.md | ✅ Client-side validation prevents empty submit; 409 for constraint violations | ✅ Satisfied | — | None |
| Product page loads through transport adapter | spec.md | ✅ "Product data is saved through the marketing transport adapter." shown in form | ✅ Satisfied | — | None |
| Persona page handles errors through model state | spec.md | 🐛 Generate error exposes raw `model:` string instead of user-facing message | 🐛 Broken | High | Expose controlled error state from page model |
| Marketing UI uses localized strings (en/es/pt/ja) | spec.md | ❌ `/es/marketing`, `/pt/marketing`, `/ja/marketing` all render identical English text | ❌ Missing | High | Add paraglide message keys for all marketing strings |
| Marketing nav entry in desktop app | spec.md | ✅ Home page lists "Marketing Manager" → `/marketing`; sidebar has full sub-nav | ✅ Satisfied | — | None |
| Product cards link to product detail page | spec.md (implied) | ❌ Product cards are non-interactive `<div>`; no `<a href="/marketing/products/[id]">` exists | ❌ Missing | High | Make product cards navigable |
| Product `createdAt` renders correctly | spec.md (data integrity) | 🐛 Shows "Created Invalid Date" on product detail page | 🐛 Broken | Medium | Fix date formatting in detail page |

---

## Detailed Gaps

### ❌ Missing: Product list items are not navigable to product detail
- **Severity:** High
- **Spec evidence:** Product detail route exists at `apps/desktop-app/src/routes/marketing/products/[productId]/+page.svelte`; spec implies view/edit/delete lifecycle
- **Browser evidence:** `a[href*="/marketing/products/"]` returns `[]` on products list page; product name element is a plain `<div>` (not a link); clicking product name reloads the same list; product detail IS reachable at `http://localhost:5174/marketing/products/uc7q6g87qdlowm23iglr` when navigated to directly
- **Impact:** Users have no UI path to view full product details, manage features/benefits, or reach product-scoped persona generation
- **Recommended fix:** Wrap product card name/area in `<a href="/marketing/products/{product.id}">`, or add a "View" button alongside the existing Edit/Delete icon buttons

### 🐛 Broken: Persona generation returns 500 with leaked model name in UI
- **Severity:** High
- **Spec evidence:** "Persona generation provider fails → application service maps failure to controlled use-case error → UI displays a user-visible error state → no partial invalid Persona is persisted"
- **Browser evidence:** `POST /api/marketing/products/[id]/personas/generate` → 500; console error: `Error: model: claude-3-5-haiku-20241022`; error text briefly appears in page body; triggered from `product-detail-page.svelte.ts:120`
- **Impact:** Violates spec error-handling contract; exposes internal provider config to users; primary generate flow is broken
- **Recommended fix:** Catch provider errors in API route; return controlled 4xx/5xx JSON; page model should expose a friendly error state; configure mock provider for dev so the flow is exercisable without live keys

### ❌ Missing: i18n translations for marketing strings
- **Severity:** High
- **Spec evidence:** "WHEN marketing pages render visible labels, headings, actions, and errors THEN those strings are read from paraglide messages AND message keys exist for `en`, `es`, `pt`, and `ja`"
- **Browser evidence:** `/es/marketing/products`, `/pt/marketing`, `/ja/marketing` all display identical English text: "Marketing Manager", "Products", "Manage marketing products before generating personas…", "New product", "No products yet", etc.
- **Impact:** Core localization acceptance criterion unmet; Spanish, Portuguese, and Japanese users see English UI
- **Recommended fix:** Add paraglide message keys for all marketing-visible strings; verify compilation; re-check locale routes

### ❓ Unknown: Persona edit and delete UI
- **Severity:** High
- **Browser evidence:** Persona list shows persona card ("FT / Full Test Persona / 30 · All / Senior Marketing Manager") but no edit or delete buttons were found; hover did not reveal hidden actions; product card pattern (icon buttons with aria-label) was not replicated on persona cards
- **Impact:** Edit and delete spec scenarios likely not implemented for personas
- **Recommended fix:** Inspect persona list component; add edit/delete affordances mirroring the product card's `aria-label="Edit …"` / `aria-label="Delete …"` pattern

### 🐛 Broken: `createdAt` shows "Invalid Date" on product detail
- **Severity:** Medium
- **Browser evidence:** `GET /api/marketing/products` returns `createdAt: "2026-04-28T13:34:03.170Z"` (valid ISO string); product detail page renders "Created Invalid Date" (screenshot `31-product-detail-direct.png`)
- **Impact:** Data presentation bug; confuses users about product age
- **Recommended fix:** Audit transport adapter → page model date field mapping; ensure ISO string is passed to `new Date()` or a `formatDate` helper

### ⚠️ Partial: Persona "Product (optional)" vs spec required association
- **Severity:** Medium
- **Spec evidence:** "Persona requires an existing Product — WHEN a user or API request attempts to create a Persona for an unknown Product THEN the operation fails with a not-found or validation error"
- **Browser evidence:** Form labels product field "Product (optional)"; `/marketing/personas` shows "Create a product before creating personas" as a hint but does not block form submission without a product; persona was saved without a product in an earlier test run
- **Impact:** Orphan personas can be created; spec invariant violated if product is truly required
- **Recommended fix:** Clarify with spec owner (see Open Questions); if required, remove "optional" label and add form-level + service-level enforcement

---

## Scope Drift
- 🌀 Sidebar navigation includes "Campaigns", "Creatives", "Canvas Templates", "BGM", "Settings" under Marketing Manager — these were declared **out of scope** for this slice in the proposal. Navigation exists. Pages likely render as stubs. Acceptable if empty states are graceful; verify they do not error.

---

## Test Coverage Gaps
- [ ] No e2e/browser test for product create flow
- [ ] No e2e/browser test for product edit flow
- [ ] No e2e/browser test for persona create linked to product
- [ ] No test for product card → detail page navigation
- [ ] No test for persona generation error handling with mock provider
- [ ] No test for i18n key presence in all 4 locales
- [ ] No test for product detail `createdAt` date formatting
- [ ] No test for persona edit/delete

---

## Recommended Implementation Checklist

### UI/frontend
- [ ] Make product list cards navigable: wrap card or name in `<a href="/marketing/products/{product.id}">`
- [ ] Fix `createdAt` "Invalid Date": audit transport adapter → page model date field mapping
- [ ] Add edit and delete affordances to persona list items (mirror product card pattern)
- [ ] Fix generate personas error UX: display user-facing message, not raw error/model name
- [ ] Resolve "Product (optional)" label vs. spec requirement (enforce or relabel)
- [ ] Verify out-of-scope nav stub pages render gracefully (no 500/404 on Campaigns, Creatives, etc.)

### i18n
- [ ] Add paraglide message keys for all marketing-visible strings (headings, labels, actions, empty states, errors)
- [ ] Populate keys in `en`, `es`, `pt`, `ja` message files
- [ ] Rebuild paraglide and verify locale routes render translated strings

### Backend / API
- [ ] Fix `POST /api/marketing/products/[id]/personas/generate` to return controlled error (not raw 500 with model name)
- [ ] Wire mock/stub persona generation provider for dev mode so the feature is exercisable without live AI keys
- [ ] Verify `createdAt` is included and correctly typed in all product API responses

### Validation
- [ ] Run: `bun run check:desktop-app`
- [ ] Browser verify: product card → detail page navigation works
- [ ] Browser verify: persona edit and delete flow
- [ ] Browser verify: generate personas with mock provider returns a graceful result or error message
- [ ] Browser verify: `/es/marketing/products` heading renders in Spanish
- [ ] Browser verify: `/ja/marketing/products` heading renders in Japanese

---

## Open Questions / Blockers
- ❓ **Persona product association intent:** Is "Product (optional)" intentional UX or a spec deviation? The spec says "Persona requires an existing Product" but a global personas list across all products implies they might exist independently. Needs product decision.
- ❓ **Generate Personas in dev:** Is persona generation expected to work without a live Anthropic API key, or should a mock provider be wired in for dev? The spec says "tests use a mock provider" — should the dev server also use a mock by default?
- ❓ **Out-of-scope stub nav items:** Do Campaigns, Creatives, Canvas Templates, BGM pages render gracefully (empty state) or do they 500/404? Not verified.
