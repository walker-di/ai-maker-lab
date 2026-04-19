# Title

AI Maker Lab Paperclip Company Org Chart Plan

## Goal

Model the `ai-maker-lab` company inside paperclip with five small, single-purpose agents (CEO, Orchestrator, Coder, QA, Designer) so each role's prompt and tool surface stays small. The company's mission is to raise the quality of every plan in `docs/experiment/**` to a "ship-ready" bar, with explicit budgets, heartbeats, escalation paths, and exit criteria per role.

## Scope

- Define the company (`ai-maker-lab`) inside paperclip.
- Define the five roles, their runtimes, monthly budgets, heartbeats, allowed tools, escalation rules, and exit criteria.
- Define the reporting lines: CEO → Orchestrator → {Coder, QA, Designer}.
- Define the cross-role ticket flow at a high level (the detailed flow lives in `06-experiment-redo-workflow.md`).

Out of scope for this step:

- The detailed QA pipeline (Playwright + screenshot/video + vision rubric) — that is `04-qa-agent.md`.
- The per-agent `SKILLS.md` content — that is `05-skills-and-context-isolation.md`.
- The first end-to-end run against `docs/experiment/000` — that is `06-experiment-redo-workflow.md`.

## Architecture

- One paperclip company per sprint focus area; sprint 003 only models `ai-maker-lab`.
- Each agent runs in a separate paperclip "employee" so paperclip can scope budget, trace, and `SKILLS.md` per role.
- Coder is the only role allowed to write to the repo. CEO, Orchestrator, QA, and Designer are read-only against the source tree (QA may write under `docs/sprint/003/runs/` for its reports).
- Reporting line:

  ```
  CEO
   └── Orchestrator
        ├── Coder
        ├── QA
        └── Designer
  ```

## Implementation Plan

1. Create the company in paperclip.
   - Name: `ai-maker-lab`.
   - Mission: "Raise every plan under `docs/experiment/**` to a ship-ready bar with QA + design sign-off."
   - Total monthly budget cap: `$200` (sum of per-agent budgets below, leaving headroom for governance overrides).
