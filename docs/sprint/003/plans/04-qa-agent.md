# Title

QA Agent Specialization Plan (Playwright + Vision)

## Goal

Make the QA agent a single-purpose paperclip employee that validates each Coder ticket using Playwright e2e runs, screenshot capture, optional short video capture, and vision-model analysis against a fixed rubric. The QA agent must stay read-only against application source, write its evidence and verdicts only under `docs/sprint/003/runs/`, and never edit Coder output. This is the core reason for sprint 003: separating QA tooling from the Coder so neither agent's context bloats.

## Scope

- Define the QA agent's input contract (ticket → branch → acceptance criteria).
- Define the run pipeline (Playwright run → screenshot capture → optional video capture → vision review → verdict).
- Define the output contract (per-ticket QA report under `docs/sprint/003/runs/`).
- Define the rubric the vision model evaluates against.
- Reuse existing repo conventions: `apps/desktop-app/e2e/` and `bun run test:e2e:chat` / `bun run test:e2e` (per [apps/desktop-app/AGENTS.md](../../../../apps/desktop-app/AGENTS.md)).

Out of scope for this step:

- Building net-new e2e infrastructure (the existing Playwright config and `mem://` SurrealDB pattern are reused as-is).
- Wiring QA into a CI pipeline.
- The Designer's visual rubric — that lives with the Designer role in `03-company-org-chart.md` and the per-agent skills in `05-skills-and-context-isolation.md`.

## Architecture

- **Runtime**: paperclip employee, vision-capable Claude Code instance.
- **Workspace**: a fresh checkout of the Coder's branch, pulled by the QA agent at the start of the run. QA never works in the Coder's working tree.
- **Ports**:
  - `Playwright` — invoked through the existing repo scripts.
  - `Filesystem (write)` — only under `docs/sprint/003/runs/<experiment>/<ticket-id>/`.
  - `Filesystem (read)` — entire repo.
  - `Vision model` — Claude vision or Gemini vision; chosen per ticket based on the rubric category.
- **Boundaries**:
  - QA never edits source.
  - QA never closes its own ticket as `done`; it returns "pass" or a "fail with N defects" payload to the Orchestrator, which decides next steps.
  - QA budget caps per `03-company-org-chart.md` (`$40/mo`).

## Implementation Plan

1. Define the ticket input contract.
   - Ticket fields QA reads: `id`, `branch`, `experiment_id`, `acceptance_criteria` (copied by the Orchestrator from the experiment plan), `coder_summary`.
   - Required artifacts on the branch: at least one Playwright spec covering the ticket's surface (Coder is responsible for adding it; if missing, QA fails the ticket with a single defect "missing e2e coverage").
2. Define the run pipeline.
   1. Check out the Coder's branch into a QA-owned working tree (separate from the Coder's).
   2. Install dependencies: `bun install` from the repo root (per root `AGENTS.md`).
   3. Run unit tests for affected packages to confirm the branch is at least green pre-QA: `bun test` scoped to the changed package(s).
   4. Run Playwright e2e:
      - Chat slice: `bun run test:e2e:chat` from `apps/desktop-app`.
      - Full e2e: `bun run test:e2e` from `apps/desktop-app` when the ticket touches multiple slices.
   5. Capture artifacts during the Playwright run:
      - Per-scenario screenshots saved to `docs/sprint/003/runs/<experiment>/<ticket-id>/screenshots/`.
      - Optional short MP4 (≤10s) saved to `docs/sprint/003/runs/<experiment>/<ticket-id>/videos/` for tickets that touch animation, juice, or transitions (e.g. experiment 001 RTS juice work).
   6. Run vision review against the fixed rubric (see step 4) over the captured screenshots and videos.
   7. Compose the QA report in `docs/sprint/003/runs/<experiment>/<ticket-id>/qa.md` with:
      - Verdict (`pass` or `fail`).
      - Numbered defects (each with: short title, severity, evidence path, suggested fix area — never the fix itself).
      - Run metadata (branch, commit SHA, Playwright command, duration, vision model used).
