# Title

Per-Agent SKILL Files And Context Isolation Plan

## Goal

Give every paperclip role its own minimal `SKILLS.md` so each agent's context window stays small and on-topic. The CEO does not load Playwright cheatsheets; QA does not load refactor heuristics; Designer does not load build commands. This is the mechanism that makes the role separation in `03-company-org-chart.md` actually pay off in practice.

## Scope

- Define one `SKILLS.md` per role, stored under the paperclip install (outside the repo) and tracked via the role's paperclip configuration.
- Reference (do not duplicate) the existing repo skills in `.codex/skills/` and `.cursor/skills/` for the Coder role only.
- Add a single one-line entry in the repo's [AGENTS.md](../../../../AGENTS.md) under the existing `Skills` / `Documentation Direction` area pointing to `docs/sprint/003/` so future contributors discover the company structure without having to grep.

Out of scope for this step:

- Rewriting any existing repo skill (`.codex/skills/clean-architecture-frontend-svelte/SKILL.md`, `.cursor/skills/svelte-frontend/SKILL.md`, `.cursor/skills/backend-implementtion/SKILL.md`, etc.).
- Creating a paperclip MCP server or any in-repo paperclip integration code.
- Loading the per-agent skill files into the desktop app or any package.

## Architecture

- **Storage**: `~/paperclip/ai-maker-lab/skills/<role>/SKILLS.md` (outside the repo, alongside the paperclip install from `02-paperclip-setup.md`).
- **Loading**: paperclip's runtime skill injection picks the file up via the role's configuration. No repo code is involved.
- **Reference policy**: Coder's skill file *links* into the repo's existing skills rather than copying them, so a single source of truth is maintained.
- **Repo footprint**: a single one-line entry in [AGENTS.md](../../../../AGENTS.md) is the only repo change in this plan.

## Implementation Plan

1. Create the per-role skill folder layout under the paperclip install.
   ```
   ~/paperclip/ai-maker-lab/skills/
     ceo/SKILLS.md
     orchestrator/SKILLS.md
     coder/SKILLS.md
     qa/SKILLS.md
     designer/SKILLS.md
   ```
2. Write `ceo/SKILLS.md`.
   - Sections:
     - Mission (verbatim from `03-company-org-chart.md`).
     - Governance rules: hire-new-agent gate, budget-override authority, pause/resume authority.
     - Inputs the CEO reads (latest QA + Designer reports, Orchestrator strategy proposals).
     - Decision template: approve / reject with one-paragraph rationale.
   - Hard cap: ~1 page. No build commands, no Playwright, no rubric content.
3. Write `orchestrator/SKILLS.md`.
   - Sections:
     - Experiment-plan parsing rules: how to convert a `docs/experiment/<id>/<NN>-<slice>.md` plan into Coder-sized tickets.
     - Ticket conventions: title format, required fields (`branch`, `experiment_id`, `acceptance_criteria`, `tags`), labels (`animation`, `juice`, etc. for QA video capture).
     - Routing rules: Coder → QA → Designer; failures filed as linked bug tickets, polish requests filed as linked tickets.
     - Escalation: when to ping CEO (scope expansion, budget pressure, ambiguous mission).
   - Hard cap: ~2 pages. No code-style rules, no Playwright internals, no design rubric.
4. Write `coder/SKILLS.md`.
   - Sections (mostly references, not duplications):
     - Repo entry points: `apps/desktop-app/`, `packages/ui/`, `packages/domain/`.
     - Workspace command: `bun install` from repo root, per [AGENTS.md](../../../../AGENTS.md).
     - Required reading per ticket type:
       - Frontend tickets → [.cursor/skills/svelte-frontend/SKILL.md](../../../../.cursor/skills/svelte-frontend/SKILL.md) and [.codex/skills/clean-architecture-frontend-svelte/SKILL.md](../../../../.codex/skills/clean-architecture-frontend-svelte/SKILL.md).
       - Backend / domain tickets → [.cursor/skills/backend-implementtion/SKILL.md](../../../../.cursor/skills/backend-implementtion/SKILL.md).
       - Diagrams → [.codex/skills/excalidraw-diagram/SKILL.md](../../../../.codex/skills/excalidraw-diagram/SKILL.md).
     - Branch convention: `sprint-003/<experiment>/<ticket-id>`.
     - Done-for-QA checklist: branch pushed, unit tests green for the affected package, ticket flipped to "ready for QA" with a one-paragraph summary.
   - Hard cap: ~2 pages. **No QA tooling docs, no design rubric, no governance rules.**