2. Define the **CEO**.
   - Runtime: Claude Code (Anthropic).
   - Monthly budget: `$30`.
   - Heartbeat: `every 24h`.
   - Allowed tools: read-only repo access, ticket creation/closure, agent budget adjustments (governance).
   - Inputs: company mission, latest QA + Designer reports.
   - Responsibilities:
     - Approve the Orchestrator's per-experiment strategy.
     - Approve any new hire (paperclip's board-approval gate stays on).
     - Pause/resume agents that go off-mission.
   - Escalation: none (top of the org).
   - Exit criterion (per experiment): all of its tickets are closed with QA pass + Designer approve.
3. Define the **Orchestrator / PM**.
   - Runtime: Codex (OpenAI) or Claude Code; either works because the role is mostly text + ticket I/O.
   - Monthly budget: `$40`.
   - Heartbeat: `every 4h`.
   - Allowed tools: read-only repo access, ticket CRUD, assignment to Coder/QA/Designer, ability to file linked bug tickets.
   - Inputs: experiment plan files (`docs/experiment/000/*.md`, `001/*.md`, `002/*.md`), latest QA + Designer reports, CEO directives.
   - Responsibilities:
     - Split each experiment plan into Coder-sized tickets.
     - Route tickets to Coder, then to QA on completion, then to Designer on QA pass.
     - When QA fails, file a linked bug ticket back to Coder; when Designer requests polish, file a linked polish ticket.
   - Escalation: CEO, when scope expands or budget pressure mounts.
   - Exit criterion (per experiment): all tickets closed and the run report is archived under `docs/sprint/003/runs/`.
4. Define the **Coder**.
   - Runtime: Codex or Claude Code, run via paperclip's heartbeat against this repo's working tree.
   - Monthly budget: `$60` (highest, since this role does the actual implementation work).
   - Heartbeat: `every 1h`.
   - Allowed tools: full repo write access, `bun` scripts, git, the existing implementation skills.
   - Inputs: assigned ticket, the experiment plan it derives from, the existing skills `clean-architecture-frontend-svelte`, `svelte-frontend`, `backend-implementtion`.
   - Responsibilities:
     - Implement the ticket on a feature branch.
     - Run unit tests locally (`bun test` in the affected package).
     - Mark the ticket "ready for QA" with the branch name and a short summary.
   - Escalation: Orchestrator, when the ticket is ambiguous or blocked by missing infra.
   - Exit criterion (per ticket): branch pushed, unit tests green, ticket flipped to "ready for QA".
5. Define the **QA**.
   - Runtime: Claude Code (Anthropic) — vision-capable model required for the screenshot/video rubric.
   - Monthly budget: `$40`.
   - Heartbeat: `every 2h`, plus on-assignment trigger.
   - Allowed tools: read-only repo access, Playwright, screenshot/video capture, vision-model calls, write access only under `docs/sprint/003/runs/`.
   - Inputs: ticket marked "ready for QA", the experiment's acceptance criteria, the Coder's branch.
   - Responsibilities: see `04-qa-agent.md` for the full pipeline.
   - Escalation: Orchestrator, with either "QA pass" or a numbered list of defects.
   - Exit criterion (per ticket): a QA report exists under `docs/sprint/003/runs/<experiment>/<ticket-id>/qa.md` with verdict + evidence.
6. Define the **Designer**.
   - Runtime: Claude Code (Anthropic) — vision-capable model required for screenshot review.
   - Monthly budget: `$30`.
   - Heartbeat: `every 6h`, plus on-assignment trigger.
   - Allowed tools: read-only repo access, vision-model calls, ability to file polish tickets, write access only under `docs/sprint/003/runs/`.
   - Inputs: tickets marked "QA pass" with their evidence images.
   - Responsibilities:
     - Review screenshots/videos against a visual rubric (spacing, hierarchy, motion, contrast, brand fit).
     - Approve, or file a linked polish ticket back to the Orchestrator with annotated screenshots.
   - Escalation: Orchestrator, with either "Designer approve" or a polish ticket.
   - Exit criterion (per ticket): a design report exists under `docs/sprint/003/runs/<experiment>/<ticket-id>/design.md` with verdict + annotated evidence.
7. Wire reporting lines and approval gates in paperclip.
   - Orchestrator reports to CEO.
   - Coder, QA, Designer all report to Orchestrator.
   - Hire-new-agent gate stays on for everyone except the CEO.
   - Budget-override gate stays with the CEO only.
8. Capture the org chart and the per-role table in this file so future contributors do not have to dig through paperclip's UI to understand the company.

   | Role | Runtime | Budget / mo | Heartbeat | Writes To Repo? |
   | --- | --- | --- | --- | --- |
   | CEO | Claude Code | $30 | 24h | No |
   | Orchestrator | Codex or Claude Code | $40 | 4h | No |
   | Coder | Codex or Claude Code | $60 | 1h | Yes (full) |
   | QA | Claude Code | $40 | 2h + on-assign | Only `docs/sprint/003/runs/**` |
   | Designer | Claude Code | $30 | 6h + on-assign | Only `docs/sprint/003/runs/**` |

## Tests

- Hire each role in paperclip and confirm budgets, heartbeats, and reporting lines match the table above.
- File a no-op ticket through the full chain (Orchestrator → Coder → QA → Designer) using a trivial change (e.g. updating a comment) to verify the pipeline plumbing before running it on real experiment work.
- Confirm the hire-new-agent gate blocks any agent except CEO.

## Acceptance Criteria

- The company `ai-maker-lab` exists in paperclip with the five roles above.
- The role table in this file is reproduced verbatim and matches paperclip's configuration.
- Each non-CEO agent reports to the Orchestrator (or, for Orchestrator, to the CEO) in paperclip's org chart.
- A trivial end-to-end ticket has flowed through Orchestrator → Coder → QA → Designer without manual intervention beyond board approvals.
- The total monthly budget across the five agents equals `$200`.

## Dependencies

- `02-paperclip-setup.md` complete (paperclip installed and smoke tested).
- Provider keys: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`.
- Repo skills referenced by Coder: `clean-architecture-frontend-svelte`, `svelte-frontend`, `backend-implementtion` (already present in `.codex/skills` and `.cursor/skills`).

## Risks / Notes

- Budgets are starting points; expect to retune after the first real experiment run.
- The "Coder is the only writer" rule keeps audit trails clean. Loosening it (e.g. letting Designer push CSS edits directly) trades audit clarity for speed; do that intentionally, not by accident.
- Heartbeat cadences are optimized for a single developer watching the dashboard. If the company runs unattended, raise QA / Designer cadence so feedback loops do not stall.
- Paperclip's hire-new-agent gate stays on so the CEO cannot silently spawn extra Coders and blow the budget.
