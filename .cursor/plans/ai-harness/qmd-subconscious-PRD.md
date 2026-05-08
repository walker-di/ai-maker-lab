# PRD: QMD Subconscious for Pi

Status: Draft

Owner: AI Harness

Date: 2026-05-08

## Summary

QMD Subconscious is a local-first long-term memory layer for Pi. It watches Pi coding sessions, records raw traces, extracts durable memories into Markdown, indexes those memories with QMD-Py, and injects concise just-in-time guidance back into future Pi turns.

The product reproduces the useful behavior of `claude-subconscious` for Pi, but it uses Pi's native extension/session APIs and QMD-Py's local Markdown retrieval instead of Claude Code hooks and Letta-hosted memory.

## Problem

Pi already persists sessions as JSONL, supports session trees, supports compaction, and exposes extension events. The agent still needs better cross-session recall:

- It forgets user preferences after compaction, reload, or new sessions.
- It rediscovers the same project architecture and repo conventions.
- It repeats avoidable mistakes that should become harness memories.
- It loses pending work when a session ends mid-task.
- It spends turns gathering environment facts already known from earlier sessions.
- It lacks a sleep-time process that converts raw session work into durable memory.

Manual memory files are not enough. They drift, grow too large, and rely on the agent or user remembering to read and update them.

## Goals

- Provide automatic local memory recall before Pi agent work begins.
- Preserve raw session and turn traces for later diagnosis without stuffing them into model context.
- Convert important events into structured Markdown memory files with provenance.
- Use QMD-Py for BM25 search in MVP and optional hybrid retrieval when configured.
- Keep injection concise, relevant, advisory, and non-intrusive.
- Provide explicit commands to search, remember, forget, sync, debug, and inspect pending work.
- Fail safely: when QMD is unavailable, Pi continues in capture-only mode.
- Keep memory local and private by default.

## Non-Goals

- Build a hosted memory service.
- Require Letta or any remote memory provider.
- Replace Pi's session storage, compaction, skills, prompts, or extension package model.
- Automatically edit project source code during sleep-time consolidation.
- Guarantee perfect memory extraction from every transcript.
- Share memory across machines in v1.
- Commit generated memories to git by default.
- Require QMD embeddings or a long-running Python daemon for MVP.

## Target Users

### Primary: Solo Developer Using Pi Daily

Needs Pi to remember repo conventions, personal preferences, unfinished tasks, and local tool habits across sessions.

### Secondary: Harness Engineer

Wants raw traces and structured harness learnings to improve prompts, tools, guardrails, and verification loops.

### Secondary: Pi Package Author

Needs a clear Pi extension pattern for local memory packages that can be distributed through npm/git Pi packages.

## Product Principles

- **Whisper, do not steer blindly.** Memory should provide brief reminders, not dominate the task.
- **Raw traces first.** Preserve exact errors, commands, and session events so diagnosis does not depend on lossy summaries.
- **Markdown source of truth.** Users can inspect, edit, diff, suppress, and delete memory without a special UI.
- **QMD for retrieval.** Use QMD's local search to find the right memory at the right moment.
- **Pi-native integration.** Use Pi extension events, custom messages, commands, tools, and session APIs.
- **Safe defaults.** Local storage, local retrieval, no remote extraction, and secret exclusions by default.
- **Decay over deletion.** Suppress stale memories by metadata/ranking before hard deletion.

## User Stories

### Memory Recall

As a developer, when I submit a Pi prompt in a repo, I want relevant project context and pending work to be recalled automatically.

Acceptance:

- `before_agent_start` builds a retrieval query from the raw prompt, cwd, selected tools, context files, skills, and active pending items.
- Project and global QMD collections are searched with `qmd search` by default.
- A concise custom message is returned only when relevant memory is found.
- The same memory is not repeatedly injected in the same turn.
- If no relevant memory exists, no filler message is injected.
- If QMD fails, the prompt proceeds with no memory injection.

### Sleep-Time Memory

As a developer, when a Pi turn ends or a session shuts down, I want important facts to be captured in the background.

Acceptance:

- `agent_end` persists a turn trace with messages, tool calls, tool results, errors, and useful file/output pointers.
- `session_shutdown` flushes pending traces and starts or queues a detached worker.
- The worker is idempotent and can rerun without duplicate memories.
- The worker never blocks normal Pi exit, reload, new session, resume, or fork flows.

### Explicit Remember

As a developer, I want to tell Pi to remember a rule, preference, pending item, or project fact.

Acceptance:

