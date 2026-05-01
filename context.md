# Anticipating upstream pi-subagents PRs

---

## PR #113 — Package agent tier + resumable sessions

PR: https://github.com/nicobailon/pi-subagents/pull/113 | Author: `blai` | +479/-26

### What lands

1. **Package agent tier** — new `package` source in priority chain: `builtin < package < user < project`
2. **Resumable sessions** — `resume: true` + `sessionDir` for SINGLE-mode subagent calls

---

## Impact on ai-maker-lab agent setup

### Current state

Agents live in `~/.pi/agent/agents/` (user scope):
- `backend-worker.md`, `frontend-worker.md`, `designer.md`, `domain-reviewer.md`, `qa-worker.md`
- Chains: `implement-test-review.chain.md`, `scout-implement-review.chain.md`

### What changes (nothing breaks)

User-scope agents already sit above `package` in the priority chain. No name collisions with known builtins. Agent list will now show `[user]` badge explicitly (was already the case, but now `[pkg]` exists as a distinct label for package agents).

### What to adopt

#### 1. Resumable iterative workflows

The chains already pass `{previous}` between steps — inter-step context flows fine. But **multi-pass single-agent work** benefits from `resume: true`:

```
# Iterative backend work (step 1 → step 2 with full memory)
{ agent: "backend-worker", task: "Implement repository layer for threads",
  sessionDir: "/tmp/feature-threads" }

# Later...
{ agent: "backend-worker", task: "Now add the use case layer",
  sessionDir: "/tmp/feature-threads", resume: true }
```

This eliminates re-pasting scout reports or prior implementation context between iterations. Best for:
- Multi-step feature implementation with `backend-worker` or `frontend-worker`
- Iterative design review loops with `designer`
- QA re-runs where `qa-worker` should remember prior test failures

**Constraints to remember:**
- SINGLE mode only — chains/parallel already handle their own per-step sessions
- Cannot combine with `context: 'fork'`
- First call with no prior session silently starts fresh (safe)

#### 2. Package-tier agent sharing

The Paperclip company agents (backend-worker, frontend-worker, designer, domain-reviewer, qa-worker, chains) are project-specific but the *pattern* is reusable. Once PR #113 lands, a pi extension could register a shared agents directory:

```ts
pi.events.emit("subagents:register-agent-dir", {
  dir: "/path/to/shared-paperclip-agents"
})
```

Those would appear as `[pkg]` and be overridable per-project. This matters if ai-maker-lab agents are reused across multiple repos.

**Not urgent** — current user-scope placement works. But worth considering if the Paperclip pattern is extracted into a standalone pi extension.

---

## Preparation done

### Chain updates (resume-ready patterns)

Both chains (`implement-test-review`, `scout-implement-review`) work unchanged since resume is SINGLE-only and chains use `{previous}` for step-to-step context.

New workflow patterns to use once PR #113 merges:

**Iterative implementation with memory:**
```
{ agent: "backend-worker", task: "Step 1: domain layer",
  sessionDir: "/tmp/feature-X" }
{ agent: "backend-worker", task: "Step 2: application layer",
  sessionDir: "/tmp/feature-X", resume: true }
{ agent: "backend-worker", task: "Step 3: adapters",
  sessionDir: "/tmp/feature-X", resume: true }
```

**Design iteration loop:**
```
{ agent: "designer", task: "Sketch layout for settings page",
  sessionDir: "/tmp/design-settings" }
{ agent: "designer", task: "Revise based on feedback: needs more whitespace",
  sessionDir: "/tmp/design-settings", resume: true }
```

**QA re-validation:**
```
{ agent: "qa-worker", task: "Validate thread CRUD",
  sessionDir: "/tmp/qa-threads" }
{ agent: "qa-worker", task: "Re-run after fixes, focus on edge cases from last run",
  sessionDir: "/tmp/qa-threads", resume: true }
```

### Agent naming (no collision risk)

Checked all five agent names against known pi-subagents builtins — no collisions. The `package` tier inserts below `user`, so even if a future package ships a `backend-worker`, the user-scope version wins.

---

## Watch list when PR #113 ships

1. **`sessionFile` in results** — now always surfaced when sessions are used (not just when `share: true`). Useful for debugging failed runs.
2. **`[pkg]` badge in agent list** — new visual in `subagent { action: "list" }`. Don't confuse with `[builtin]`.
3. **`subagents:register-agent-dir` event** — new extension surface. If writing a pi extension for ai-maker-lab, this is the hook for sharing agents.
4. **Process-global `extraAgentDirs`** — package dirs persist across session resets unless explicitly unregistered. If agents appear stale after extension changes, check registration lifecycle.

---

## PR #40 — Stream mode for chain execution

PR: https://github.com/nicobailon/pi-subagents/pull/40 | Author: `vekexasia` | +402/-38

### What lands

Live inline rendering of chain step output instead of compact summary. Each step's assistant messages, tool calls, and thinking are rendered using pi-mono's `AssistantMessageComponent` and `ToolExecutionComponent` — matching the main chat look. A sticky bottom status bar shows chain progress with blinking animation:

```
✓ scout 12s → ● planner 3s → ○ worker
```

### Activation methods (four ways)

1. `stream: true` tool parameter — `{ chain: [...], stream: true }`
2. `--stream` CLI flag — `/chain scout "task" -> planner --stream`
3. `v` toggle in chain clarify TUI
4. `streamModeByDefault` config flag — defaults to `true` (stream is ON by default)

### Impact on ai-maker-lab chains

Both chains benefit immediately with zero changes:

- **`implement-test-review`**: Live visibility into worker writing code, qa-worker running tests, domain-reviewer reporting findings. No more waiting for the compact summary to see if the worker went off-track.
- **`scout-implement-review`**: Watch the scout investigate, the worker implement, and the reviewer critique — all inline as it happens.

This is especially valuable for the longer steps (worker can take minutes on complex tasks). You'll be able to spot problems mid-step instead of after.

### What to adopt

**Nothing to change** — `streamModeByDefault: true` means chains stream automatically after this merges. Both chains work as-is.

**Optional config if compact view is preferred for some workflows:**
```json
{ "streamModeByDefault": false }
```
Then use `--stream` or `v` toggle selectively per invocation.

### New tool parameter for programmatic use

```
{ chain: [{agent: "scout", task: "..."}, {agent: "worker"}],
  stream: true }
```

Useful when invoking chains via the subagent tool rather than `/chain` slash command.

### New type surface

- `Details.stream?: boolean` — indicates stream mode in results
- `ExtensionConfig.streamModeByDefault?: boolean` — global config flag
- `DisplayItem` gains `{ type: "thinking"; thinking: string }` variant
- `CHAIN_STATUS_WIDGET_KEY` — new widget key for the sticky status bar
- `formatToolCallThemed()` — themed tool call formatting (used internally)

### Watch list when PR #40 ships

1. **Default is stream ON** — all `/chain` runs will show live output. If this is too noisy for quick chains, set `streamModeByDefault: false`.
2. **Status widget** — a new `subagent-chain-status` widget appears at the bottom during chain runs. It auto-clears on completion/error.
3. **`extractBgFlag` renamed to `extractFlags`** — internal change, but if any custom extensions called this, they'd break.
4. **Thinking content in display items** — `getDisplayItems()` now includes thinking parts from assistant messages. Extensions consuming display items should handle the new `thinking` type.
