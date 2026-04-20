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
3. Run paperclip onboarding with an explicit data directory so Postgres and instance files never land under the repo.
   ```bash
   npx paperclipai onboard -y --data-dir "$HOME/paperclip/ai-maker-lab"
   ```
   - You can run the command from any working directory; `-d` / `--data-dir` pins all instance state under that path.
   - Accept the embedded Postgres option during onboarding.
   - Pick a company name like `ai-maker-lab` so the multi-company isolation is obvious from the dashboard.
   - Optional: append `--run` to start the server immediately after config is saved.
4. Wire provider keys.
   - Create `~/paperclip/ai-maker-lab/.env` with the three keys above plus any paperclip-specific vars the onboarding emits.
   - Do **not** commit this file. It lives outside the repo, but call this rule out so future contributors do not move it.
5. Document the daemon lifecycle (see **Operator runbook** below).
   - Start: `npx paperclipai run -d "$HOME/paperclip/ai-maker-lab"` (or `onboard ... --run` right after first-time setup).
   - Stop: graceful shutdown of the Paperclip Node process (foreground: Ctrl+C).
   - Status / dashboard URL: URL printed at startup (typically `http://127.0.0.1:<port>/`; confirm the port from CLI output or your generated config).
   - Logs: foreground terminal output; use `npx paperclipai doctor -d ...` and `npx paperclipai env -d ...` for path and health diagnostics.
   - Reset: stop Paperclip, delete the install/data directory, re-run onboarding.
6. Smoke test.
   - From the dashboard, hire a single throwaway agent (any provider, low budget, e.g. `$1`).
   - File a single throwaway ticket: *"Reply with the string OK."*.
   - Confirm: ticket transitions to `done`, a trace is recorded, the budget did not blow up.
   - Delete the throwaway agent and ticket. The install is now ready for `03-company-org-chart.md` to model the real company.
7. Capture a one-page runbook in this file (start, stop, dashboard URL, log path, reset, smoke test) so future contributors do not re-derive it.

## Operator runbook

Use a single **install and data root** outside the monorepo. The canonical example path in this document is `~/paperclip/ai-maker-lab` (equivalently `$HOME/paperclip/ai-maker-lab`). Do not move this directory under `ai-maker-lab` source control.

### One-time install

```bash
mkdir -p "$HOME/paperclip/ai-maker-lab"
npx paperclipai onboard -y --data-dir "$HOME/paperclip/ai-maker-lab"
```

- `-y` / `--yes` accepts quickstart defaults for trusted local loopback (override reachability with `onboard --bind lan|tailnet` if you need more than loopback).
- Embedded Postgres and Paperclip instance files stay under this directory tree.

### Provider keys (install-local `.env`)

Create `$HOME/paperclip/ai-maker-lab/.env` (never commit it) with at least:

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
```

Before starting Paperclip, load these into the shell (for example `set -a && source .env && set +a` from that folder) or configure your process manager to inject them.

### Start

```bash
cd "$HOME/paperclip/ai-maker-lab"
set -a && [ -f .env ] && . ./.env && set +a
npx paperclipai run --data-dir "$HOME/paperclip/ai-maker-lab"
```

- `run` bootstraps with `onboard` + `doctor` when needed, then starts the API and dashboard.
- After the first successful onboard, you can also use `npx paperclipai onboard -y --data-dir "$HOME/paperclip/ai-maker-lab" --run` for a one-shot “save config and start” path.

### Stop

- **Foreground:** Ctrl+C in the terminal running `paperclipai run`.
- **Background:** stop the supervising unit or send **SIGTERM** to the Node process running Paperclip. Avoid SIGKILL during database writes.

### Dashboard URL

The CLI prints the local dashboard URL when the server listens. Expect a loopback URL such as `http://127.0.0.1:<PORT>/` (common default `PORT` is `3100` if free—always confirm from your run output or generated config).

### Logs and diagnostics

- **Foreground logs:** stdout/stderr from the `paperclipai run` process.
- **Health check:** `npx paperclipai doctor --data-dir "$HOME/paperclip/ai-maker-lab"` (add `--repair` / `-y` per `doctor --help` when fixing drift).
- **Effective paths and env expectations:** `npx paperclipai env --data-dir "$HOME/paperclip/ai-maker-lab"` (shows config file location, storage roots, and required variables for your setup mode).

### Reset (drop everything for this lane)

1. Stop Paperclip.
2. Delete the install/data directory, for example `rm -rf "$HOME/paperclip/ai-maker-lab"`, **only** when you intend to wipe companies, tickets, traces, and embedded Postgres for that path.
3. Re-run **One-time install** above.

### Smoke test (release gate)

From the dashboard:

1. Hire one throwaway agent (any provider, low monthly budget, for example about one dollar).
2. Create one throwaway issue: *Reply with the string OK.*
3. Confirm the issue reaches `done`, a trace is visible, and spend stayed within the test budget.
4. Delete the throwaway issue and retire/delete the throwaway agent.

Then confirm persistence: restart `paperclipai run`, reload the dashboard, and verify the database-backed history you expect is still present (excluding anything you intentionally deleted).

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