- `/memory remember <kind> <text>` accepts only supported memory kinds.
- It creates a Markdown file under the correct project or global memory root.
- The file includes frontmatter with kind, scope, status, source, confidence, and timestamps.
- `qmd update <collection>` runs when QMD is available.
- The command reports the created file path and doc id when available.

### Explicit Search

As a developer, I want to search memory directly when I suspect the system already knows something.

Acceptance:

- `/memory search <query>` searches project and global collections.
- Results include kind, scope, score, title/path, status, and snippet.
- Debug mode can show QMD command details and raw JSON.
- Search still reports useful local-file fallback information if QMD is unavailable.

### Pending Work

As a developer, I want interrupted tasks to be visible at session start and searchable later.

Acceptance:

- Deterministic extraction creates or updates `pending_items` from TODOs, unresolved errors, explicit user follow-ups, and interrupted work.
- `/memory pending` lists active project pending items.
- `/memory forget <query>` can suppress stale or wrong pending items.
- Relevant pending items receive high recall priority.

### Harness Learning

As a harness engineer, I want repeated AI mistakes to become memory and eventually guardrails.

Acceptance:

- Failed commands, repeated test failures, blocked tool calls, user corrections, and verification misses can create `harness_learnings`.
- Harness memories include evidence pointers to raw traces or output files.
- Related harness memories can be injected before similar implementation work or tool use.
- MVP does not automatically block tools based on harness memory unless a static policy is configured.

### Privacy Control

As a developer, I want to know and control what is indexed.

Acceptance:

- Secrets, credentials, private keys, `.env` files, generated folders, dependency folders, binary files, and configured deny globs are excluded by default.
- `/memory debug` shows collection roots, exclusion settings, QMD status, last recall, and skipped reasons.
- `/memory forget <query>` suppresses matching memories without hard deletion.
- Raw traces have retention settings and can be cleaned up by command in a later polish milestone.

## Functional Requirements

### FR1: Pi Extension Package

The product shall ship as a Pi package with a TypeScript extension entrypoint.

Requirements:

- Load from `.pi/extensions`, `~/.pi/agent/extensions`, or an installed Pi package manifest.
- Use TypeScript loaded by Pi without a build step where supported.
- Import Pi extension types from the Pi coding-agent package.
- Register lifecycle handlers, commands, and optional tools.
- Support project-local and global configuration.
- Never require users to modify Pi internals.

### FR2: Pi Event Integration

The extension shall use source-backed Pi events, not Claude hook emulation.

Requirements:

- `session_start`: initialize config, directories, QMD status, collections, and checkpoints.
- `before_agent_start`: perform automatic recall and return a custom message when useful.
- `context`: enforce final budget and duplicate controls.
- `tool_call`: record tool intent and optionally enforce configured safety policy.
- `tool_result`: record result metadata, errors, truncation, and output pointers.
- `agent_end`: persist turn traces and enqueue extraction.
- `session_shutdown`: flush state and start detached work without blocking shutdown.
- Later versions may use `session_before_compact`, `session_compact`, `session_before_tree`, `session_tree`, `session_before_switch`, and `session_before_fork` for branch-aware memory.

### FR3: Configuration

The extension shall read project and global configuration.

Suggested config files:

```text
<project>/.pi/qmd-subconscious/config.jsonc
~/.pi/agent/qmd-subconscious/config.jsonc
```

Fields:

| Field | Default | Purpose |
| --- | --- | --- |
| `mode` | `whisper` | `off`, `capture`, `whisper`, `full`, `debug` |
| `qmdCommand` | `qmd` | QMD-Py CLI command or absolute path |
| `searchMode` | `bm25` | `bm25` uses `qmd search`; `hybrid` uses `qmd query` |
| `globalCollection` | `qmd-subconscious-global` | QMD global memory collection |
| `projectCollectionPrefix` | `qmd-subconscious-project` | Project collection prefix |
| `traceCollectionPrefix` | `qmd-subconscious-traces` | Optional raw trace collection prefix |
| `maxWhisperChars` | `1500` | Default injection budget |
| `maxFullChars` | `6000` | Full-mode injection budget |
| `recallTimeoutMs` | `1500` | Upper bound for pre-prompt QMD calls |
| `enableModelExtraction` | `false` | Whether worker may call a model |
| `indexRawTraces` | `false` | Whether raw traces are indexed by QMD |
| `retentionDays` | `30` | Raw trace retention target |
| `excludeGlobs` | built-in secret/binary patterns | Paths never indexed |

### FR4: Memory Vault

The extension shall create and maintain Markdown memory documents.

Requirements:

