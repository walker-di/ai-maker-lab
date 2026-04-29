# AI Storyboard Maker — Browser Verification Report

## Summary

- **Audit goal:** Browser UI check of the AI Storyboard Maker (and surrounding app routes)
- **Mode:** Headless Playwright
- **Dev server:** `bun run dev:web` → `http://localhost:5173`
- **Overall status:** ⚠️ Partial — UI structure renders correctly; DB-dependent features blocked
- **Highest severity:** Critical (SurrealDB connection timeout in web mode)

## Browser Verification

- **Mode:** headless
- **Reason:** Functional flow verification; no auth or timing issues expected
- **URL(s):** `http://localhost:5173`, `/experiments/storyboard`, `/marketing`, `/settings`, `/agents`
- **Screenshots:** `/tmp/storyboard-screenshots/`
  - `01-storyboard-list.png` — Storyboard list with DB error banner and empty state
  - `02-create-dialog.png` — Create Storyboard dialog open
  - `03-dialog-filled.png` — Dialog with Name and Description filled
  - `04-dialog-closed.png` — Dialog dismissed via Escape
  - `route-marketing.png` — Marketing Manager page
  - `route-settings.png` — Settings page (web mode)
  - `route-agents.png` — Agent Registry page

## Requirement Gap Matrix

| Scenario | Code Evidence | Browser Evidence | Status | Severity | Next Action |
|---|---|---|---|---|---|
| Storyboard list page renders | `+page.svelte`, `StoryboardList.svelte` | ✅ h1 "AI Storyboard Maker", description visible | ✅ Satisfied | — | — |
| Empty state shown when no storyboards | `StoryboardEmptyState.svelte` | ✅ "No storyboards yet / Create a prompt-first storyboard…" | ✅ Satisfied | — | — |
| "Create storyboard" button present | `+page.svelte` | ✅ Button visible and clickable | ✅ Satisfied | — | — |
| Create Storyboard dialog opens | `CreateStoryboardDialog` component | ✅ Dialog with Name (input) + Description (textarea), Create button enabled | ✅ Satisfied | — | — |
| Dialog closes on Escape | Dialog component | ✅ Confirmed closed | ✅ Satisfied | — | — |
| Load storyboards from API | `/api/marketing/storyboards` GET | ❌ HTTP 500 — DB timeout | 🐛 Broken | **Critical** | Fix SurrealDB connection in web mode |
| Create storyboard via dialog | `/api/marketing/storyboards` POST | ❌ Untestable — DB blocked | ❓ Blocked | **Critical** | Requires DB fix |
| Sidebar navigation renders all links | `+layout.svelte` | ✅ All 7 nav links present and routing correctly | ✅ Satisfied | — | — |
| Sidebar toggle button | `StoryboardShell` / layout | ✅ Exists and toggles | ✅ Satisfied | — | — |
| Settings page loads (web mode) | `settings-page.svelte.ts` `isWeb` guard | ✅ Web-mode hint shown; no API key form (by design) | ✅ Satisfied | — | — |
| Marketing page loads | `/marketing/+page.svelte` | ✅ "Marketing Manager" h1, sub-sections visible | ✅ Satisfied | — | — |
| Agent Registry loads | `/agents/+page.svelte` | ✅ "Agent Registry" h1 | ✅ Satisfied | — | — |

## Detailed Gaps

### 🐛 Broken: SurrealDB Connection Timeout in Web Mode

- **Severity:** Critical
- **Error:** `[DB] connect to surrealkv:///Users/walker/Documents/Dev/AI Maker Lab/ai-maker-lab/data/surrealdb/desktop-web.db timed out after 30000ms`
- **Visible in:** Error banner on `/experiments/storyboard` page
- **API impact:** `GET /api/marketing/storyboards` → HTTP 500 (× 2 requests observed)
- **Code evidence:** SurrealDB adapter connects to `surrealkv://` path — a file-based embedded mode that requires the SurrealDB native binary or server process running
- **Browser evidence:** Error banner rendered in `<div class="rounded-lg border border-destructive bg-destructive/10 …">` on storyboard page
- **Impact:** Cannot load, create, or interact with storyboards in web mode. All API routes backed by SurrealDB will return 500.
- **Recommended fix:** Either start the SurrealDB server process alongside `bun run dev:web`, or provide a mock/fallback DB adapter for web-only development

### ⚠️ Medium: Node built-in modules externalized in browser (dev warnings)

- **Severity:** Medium
- **Modules:** `path`, `fs`, `url`, `source-map-js`
- **Console warnings:** Multiple Vite warnings: `Module "path" has been externalized for browser compatibility. Cannot access "path.resolve" in client code.`
- **Impact:** These are dev-mode only (Vite HMR/source-map tooling). Not blocking production behavior. May indicate server-side imports leaking into client bundle.
- **Recommended action:** Audit imports that pull `path`/`fs`/`url` in client-side code; ensure SurrealDB adapter is server-only.

### ❓ Question: Settings page in web mode — no API key inputs

- **Severity:** Low / Question
- **Observation:** Settings page shows `SettingsRestartHint` only in web mode; no API key input fields rendered
- **Code evidence:** `isWeb = model.mode === 'web'` → renders `<SettingsRestartHint>` block; settings model doesn't call `load()` in web mode
- **Assessment:** This appears **intentional** — API keys can only be saved in desktop mode. Confirm this is expected UX for users running the app in browser mode.

## What Works Correctly

- ✅ App loads and client-side routing functions
- ✅ Navigation sidebar renders with all 7 links
- ✅ `/experiments/storyboard` — page renders with correct heading, description, empty state
- ✅ "Create storyboard" dialog — opens, has Name + Description inputs, Create button enabled
- ✅ Dialog form fills and dismisses via Escape
- ✅ Sidebar toggle functions
- ✅ `/marketing`, `/settings`, `/agents` all load their respective pages correctly
- ✅ Language switcher links (en/es/pt/ja) present on settings page

## Recommended Next Steps

### Backend / Infrastructure
- [ ] Investigate whether SurrealKV needs a server process to be started before `bun run dev:web`
- [ ] Check if there is a `data/surrealdb/` directory and whether the DB file exists
- [ ] Consider adding a `dev:web:full` script that starts the DB process alongside the Vite server

### Tests
- [ ] Add e2e test verifying DB connection (or explicit offline/fallback state) on storyboard page
- [ ] Add e2e test verifying Create Storyboard dialog submits successfully (needs DB running)

### Validation Commands
- [ ] `ls data/surrealdb/` — confirm DB file presence
- [ ] Start SurrealDB server and re-run `bun run dev:web` — verify 500 errors resolve
- [ ] Browser verify: create a storyboard and confirm it appears in the list

## Open Questions / Blockers

- ❓ Is there a separate process to start SurrealDB for web mode? No `README` instructions found for this.
- ❓ Does `bun run dev:app` or `bun run dev:app:hmr` (Electrobun desktop mode) handle DB startup automatically? If so, this is only a web-mode gap.
