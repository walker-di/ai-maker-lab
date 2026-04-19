# Title

pi.dev vs Paperclip Tooling Comparison Plan

## Goal

Decide which orchestration tool sprint 003 adopts to coordinate multiple specialized AI agents (CEO, Orchestrator, Coder, QA, Designer) without ballooning any single agent's context. Make the rationale explicit so the choice can be revisited in a later sprint when the appetite shifts from "use an external tool" to "embed orchestration into `apps/desktop-app`".

## Scope

- Compare `pi.dev` and `paperclip` strictly along the axes that matter for sprint 003: multi-agent orchestration, tickets, budgets, heartbeats, governance, and "what do we have to build ourselves".
- Pick exactly one tool for sprint 003.
- List the responsibilities deliberately deferred (no in-repo orchestration code, no MCP server, no custom TUI) so future sprints know what was punted.

Out of scope for this step:

- Building an in-repo paperclip adapter or MCP integration.
- Embedding pi.dev (or any orchestration runtime) into `apps/desktop-app`.
- Replacing the Vercel AI SDK chat runtime decided in [docs/sprint/001/plans/01-model-card-handler.md](../../../sprint/001/plans/01-model-card-handler.md).

## Architecture

- Sprint 003 treats orchestration as an **external** concern. The chosen tool runs alongside the repo, not inside it.
- The repo continues to expose the same surfaces it already exposes: `bun run` scripts, Playwright e2e per `apps/desktop-app/AGENTS.md`, and the existing skills in `.codex/skills` and `.cursor/skills`.
- Agents authored in the orchestrator drive the repo through standard CLIs (Claude Code, Codex, shell, Playwright). No orchestration-specific code lands in `apps/desktop-app`, `packages/ui`, or `packages/domain`.

## Implementation Plan

1. Frame the comparison in terms of sprint 003's needs.
   - Multiple specialized agents with isolated context.
   - A QA agent that can run Playwright + capture screenshots/video and feed them to a vision model.
   - A planner / orchestrator that breaks experiment plans into tickets and routes them.
   - Cost ceilings so a runaway agent does not burn the monthly budget.
2. Compare the two tools on a fixed capability matrix.

   | Capability | pi.dev | paperclip |
   | --- | --- | --- |
   | Primary form factor | Minimal terminal harness (TUI / SDK / RPC / print) | Self-hosted runtime + web control plane |
   | Multi-agent orchestration | Build it yourself via extensions or `tmux` | First-class: org chart, roles, reporting lines |
   | Tickets / threaded work | Build it yourself (e.g. `TODO.md` or extension) | First-class ticket system with full trace and audit log |
   | Heartbeats / scheduled work | Build it yourself | First-class scheduled heartbeats per agent |
   | Per-agent budgets | Build it yourself | First-class hard monthly budgets, auto-pause at 100% |
   | Governance / approvals | Build it yourself | First-class board approval gates |
   | Multi-company isolation | N/A | First-class, one deployment, many companies |
   | BYO agent runtime | Yes (TypeScript extensions, providers, OAuth) | Yes (Claude Code, Codex, Cursor, OpenClaw, shell, HTTP) |
   | Skills / runtime context injection | Yes (skills, prompt templates, AGENTS.md) | Yes (`SKILLS.md` per agent, runtime skill injection) |
   | Persistence | Tree-structured session files | Embedded Postgres or BYO Postgres |
   | License | MIT-style minimal harness | MIT, self-hosted, no account required |
   | Best fit | **Embedding** a custom coding loop inside another app | **Running** a small AI company against an existing repo |

3. State the decision.
   - Adopt **paperclip** for sprint 003.
   - Reason: every primitive sprint 003 needs (tickets, heartbeats, budgets, org chart, governance) is shipped. We avoid building a parallel orchestration layer just to validate the experiment redo loop.
4. State the deferred direction.
   - Re-evaluate **pi.dev** when the goal shifts to embedding a coding/orchestration loop inside `apps/desktop-app` (e.g. the desktop app itself becomes a host for agents). pi.dev's SDK and four-mode integration story (interactive / print-JSON / RPC / SDK) is a much better fit for that use case than paperclip's web control plane.
5. Publish an explicit defer list so a later sprint does not redo this work.
   - No in-repo orchestration code in this sprint.
   - No MCP server bridging paperclip and the repo.
   - No custom TUI or web UI.
   - No replacement of existing skills in `.codex/skills` or `.cursor/skills`.

## Tests

- Documentation-only plan; the "test" is that downstream plans (`02` through `06`) can be written without rediscovering the paperclip vs pi.dev decision.
- Acceptance is verified by reading `02-paperclip-setup.md` and `03-company-org-chart.md` and confirming neither references pi.dev as a runtime.

## Acceptance Criteria

- The capability matrix above is reproduced verbatim in this file.
- The decision section names paperclip explicitly and justifies it in one paragraph.
- The defer list enumerates at least four things sprint 003 deliberately does not do.
- A future "embed orchestration" sprint can be opened that points back to this file as the rationale for revisiting pi.dev.

## Dependencies

- External references:
  - [pi.dev](https://pi.dev/)
  - [paperclip.ing](https://paperclip.ing/)
  - [paperclip.ing/llms.txt](https://paperclip.ing/llms.txt)
- Internal references:
  - [docs/sprint/001/plans/01-model-card-handler.md](../../../sprint/001/plans/01-model-card-handler.md) for the existing AI runtime decision.
  - [apps/desktop-app/AGENTS.md](../../../../apps/desktop-app/AGENTS.md) for the e2e conventions QA reuses.

## Risks / Notes

- paperclip is young; APIs and storage formats may shift. The defer list keeps repo coupling minimal so a swap stays cheap.
- pi.dev may evolve features (sub-agents, plan mode, ticketing) that change this comparison. Re-read both pages before opening the embed sprint.
- This decision is scoped to *external* orchestration. It does not foreclose using either tool as a library inside `apps/desktop-app` later.