- Use YAML frontmatter.
- Store memory by kind and scope.
- Supported kinds: `core_directives`, `guidance`, `project_context`, `user_preferences`, `session_patterns`, `pending_items`, `self_improvement`, `tool_guidelines`, `harness_learnings`.
- Keep `raw_traces` separate from injected memory documents.
- Include provenance back to session id, entry id, turn id, trace path, or explicit user command.
- Support `status`, `confidence`, `recall_recency`, `created_at`, and `updated_at`.
- Avoid duplicates using source ids, normalized text hashes, and QMD search when available.

### FR5: QMD Collection Management

The extension shall manage QMD collections for global memory, project memory, and optional traces.

Requirements:

- Use `qmd status` to detect installation and health.
- Use `qmd add <collection> <path> --pattern "**/*.md"` to create collections.
- Use `qmd context add` to describe global memory, project memory, memory kinds, and traces.
- Use `qmd update <collection>` after memory changes.
- Use `qmd search ... --format json` for default BM25 retrieval.
- Use `qmd query ... --format json` only when `searchMode` is `hybrid`.
- Use `qmd get <docid-or-qmd-uri>` for full document lookup.
- Do not require `qmd embed` for MVP.
- Report missing/misconfigured QMD through `/memory debug` and continue capture-only.

### FR6: Automatic Recall

The extension shall retrieve memory before each agent prompt.

Requirements:

- Build a retrieval query from prompt, cwd, session metadata, selected tools, tool snippets, context files, skills, recent file paths, and active pending items.
- Query project memory before global memory.
- Rank by QMD score, kind priority, project scope match, recency, confidence, status, and injection history.
- Format a concise advisory whisper.
- Return a Pi custom message from `before_agent_start` when relevant.
- Respect mode and character budgets.
- Skip injection on low confidence, timeout, empty hits, or QMD error.

### FR7: Mid-Workflow Awareness

The extension shall observe tool activity and use it for traces and optional guidance.

Requirements:

- Listen to `tool_call`, `tool_result`, and relevant tool execution lifecycle events.
- Record tool name, input summary, result metadata, error status, and truncation markers.
- Use `tool_call` only for configured safety policies in MVP.
- Later versions may use `pi.sendMessage(..., { deliverAs: "steer" | "nextTurn" })` for mid-workflow memory updates.
- Never block tools only because QMD retrieval fails.

### FR8: Raw Trace Capture

The extension shall persist raw traces suitable for later diagnosis.

Requirements:

- Capture user prompts, assistant messages, tool calls, tool results, custom memory injections, changed/read file evidence when available, command output pointers, errors, branch leaf id, and session file path.
- Keep exact snippets for critical failures.
- Store large outputs as files and reference those paths.
- Avoid indexing excluded paths and secrets.
- Preserve enough data to compare successful and failed workflows later.

### FR9: Sleep-Time Worker

The product shall consolidate memory asynchronously.

Requirements:

- Worker can be launched after `agent_end` and `session_shutdown`.
- Worker reads unprocessed traces, existing memory docs, and checkpoints.
- Worker writes deterministic memory candidates without a remote model.
- Deterministic extraction must cover explicit preferences, pending items, failed commands, user corrections, project rules from loaded context files, and edited/read path facts.
- Optional model extraction can be enabled later and must be explicit.
- Worker updates QMD when available and logs errors without breaking active Pi usage.
- Worker is idempotent.

### FR10: Commands

The extension shall register memory commands.

| Command | Requirement |
| --- | --- |
| `/memory search <query>` | Search project/global memories and show ranked results. |
| `/memory remember <kind> <text>` | Create explicit memory using a supported kind. |
| `/memory forget <query>` | Suppress or decay matching memories. |
| `/memory pending` | Show active project pending items. |
| `/memory sync` | Force worker processing and QMD update. |
| `/memory debug` | Show config, paths, QMD status, last recall, checkpoints, and errors. |

### FR11: Optional Model Tools

The extension may register model-callable memory tools.

Tools:

- `qmd_memory_search`
- `qmd_memory_get`
- `qmd_memory_write`

Requirements:

- Tools use `pi.registerTool()`.
- Tools include `promptSnippet` and tool-specific `promptGuidelines` that name the tool explicitly.
- Write-capable tools are disabled or policy-gated by default.
- Tool outputs are truncated, source-linked, and safe for model context.

## Non-Functional Requirements

### Performance

- `before_agent_start` recall should complete within 500 ms p50 and 1.5 s p95 after QMD warm-up.
- If QMD exceeds `recallTimeoutMs`, skip injection and continue.
- Worker processing must not block the Pi UI or shutdown.
- QMD updates should be batched after worker writes.

### Reliability