5. Write `qa/SKILLS.md`.
   - Sections:
     - Run pipeline (verbatim from `04-qa-agent.md` step 2).
     - Vision rubric (verbatim from `04-qa-agent.md` step 4).
     - Output contract: `docs/sprint/003/runs/<experiment>/<ticket-id>/qa.md` shape.
     - Read-only boundary: writes only under `docs/sprint/003/runs/**`. Any other write attempt aborts the run with a "QA boundary violation" defect.
     - Reference to e2e conventions in [apps/desktop-app/AGENTS.md](../../../../apps/desktop-app/AGENTS.md) (E2E Testing Rules section).
   - Hard cap: ~3 pages. **No build/refactor heuristics, no design rubric.**
6. Write `designer/SKILLS.md`.
   - Sections:
     - Visual rubric: spacing tokens, hierarchy, color and shadow consistency with `packages/ui` surfaces, motion taste check on video evidence.
     - Brand notes: pull existing color tokens from `packages/ui` and the existing `.codex/skills/excalidraw-diagram/references/color-palette.md` if present.
     - Output contract: `docs/sprint/003/runs/<experiment>/<ticket-id>/design.md` shape.
     - Read-only boundary: writes only under `docs/sprint/003/runs/**`.
   - Hard cap: ~2 pages. **No Playwright internals, no build commands, no governance rules.**
7. Add a single discoverability entry to the repo's [AGENTS.md](../../../../AGENTS.md).
   - Under the existing `Documentation Direction` list, add a single bullet:
     - `docs/sprint/003/` — paperclip company definition (CEO / Orchestrator / Coder / QA / Designer) used to drive experiment redo.
   - This is the **only** edit this plan makes to repo source.
8. Define the "skill bloat" guardrail.
   - When any role's `SKILLS.md` exceeds its page cap, split it instead of growing it. Example: if QA grows past 3 pages, move the rubric into a separate `qa/RUBRIC.md` and link from `SKILLS.md`.

## Tests

- Open each role in paperclip and confirm the right `SKILLS.md` loads at heartbeat (paperclip surfaces this in the trace).
- Confirm Coder's `SKILLS.md` does not contain Playwright commands (grep for `playwright` should return zero matches).
- Confirm QA's `SKILLS.md` does not contain refactor or build heuristics (grep for `refactor`, `bun install` should return zero matches).
- Confirm the [AGENTS.md](../../../../AGENTS.md) bullet renders correctly and links to `docs/sprint/003/`.

## Acceptance Criteria

- Five `SKILLS.md` files exist under `~/paperclip/ai-maker-lab/skills/<role>/`.
- Each file fits its hard cap.
- Coder's file references existing repo skills rather than duplicating them.
- The repo's [AGENTS.md](../../../../AGENTS.md) gets one new bullet pointing to `docs/sprint/003/` and nothing else changes.
- A grep across all five files for off-role keywords (Playwright in CEO, governance in QA, etc.) returns zero matches.

## Dependencies

- `02-paperclip-setup.md` complete.
- `03-company-org-chart.md` complete.
- `04-qa-agent.md` complete (its rubric is the source of truth for QA's `SKILLS.md`).
- Existing repo skills under `.codex/skills/` and `.cursor/skills/`.

## Risks / Notes

- The single biggest risk in sprint 003 is letting one agent become a Swiss-army knife. Page caps are deliberately low; resist relaxing them.
- Storing `SKILLS.md` outside the repo means they are not version-controlled by `ai-maker-lab`. Mitigation: a future sprint can mirror them into `docs/sprint/003/skills/` if reproducibility across machines becomes a concern.
- The [AGENTS.md](../../../../AGENTS.md) bullet is intentionally one line; do not turn it into a tutorial. The plan files are the tutorial.