3. Define screenshot / video capture rules.
   - Use Playwright's built-in `page.screenshot()` and `page.video()` features.
   - Capture screenshots at meaningful steps, not every navigation; the QA report stays scannable.
   - Videos only for tickets tagged `animation`, `juice`, `transition`, or `interaction-feel`.
   - All artifacts go under the ticket-scoped folder; nothing under `apps/desktop-app/` or `packages/`.
4. Define the fixed vision rubric.
   - **Layout**: no overlapping elements; spacing matches the design tokens; nothing clipped at common viewport sizes (1280×720, 1440×900, mobile 390×844).
   - **Typography**: text contrast meets WCAG AA against its background; no truncated text within nominal containers.
   - **Motion (videos only)**: animations play at ≥30fps perceived; no jank; no infinite spinners that should have completed.
   - **State coverage**: empty state, loading state, error state, success state are each captured at least once for the ticket's primary surface.
   - **Brand fit**: colors, radii, and shadows match the existing surfaces in `packages/ui` (the rubric is descriptive, not prescriptive — the Designer enforces the brand bar).
5. Define the failure return contract.
   - QA returns to the Orchestrator with: verdict, list of defects (each with severity `blocker`, `major`, `minor`), and the path to the QA report.
   - QA does **not** decide whether to reopen the original ticket or file a new linked one. The Orchestrator owns that.
6. Define the read-only boundary.
   - QA's `SKILLS.md` (defined in `05-skills-and-context-isolation.md`) explicitly enumerates allowed write paths: only `docs/sprint/003/runs/**`.
   - Any attempt to edit source must abort the QA run with a single defect "QA boundary violation" and surface it to the Orchestrator.

## Tests

- Trivial-change ticket: change a label in a route, confirm QA captures the new screenshot and writes a `pass` report.
- Forced-fail ticket: introduce a deliberate visual regression (e.g. a `display: none` on a key element), confirm QA writes a `fail` report with the right defect and evidence.
- Animation ticket: ensure the video capture path is exercised on a ticket tagged `animation`.
- Boundary test: attempt (in a controlled run) to have QA edit a source file; confirm the run aborts with the boundary violation defect.
- Re-run idempotency: running QA twice on the same ticket overwrites the previous report cleanly under the same `runs/<experiment>/<ticket-id>/` folder.

## Acceptance Criteria

- The QA agent runs end-to-end against a real Coder branch and produces a report at `docs/sprint/003/runs/<experiment>/<ticket-id>/qa.md`.
- The report includes: verdict, defects (if any), evidence paths, run metadata.
- QA never modifies files outside `docs/sprint/003/runs/**`.
- The vision rubric in step 4 is the rubric used by the agent's `SKILLS.md` (consistency between this plan and the skill file).
- The forced-fail test produces at least one `blocker` or `major` defect with a screenshot path that opens.

## Dependencies

- `02-paperclip-setup.md` complete.
- `03-company-org-chart.md` complete (QA agent hired with the right budget and tools).
- Existing repo e2e infrastructure: `apps/desktop-app/e2e/`, `bun run test:e2e`, `bun run test:e2e:chat`.
- Existing repo conventions in [apps/desktop-app/AGENTS.md](../../../../apps/desktop-app/AGENTS.md) (E2E Testing Rules, `patchEmptyTableErrors`, `mem://` SurrealDB).
- External docs: [playwright.dev](https://playwright.dev/).

## Risks / Notes

- Vision-model token cost can dominate the QA budget if every screenshot is sent at full resolution. Downscale before vision review when feasible.
- Video capture inflates run time; keep videos ≤10s and reserved for animation-tagged tickets.
- The rubric is intentionally short. Resist expanding it until at least three real experiment runs have produced evidence that a missing rubric category is causing escapes.
- The "QA never edits source" rule is the single most important boundary in sprint 003. If it slips, QA and Coder will collapse back into one over-stuffed agent and we lose the whole point of the separation.