- Extension failure must not prevent Pi from running.
- QMD failure degrades to capture-only mode.
- Worker is checkpointed and idempotent.
- Corrupted memory files are reported and skipped.
- `/memory debug` provides actionable status for missing QMD, bad collections, and parse failures.

### Security

- Local-only by default.
- No remote extraction unless explicitly enabled.
- Built-in exclusion for secrets, credentials, binary files, generated folders, and dependency folders.
- File writes constrained to configured memory and trace directories.
- Debug output redacts sensitive content and avoids full raw trace dumps by default.

### Observability

- Write logs under the QMD Subconscious state directory.
- `/memory debug` exposes mode, roots, collection names, search mode, last recall query, hit count, skipped reason, QMD status, and worker checkpoint.
- Worker logs include processed trace ids, created memory ids, updated memory ids, skipped duplicates, and errors.

### Maintainability

- Keep Pi adapter, QMD adapter, memory model, ranking, redaction, and worker orchestration separate.
- Use typed Pi event payloads and helper guards when available.
- Keep QMD CLI wrappers small enough to replace with a daemon/client later.

## UX Requirements

### Whisper Format

Default whisper:

```markdown
<qmd_subconscious>
Relevant memory:
- Project context: Frontend code should import browser-safe contracts from `domain/shared`, not the domain package root.
- Pending: Last session left `test:e2e:chat` failing after message persistence changes.

Use this only if it helps the current task.
</qmd_subconscious>
```

Rules:

- No generic encouragement.
- No filler when no relevant memory exists.
- No repeated blocks in the same turn.
- Include source labels only in debug mode.
- Prefer actionable bullets.
- Keep memory weaker than explicit user instructions.

### Command Output

Command output should be compact and path-based:

```text
3 memories found for "chat transport":
1. project_context score=0.84 .pi/qmd-subconscious/memory/project_context/chat-transport.md
   Streaming uses AI SDK Chat; CRUD uses dedicated ChatTransport.
2. harness_learnings score=0.72 .pi/qmd-subconscious/memory/harness_learnings/no-api-url-in-page-models.md
   Page models must depend on app adapters, not raw /api URLs.
```

### Debug Output

`/memory debug` should show:

- Active config files and resolved mode.
- Global and project memory roots.
- QMD command, version/status if available, collections, and search mode.
- Last recall query, timeout, hit count, injected ids, and skipped reason.
- Worker checkpoint and last error.
- Exclusion settings without printing secret file contents.

## MVP Scope

MVP should prove the core loop without overbuilding.

Included:

- Pi extension loads and registers commands.
- Project/global memory directories are created.
- QMD CLI adapter supports `status`, `add`, `context add`, `update`, `search`, `query`, and `get`.
- Default retrieval uses `qmd search` BM25.
- `/memory remember`, `/memory search`, `/memory pending`, `/memory sync`, `/memory debug`, and `/memory forget`.
- Automatic `before_agent_start` recall in `whisper` mode.
- Basic trace capture for prompts, tool failures, tool metadata, and edited/read file evidence when available.
- Deterministic worker extraction for explicit preferences, pending items, failed commands, user corrections, and project rules.
- Secret/path exclusion defaults.
- Capture-only fallback when QMD is unavailable.

Excluded from MVP:

- Remote/model-based extraction.
- Complex UI widgets.
- Full branch/tree-aware memory routing.
- Automatic tool blocking based on retrieved memory.
- Team/shared memory sync.
- Long-running QMD daemon.
- Required QMD embeddings.
- Default indexing of raw traces.

## Future Scope

- Model-assisted extractor with local model option.
- Hybrid QMD retrieval with embeddings and reranking.
- Counterfactual harness diagnosis over raw traces.
- Memory quality scoring and review UI.
- Branch-aware memory scoped to Pi session tree leaves.
- Compaction-aware extraction.
- Team memory export/import.
- QMD MCP integration for other clients.
- Auto-generated harness proposals from repeated failures.
- Package marketplace publication.

## Metrics

### Product Metrics

- Percentage of prompts where memory was injected.
- User-invoked `/memory search` success rate.
- Explicit memories created.
- Pending items resolved or suppressed.
- Repeated failures converted into harness learnings.

### Quality Metrics

- Recall precision from manual review of injected whispers.
- Duplicate memory rate.
- Stale/incorrect memory reports.
- Worker extraction error rate.
- QMD timeout rate.

### Performance Metrics

- Recall latency p50/p95.
- Worker processing duration.
- QMD update duration.
- Memory vault size.
- Trace retention size.

## Risks

