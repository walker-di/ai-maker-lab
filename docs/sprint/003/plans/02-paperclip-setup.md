# Title

Paperclip Local Install And Daemon Lifecycle Plan

## Goal

Stand up a local paperclip deployment that lives **outside** the `ai-maker-lab` Bun workspace, configured with the AI provider keys we already use, and verified end-to-end by a single dummy ticket before any real company is modeled. The deployment must not pollute the monorepo with paperclip's embedded Postgres files, generated configs, or runtime logs.

## Scope

- Install paperclip via `npx paperclipai onboard --yes`.
- Pin paperclip's working directory and data directory to a sibling folder (default: `~/paperclip/ai-maker-lab/`) outside the repo.
- Wire provider keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) into paperclip's environment.
- Document daemon start/stop, log location, and how to reset.
- Run a single throwaway "hello, world" ticket against a single throwaway agent to confirm the install works.

Out of scope for this step:

- Defining real roles, budgets, or skills (covered in `03-company-org-chart.md` and `05-skills-and-context-isolation.md`).
- Running paperclip against real experiment plans (covered in `06-experiment-redo-workflow.md`).
- Any in-repo paperclip adapter, MCP server, or CI integration.

## Architecture

- **Install host**: developer workstation. No remote deploy yet.
- **Install location**: `~/paperclip/ai-maker-lab/` (or any path outside the repo). The repo references it only by absolute path in this plan; nothing in `apps/desktop-app` or `packages/*` depends on the location.
- **Data store**: paperclip's embedded Postgres, kept inside the install location. Never under the repo working tree.
- **Provider keys**: loaded from a paperclip-local `.env` file in the install location. Keys are not duplicated into the repo's `.env` files.
- **Repo coupling**: zero. The repo is the *target* of paperclip's coder agents; it does not need to know paperclip exists.

## Implementation Plan

1. Pre-flight checks.
   - Confirm Node.js is available (paperclip ships as `npx paperclipai`).
   - Confirm none of the provider keys are missing: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` (these are already required by sprint 001 work; see [docs/sprint/001/plans/01-model-card-handler.md](../../../sprint/001/plans/01-model-card-handler.md)).
   - Confirm the chosen install path does not exist yet, to avoid colliding with another paperclip instance.
2. Create the install directory outside the repo.
   ```bash
   mkdir -p ~/paperclip/ai-maker-lab
   cd ~/paperclip/ai-maker-lab
   ```
3. Run paperclip onboarding.
   ```bash
   npx paperclipai onboard --yes
   ```
   - Accept the embedded Postgres option during onboarding.
   - Pick a company name like `ai-maker-lab` so the multi-company isolation is obvious from the dashboard.
4. Wire provider keys.
   - Create `~/paperclip/ai-maker-lab/.env` with the three keys above plus any paperclip-specific vars the onboarding emits.
   - Do **not** commit this file. It lives outside the repo, but call this rule out so future contributors do not move it.
5. Document the daemon lifecycle.
   - Start: documented command from paperclip onboarding output.
   - Stop: documented command from paperclip onboarding output.
   - Status / dashboard URL: capture the local URL paperclip prints.
   - Logs: capture the log path paperclip uses.
   - Reset: a clear "drop everything" recipe (delete the install directory, re-run onboarding) for when an early-stage misconfig needs a clean slate.
6. Smoke test.
   - From the dashboard, hire a single throwaway agent (any provider, low budget, e.g. `$1`).
   - File a single throwaway ticket: *"Reply with the string OK."*.
   - Confirm: ticket transitions to `done`, a trace is recorded, the budget did not blow up.
   - Delete the throwaway agent and ticket. The install is now ready for `03-company-org-chart.md` to model the real company.
7. Capture a one-page runbook in this file (start, stop, dashboard URL, log path, reset, smoke test) so future contributors do not re-derive it.

## Tests

- Smoke test ticket completes successfully and the trace is visible in the dashboard.
- Restarting the daemon preserves the smoke test ticket and its trace (verifies persistence is on disk, not in memory).
- Killing and re-starting the daemon mid-ticket does not corrupt the database (verifies embedded Postgres is durable enough for a single-developer install).

## Acceptance Criteria

- Paperclip is installed at a documented path **outside** the repo.
- The runbook in this file lists the exact commands to start, stop, reset, and view logs.
- All three provider keys are loaded by paperclip and at least one of them is exercised by the smoke test.
- The smoke ticket completed end-to-end and the throwaway agent / ticket have been deleted.
- No file under `apps/desktop-app/`, `packages/`, or `docs/sprint/003/` (except this plan) references the absolute install path; the path is configuration, not code.

## Dependencies

- Existing environment variables from sprint 001 chat work.
- External docs:
  - [paperclip.ing](https://paperclip.ing/) install section.
  - [paperclip.ing/llms.txt](https://paperclip.ing/llms.txt) for agent-facing install instructions.
- No new repo dependencies; paperclip is invoked via `npx`.

## Risks / Notes

- Putting the install inside the repo would drag the embedded Postgres data files, paperclip configs, and logs into git. The "outside the repo" rule is mandatory.
- `npx paperclipai onboard --yes` is interactive even with `--yes`; budget a few minutes for the first run.
- If the developer already runs paperclip for a different project, choose a distinct company name and a distinct install directory; do not share Postgres data between projects.
- Paperclip auto-pauses agents at 100% budget. A `$1` smoke agent is intentional so a misfire cannot cost more than a dollar.
