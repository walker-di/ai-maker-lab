# Sprint 003 — Paperclip company (video pack)

This folder defines how `ai-maker-lab` runs as a **five-role Paperclip company** (CEO → Orchestrator → Coder / QA / Designer) to push `docs/experiment/**` plans toward ship-ready work with QA and design sign-off.

## How this compares to other sprint docs in the repo

| Sprint folder | In repo? | Shape |
| --- | --- | --- |
| `docs/sprint/001` | yes | `refs.md` plus numbered `plans/NN-*.md` files (each plan: Title, Goal, Scope, Architecture, Implementation Plan, Tests, Acceptance Criteria, Dependencies, Risks) |
| `docs/sprint/000`, `docs/sprint/002` | not checked in here | Treat the **same shape** as 001 when you script the video: one refs file, a stable ordering of numbered plans, no extra prose required outside those plans. |
| `docs/sprint/003` (here) | yes | Same **refs + numbered plans** contract as 001, **plus** optional Excalidraw: a **roadmap strip** (`storyboard.excalidraw`, six cards in plan order) and a **single-canvas narrative** (`presentation.excalidraw`, comparison + org chart + loop). |

If you are editing for a recording, prefer **reading order** below; it is tighter than file-name sort alone.

## Suggested on-camera chapters (maps 1:1 to plans)

| Chapter | Read | One-sentence beat |
| --- | --- | --- |
| 1 | [plans/01-tooling-comparison.md](plans/01-tooling-comparison.md) | Why Paperclip for sprint 003 instead of assembling the same primitives on pi.dev. |
| 2 | [plans/02-paperclip-setup.md](plans/02-paperclip-setup.md) | Install, env, smoke test — prove the control plane before hiring roles. |
| 3 | [plans/03-company-org-chart.md](plans/03-company-org-chart.md) | The five agents, budgets, heartbeats, who may write the repo vs `docs/sprint/003/runs/**`. |
| 4 | [plans/04-qa-agent.md](plans/04-qa-agent.md) | QA pipeline: Playwright, screenshots/video, vision rubric, report path. |
| 5 | [plans/05-skills-and-context-isolation.md](plans/05-skills-and-context-isolation.md) | Per-role `SKILLS.md` outside the repo so contexts stay small. |
| 6 | [plans/06-experiment-redo-workflow.md](plans/06-experiment-redo-workflow.md) | End-to-end loop on `docs/experiment/000` and what “done” means for the sprint. |

## Excalidraw

| File | Use in edit |
| --- | --- |
| [storyboard.excalidraw](storyboard.excalidraw) | **Roadmap / chapter strip** — same information density as a classic sprint-001-style deck: one card per numbered plan, left-to-right. |
| [presentation.excalidraw](presentation.excalidraw) | **B-roll / deep diagram** — pi.dev vs Paperclip, org chart, ticket loop, evidence paths on one tall canvas. |

## Cross-links for B-roll

- Default experiment the workflow cites: [docs/experiment/000](../../experiment/000/)
- Repo-wide pointer from [AGENTS.md](../../AGENTS.md) (Documentation Direction) into this sprint.

## Material checklist (is it “enough” for a video?)

You have: **six** self-contained plans (goals, scope, acceptance criteria, risks), **refs** for external URLs, **two** visuals at different abstraction levels, and **this README** as the narrator script spine. That matches or exceeds what `docs/sprint/001` provides for a comparable-length episode, with the diagrams as extra runway for Paperclip-specific explanation.