| Risk | Mitigation |
| --- | --- |
| Irrelevant memory pollutes context | Strict budgets, ranking, per-session dedupe, no injection on low confidence. |
| QMD CLI latency hurts prompt start | Timeouts, cached status, batched indexing, future daemon option. |
| Memory becomes stale or wrong | Decay metadata, `/memory forget`, provenance, status fields. |
| Secrets get indexed | Default exclude globs, gitignore awareness, redaction pass. |
| Background worker writes bad memories | Deterministic MVP, source links, user-editable Markdown. |
| Python dependency complicates install | Clear `qmd status` check, helpful errors, capture-only fallback. |
| Agent treats whisper as stronger than user intent | Advisory format and explicit subordinate wording. |
| Pi extension API shifts | Keep Pi integration isolated and source-backed. |

## Open Questions

- Should team-shared memory be an opt-in export/import flow, or a checked-in `.pi/qmd-subconscious/memory` convention?
- Should model-assisted extraction use Pi's active model, a separate configured provider, or local-only models?
- Should raw traces ever be indexed by default, or only searched by explicit debug commands?
- How should detached workers behave on Windows and Termux where process detachment differs?

## Delivery Plan

### Milestone 1: Extension Skeleton

Tasks:

- Create package/extension structure.
- Load project and global config.
- Register `/memory debug`.
- Create state directories.
- Handle `session_start` and `session_shutdown`.
- Restore persisted extension state from files and `qmd-subconscious` custom entries.

Acceptance:

- Pi can load the extension from an auto-discovered extension location.
- `/memory debug` shows paths, mode, QMD status, and checkpoints.
- Extension errors do not stop Pi.

### Milestone 2: QMD Adapter and Explicit Memory

Tasks:

- Wrap `qmd status`, `qmd add`, `qmd context add`, `qmd update`, `qmd search`, `qmd query`, and `qmd get`.
- Add timeout and JSON parsing.
- Initialize project/global collections.
- Implement `/memory remember` and `/memory search`.

Acceptance:

- `/memory remember project_context "..."` writes Markdown and updates QMD when available.
- `/memory search "..."` returns ranked snippets from project/global memory.
- Missing QMD produces capture-only status, not a crash.

### Milestone 3: Automatic Whisper

Tasks:

- Build retrieval query from Pi `before_agent_start` event data.
- Rank and budget hits.
- Inject a custom message only when relevant.
- Track per-turn and per-session injection hashes.

Acceptance:

- Relevant explicit memory appears before a matching prompt.
- No whisper appears for unrelated prompts.
- Low confidence, timeout, and QMD errors skip injection.

### Milestone 4: Trace Capture and Worker

Tasks:

- Capture turn traces from `agent_end`, `tool_call`, and `tool_result`.
- Store output pointers for large/truncated outputs.
- Implement deterministic extraction and checkpoints.
- Reindex changed memory.

Acceptance:

- Failed commands become candidate `harness_learnings` or `pending_items`.
- Explicit user preferences become `user_preferences`.
- Worker can rerun without duplicates.

### Milestone 5: Safety and Polish

Tasks:

- Add exclusion and redaction rules.
- Add `/memory forget`, `/memory pending`, and `/memory sync`.
- Add optional model tools with policy gates.
- Add README install/config/troubleshooting.

Acceptance:

- Secret-like files are skipped.
- Users can suppress bad memory.
- Model-callable write tool is disabled or gated by default.
- Docs explain QMD install, BM25 default, hybrid optional setup, and capture-only fallback.

## Related documents

- Program-level harness ADR/PRD (context for how QMD Subconscious fits the wider Pi harness): `.cursor/plans/ai-harness/ai-harness-ADR.md`, `.cursor/plans/ai-harness/ai-harness-PRD.md`
- Consolidated harness research: `.cursor/plans/ai-harness/lernings/herness-study-consolidated.md`, `.cursor/plans/ai-harness/lernings/pi-extension.md`

## References

- Claude Subconscious repository: https://github.com/letta-ai/claude-subconscious
- Pi coding agent repository: https://github.com/earendil-works/pi/tree/main/packages/coding-agent
- Pi extensions documentation: https://pi.dev/docs/latest/extensions
- Pi session format documentation: https://pi.dev/docs/latest/session-format
- Pi JSON event stream mode: https://pi.dev/docs/latest/json
- Pi RPC mode: https://pi.dev/docs/latest/rpc
- QMD-Py package: https://pypi.org/project/qmd/
- Local ADR: `.cursor/plans/ai-harness/qmd-subconscious-ADR.md`
- Local learning notes: `.cursor/plans/ai-harness/lernings/`
