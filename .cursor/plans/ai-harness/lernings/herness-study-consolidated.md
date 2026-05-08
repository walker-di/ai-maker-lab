# Harness Study Consolidated: Best Practices for Pi

## Executive Summary

Pi is already shaped like the right foundation for harness engineering: a minimal terminal coding harness with extensibility in TypeScript extensions, Agent Skills, prompt templates, session trees, compaction, RPC, SDK usage, and shareable Pi packages.

The main opportunity is not to hardcode a large orchestration framework into Pi core. The opportunity is to package reliable harness patterns on top of Pi:

- Safer defaults through extensions and project packages.
- Reusable skill templates with short entry prompts and deeper references.
- Deterministic evaluators that run tests, lint, type checks, Playwright checks, and diff checks.
- Memory and raw trace capture that preserve facts without stuffing the context window.
- Small generator/evaluator loops that can be installed when teams need them.

The recurring lesson across the source notes is simple: **Agent = Model + Harness**. Model quality matters, but most reliability gains come from the system around the model: context, tools, memory, guardrails, observability, feedback loops, and workflow control.

For Pi, the best strategy is to keep the core small and make harness upgrades composable:

1. Use context files and prompt templates for feedforward guidance.
2. Use extensions for tool interception, permission gates, custom commands, state, and compaction behavior.
3. Use skills for reusable work procedures and progressive disclosure.
4. Use sessions, branch summaries, raw logs, and extension state as memory substrate.
5. Use deterministic checks before LLM judgment whenever possible.
6. Use independent evaluator contexts for reviews instead of asking generators to self-approve.

## Harness Mental Model

### Agent equals model plus harness

The LLM is only the reasoning engine. The harness is everything around it:

- **Context:** what the model sees and when it sees it.
- **Tools:** what actions the model can take.
- **Guardrails:** what actions are blocked, confirmed, or constrained.
- **Memory:** what persists across sessions, branches, and loops.
- **Observability:** what traces, logs, diffs, costs, and decisions can be inspected later.
- **Feedback:** what tells the agent it failed and how it should recover.
- **Workflow control:** how planning, execution, evaluation, retry, and reporting are sequenced.

The source notes repeatedly warn against treating reliability as a prompt-writing problem. Prompting helps, but stable quality comes from executable structure: typed interfaces, tests, hooks, tool filters, explicit state, and independent evaluation.

### Feedforward plus feedback

Harnesses need both prevention and correction.

- **Feedforward guides** steer the model before it acts: `AGENTS.md`, system prompts, skill descriptions, architecture rules, allowed tools, and task contracts.
- **Feedback sensors** catch failures after action: type checks, lint, tests, Playwright, CI, diff checks, trace analysis, and evaluator agents.

Using only feedforward creates ignored instructions. Using only feedback creates noisy loops where the agent repeats avoidable mistakes. Pi packages should pair them: every important instruction should eventually have a check, guardrail, or evaluator.

### Prefer deterministic checks

Use computational checks before inferential checks:

- Prefer `tsc`, lint, tests, schema validation, dependency-boundary checks, file path gates, and command allowlists.
- Use LLM review for issues that cannot be reduced to deterministic checks: product fit, architecture judgment, usability, missing edge cases, and suspicious diffs.

This matters for Pi because extensions can intercept tools, run commands, block actions, and store structured state. A Pi harness package should turn repeated LLM mistakes into deterministic checks where possible.

### Small loops beat clever workflows

The local "Ralph Loop" notes argue for simple, stubborn loops before complex orchestration:

1. Read current state and choose the next most important task.
2. Make a small change.
3. Verify it.
4. Commit or record progress.
5. Repeat.

For Pi, this means the first reusable automation should be a simple generator/evaluator loop, not a giant multi-agent graph. Parallelism should be added only when the serial loop has a clear bottleneck and write scopes can stay isolated.

### Separate generator and evaluator

The GAN-style harness notes repeat one of the strongest rules: the agent that creates work should not be the final judge of that work.

- **Planner:** translates vague user intent into acceptance criteria.
- **Generator:** makes small diffs and does not declare final success from vibes.
- **Evaluator:** checks output against the contract, produces short structured feedback, and does not edit code directly.

Pi intentionally skips built-in sub-agents and plan mode, but extensions, RPC, SDK sessions, `--fork`, `/fork`, `/clone`, and session trees are enough substrate to implement this outside core.

### Raw traces are memory, not noise

The meta-harness notes emphasize that summarized logs lose important facts. A good harness keeps raw traces available and lets the model retrieve the exact slices it needs.

For Pi:

- Keep session JSONL as the source of truth.
- Preserve raw tool outputs in session history or sidecar trace files.
- Let compaction summarize for the context window, but do not treat the summary as the only record.
- Build trace search and failure-learning tools that inspect raw logs with grep-like retrieval.

### Memory should be structured

The memory notes distinguish working memory from long-term memory. The context window should be treated as working memory; durable memory should live outside it.

Useful memory kinds for Pi harness packages:

- `core_directives`: stable operating rules.
- `project_context`: tech stack, architecture, commands, repo layout.
- `user_preferences`: style, response, and workflow preferences.
- `pending_items`: unfinished work and handoff state.
- `tool_guidelines`: tool-specific gotchas and safe usage.
- `harness_learnings`: repeated agent failures and the guardrails added to prevent them.
- `self_improvement`: notes about agent behavior that should change next time.

Memory injection should be selective. A diff-style or retrieval-based approach is better than dumping every memory block into every prompt.

## Pi Surface Area to Build On

### Current Pi capabilities

Pi's current public surface already maps cleanly to harness parts:

| Harness part | Pi surface |
| --- | --- |
| Project context | `AGENTS.md`, `CLAUDE.md`, `.pi/SYSTEM.md`, `APPEND_SYSTEM.md`, prompt templates |
| Tools | Built-ins `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`; extension tools |
| Tool control | `--tools`, `--no-tools`, `--no-builtin-tools`, extension `tool_call` handlers |
| Skills | Agent Skills standard, `/skill:name`, `SKILL.md`, `scripts/`, `references/`, `assets/` |
| Commands | Built-in slash commands plus extension commands |
| Session memory | JSONL session tree, `/tree`, `/fork`, `/clone`, labels, branch summaries |
| Context recovery | Manual `/compact`, auto-compaction, custom compaction via extensions |
| Programmatic orchestration | JSON mode, RPC mode, SDK, `createAgentSession`, `AgentSessionRuntime` |
| Packaging | Pi packages with extensions, skills, prompts, and themes |
| UI and human gates | Extension UI notifications, inputs, selects, confirms, custom components |

This means the right harness design for Pi is package-first. Pi core should stay thin unless a feature is foundational for every harness package.

### Extension capabilities that matter most

Extensions are the primary place for harness control because they can:

- Subscribe to lifecycle events.
- Intercept and block tool calls.
- Inject context before agent start.
- Register custom tools and commands.
- Store branch-aware state through session entries and tool result details.
- Customize compaction and branch summarization.
- Add permission gates and path protection.
- Build custom UI for confirmations, audits, and structured user input.

The most important extension hook for guardrails is `tool_call`: use it to block dangerous shell commands, protect files like `.env`, require confirmation for destructive actions, and record repeated failures as harness learnings.

### Skill capabilities that matter most

Skills are Pi's best fit for repeatable procedures:

- Keep only name and description in always-on context.
- Load full `SKILL.md` on demand.
- Put helper scripts in `scripts/`.
- Put deep references and edge cases in `references/`.
- Put templates or fixtures in `assets/`.
- Invoke explicitly with `/skill:name` when deterministic routing matters.

For harness reliability, every important skill should be written as a procedure, not a motivational prompt. It should start with gotchas, define inputs, define done criteria, list validation commands, and point to references only when needed.

### Session and compaction capabilities that matter most

Pi sessions are JSONL trees. Each entry has an id and parent id, which enables branch navigation and durable history. Compaction summarizes older messages for model context, but full history remains in the session file.

Harness packages should use this distinction carefully:

- **Context summary:** what the model needs right now.
- **Raw session trace:** what debuggers and evaluators need later.
- **Branch summary:** what a user needs when switching or abandoning branches.
- **Extension state:** what a package needs to reconstruct tool and workflow state.

Do not make long-term memory depend only on compaction summaries. They are useful but lossy.

## Best Practices by Harness Part

### 1. Context

Use layered context instead of one giant instruction file.

- Put stable global behavior in `~/.pi/agent/AGENTS.md`.
- Put project architecture and commands in repo `AGENTS.md`.
- Use `.pi/SYSTEM.md` only when replacing Pi's default system prompt is truly needed.
- Use `APPEND_SYSTEM.md` for additive project-level policy.
- Use prompt templates for common asks such as review, release prep, refactor planning, or e2e verification.
- Use extension `before_agent_start` or context injection for dynamic facts such as environment bootstrap, current git state, active package config, and selected harness mode.

Best-practice shape:

- Short always-on context.
- Explicit directory and boundary map.
- Explicit anti-patterns.
- Commands that are current and executable.
- Links to deeper docs instead of full pasted manuals.
- A habit of moving repeated failures into rules, tests, or extensions.

Avoid:

- Monolithic context files.
- Stale architecture docs.
- Long copied logs in prompts.
- Instructions that should be deterministic checks.

### 2. Tools and guardrails

Use least privilege by default.

- Start constrained runs with `--no-tools` or `--tools` when the workflow allows it.
- Use `--no-builtin-tools` when a package wants to provide a safer tool surface.
- Use extension `tool_call` interception for dangerous bash commands and protected paths.
- Require user confirmation for irreversible or embarrassing actions.
- Block writes to secrets, dependency directories, generated vendor folders, and production config unless explicitly allowed.
- Use path protection and command allowlists as code, not only prompt text.

Guardrail categories:

- **File protection:** `.env`, credentials, lockfiles, generated folders, production configs.
- **Command protection:** destructive deletes, force pushes, chmod/chown, credential printing, deployment commands.
- **Network protection:** exfiltration-prone commands when private repo data and untrusted content are both present.
- **Scope protection:** prevent edits outside the project or outside assigned task paths.

When a guardrail blocks something, record:

- attempted tool and input,
- reason blocked,
- user decision if any,
- suggested safe alternative,
- whether this should become a future harness learning.

### 3. Skills

Design skills as execution harnesses.

Recommended `SKILL.md` shape:

```markdown
---
name: review-diff
description: Review the current git diff for bugs, security issues, missing tests, and unintended scope. Use before final delivery.
---

# Review Diff

## Gotchas
- Do not review untracked generated files unless asked.
- Do not suggest broad refactors outside the diff.

## Inputs
- Current git diff.
- User request or task contract.

## Steps
1. Inspect changed files.
2. Run deterministic checks when available.
3. Compare diff to requested scope.
4. Report findings first, ordered by severity.

## Done Criteria
- Findings cite files and lines.
- No unsupported claims.
- Test gaps are explicit.
```

Skill best practices:

- Put known failures at the top.
- Use `references/` for rare or deep paths.
- Use `scripts/` for deterministic commands.
- Use `assets/` for templates and examples.
- Give descriptions strong trigger conditions.
- Prefer explicit invocation for critical workflows.
- Keep generator skills and evaluator skills separate.

### 4. Memory

Treat memory as a retrieval system, not a bigger prompt.

Recommended memory layers for Pi packages:

| Memory layer | Storage candidate | Use |
| --- | --- | --- |
| Session trace | Pi JSONL session file | Raw source of truth |
| Branch handoff | Branch summary entries | Resume after tree navigation |
| Package state | Extension entries or tool result details | Reconstruct package state |
| Project memory | `.pi/<package>/memory/*.md` or JSON | Durable project facts |
| Global memory | `~/.pi/agent/<package>/memory/` | User preferences and cross-project patterns |
| Harness learning | Structured markdown or JSON | Repeated failures and guardrails |

Memory best practices:

- Keep raw traces searchable.
- Inject only relevant memories.
- Use frontmatter or JSON metadata for routing.
- Track confidence, source, and last-used timestamps.
- Prefer decay/ranking over hard deletion.
- Save failed commands, repeated test failures, blocked tool calls, user corrections, and verification misses as candidate harness learnings.

### 5. Evaluation

Evaluation is the strongest reliability upgrade Pi can package.

A robust evaluator should check:

- Requested behavior.
- Scope of diff.
- Type checks, lint, tests, and build.
- E2E or Playwright flows where UI matters.
- Accessibility and responsive layout where frontend matters.
- Security and secret handling.
- Whether completion criteria are satisfied.

Evaluator rules:

- It receives the original request, acceptance criteria, current diff, and raw verification output.
- It does not edit code.
- It returns short structured feedback.
- It distinguishes "works" from "usable".
- It fails closed when required checks were not run.

Suggested evaluator output:

```json
{
  "status": "fail",
  "findings": [
    {
      "severity": "high",
      "repro_steps": ["Run bun test", "Open failing test output"],
      "expected": "All chat adapter tests pass",
      "actual": "Chat thread creation fails when title is omitted",
      "next_action": "Fix title defaulting in the adapter"
    }
  ]
}
```

### 6. Loops and orchestration

Start with one simple loop:

1. Planner creates acceptance criteria.
2. Generator makes one small diff.
3. Deterministic checks run.
4. Evaluator reviews diff and outputs pass/fail feedback.
5. Generator fixes only evaluator findings.
6. Reporter summarizes result and residual risk.

Keep this loop serial until there is a measured need for parallelism. Parallel agents should only work on disjoint write scopes or pure read/evaluation tasks.

Pi implementation options:

- Extension command such as `/harness:run`.
- SDK orchestration with multiple `createAgentSession` calls.
- RPC orchestration from another process.
- Session forking with `/fork` or `--fork` to isolate noisy evaluator work.
- Package-distributed prompt templates and skills for planner/generator/evaluator roles.

### 7. Observability and raw traces

Observability should be designed before automation becomes autonomous.

Record:

- Prompt template or skill used.
- Active tools and extensions.
- Model and thinking level.
- Context files loaded.
- Commands run and exit codes.
- Tool blocks and approvals.
- Diffs before and after loop iterations.
- Evaluator findings and retry count.
- Final checks run.

Do not rely only on summarized transcript. Store raw outputs where possible, then provide grep-like search and narrow retrieval.

### 8. Packaging and distribution

Bundle harness features as Pi packages:

```json
{
  "name": "@example/pi-harness-starter",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

Package guidelines:

- Pin third-party package versions for safety.
- Keep runtime dependencies under `dependencies`.
- Document security posture clearly.
- Provide a local-project install path for repo-specific policies.
- Split reusable generic harness pieces from company-specific rules.
- Make every extension auditable: what events it listens to, what tools it registers, what files it writes, and what commands it may run.

## Recommended Pi Improvements

### 1. Harness starter package

Create a first-party or reference package that installs:

- Safe prompt templates for plan, implement, review, and verify.
- Skills for diff review, test triage, release readiness, and e2e checks.
- A path-protection extension.
- A harness audit command.
- A generator/evaluator loop command.
- Documentation for adapting the package per project.

This should demonstrate Pi's package-first philosophy without adding heavy workflow policy to core.

### 2. Permission and path-protection extension

Build an extension around `tool_call` that:

- Blocks writes to protected paths.
- Confirms dangerous bash commands.
- Supports per-project policy in `.pi/harness-policy.json`.
- Logs blocked attempts as structured session entries.
- Exposes `/harness:policy` to inspect active rules.

MVP policy examples:

- block writes to `.env*`, `.ssh/`, `.aws/`, `node_modules/`, `.git/`;
- confirm `rm`, `mv`, `chmod`, `chown`, `git push --force`, deploy commands;
- block commands that print known secret env vars;
- allow per-project overrides.

### 3. Generator/evaluator loop package

Build an installable loop with:

- `planner` prompt template or skill;
- `generator` prompt template or skill;
- `evaluator` skill;
- `/harness:run` command;
- structured pass/fail feedback;
- retry budget;
- raw trace capture;
- final reporter.

Keep the first version serial and small. Do not build a generic graph engine first.

### 4. Raw trace and failure-learning extension

Build an extension that:

- stores raw check outputs and tool failures in sidecar files or session entries;
- indexes traces by command, file, status, and task;
- detects repeated failures;
- proposes candidate harness learnings;
- provides a command to inspect and accept/reject proposed learnings.

The goal is to make "the agent made this mistake twice" become a concrete rule, test, skill gotcha, or guardrail.

### 5. Subconscious-style memory package

Use the existing QMD Subconscious PRD/ADR as the deeper product plan. The consolidated best-practice direction is:

- memory blocks should be structured;
- session close can trigger background memory extraction;
- prompt submit can inject only relevant diffs or retrieved memories;
- tool use can consult harness learnings before risky operations;
- local fallback should work when network memory is unavailable;
- raw traces should remain available for diagnosis.

This package should be optional and transparent. Users should be able to inspect, edit, disable, or reset memory.

### 6. Skill authoring templates

Create templates for:

- implementation skill;
- evaluator skill;
- migration skill;
- frontend verification skill;
- backend/domain verification skill;
- release readiness skill.

Each template should include:

- gotchas first;
- inputs;
- required context;
- steps;
- deterministic checks;
- done criteria;
- reference routing;
- output format.

### 7. Harness audit command

Add a package command such as `/harness:audit` that reports:

- loaded context files;
- active system prompt override or append;
- active extensions and commands;
- active tools;
- loaded skills and prompt templates;
- current model and thinking level;
- session file and branch state;
- compaction settings;
- permission policy;
- known harness learnings;
- recent blocked actions and failed checks.

This helps users debug the harness itself rather than blindly blaming the model.

## Implementation Priority

### Phase 1: Documentation and templates

- Publish this consolidated study.
- Create initial skill templates.
- Create starter prompt templates for planning, implementation, review, and verification.
- Define a minimal harness policy schema.

Why first: this produces immediate value without changing runtime behavior.

### Phase 2: Safety and audit extension

- Implement path and command protection.
- Implement `/harness:audit`.
- Log blocked actions and confirmations.
- Document package install and project-local policy.

Why second: safety and observability should come before autonomous loops.

### Phase 3: Evaluation loop

- Implement the serial planner/generator/evaluator workflow.
- Use deterministic checks where configured.
- Keep evaluator independent and non-mutating.
- Store structured feedback and raw traces.

Why third: reliable evaluation makes future automation much safer.

### Phase 4: Failure learning and memory

- Capture repeated failure patterns.
- Propose harness learnings.
- Add accepted learnings to memory or skill gotchas.
- Integrate with the subconscious-style memory plan.

Why fourth: memory is most useful after the safety and evaluation substrate exists.

### Phase 5: Optimization and pruning

- Run A/B comparisons of harness controls.
- Remove controls that add latency without improving outcomes.
- Keep independent evaluation as the last-line safety gate.
- Consider smaller/cheaper models for generated substeps once checks are strong.

Why fifth: premature optimization risks removing the rails before the system is measurable.

## Related documents

- Program ADR/PRD (formalized from this study and Pi-extension notes): `.cursor/plans/ai-harness/ai-harness-ADR.md`, `.cursor/plans/ai-harness/ai-harness-PRD.md`
- Durable memory slice: `.cursor/plans/ai-harness/qmd-subconscious-ADR.md`, `.cursor/plans/ai-harness/qmd-subconscious-PRD.md`
- Complementary topology and naming notes: `.cursor/plans/ai-harness/lernings/pi-extension.md`

## Source Notes

Local learning notes consolidated:

- `.cursor/plans/ai-harness/lernings/harness-engneering.md`
- `.cursor/plans/ai-harness/lernings/agent-harness-engneering.md`
- `.cursor/plans/ai-harness/lernings/skills-best-practices.md`
- `.cursor/plans/ai-harness/lernings/power-of-loop.md`
- `.cursor/plans/ai-harness/lernings/gan.md`
- `.cursor/plans/ai-harness/lernings/meta-harness.md`
- `.cursor/plans/ai-harness/lernings/agent-memory.md`
- `.cursor/plans/ai-harness/lernings/memory-Subconscious.md`
- `.cursor/plans/ai-harness/lernings/memory-master-class.md`

Related local planning docs:

- `.cursor/plans/ai-harness/qmd-subconscious-PRD.md`
- `.cursor/plans/ai-harness/qmd-subconscious-ADR.md`

Pi references:

- Pi coding agent repository: https://github.com/earendil-works/pi/tree/main/packages/coding-agent
- Pi extensions documentation: https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/extensions.md
- Pi skills documentation: https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/skills.md
- Pi compaction documentation: https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/compaction.md

Videos and external sources named in the local notes:

- Harness Engineering for AI Coding Agents: https://www.youtube.com/watch?v=JvCIgFPgOlk
- Harness Engineering for AI Agents: https://www.youtube.com/watch?v=JvCIgFPgOlk
- Claude Code Skills design: https://www.youtube.com/watch?v=ah_1f5WCklw
- Ralph Loop: https://www.youtube.com/watch?v=1fJ01NsNQb4
- GAN-style harness architecture: https://www.youtube.com/watch?v=p_zxYc2JG8w
- Meta-Harness: https://www.youtube.com/watch?v=4QApxkjx1WY
- Agent memory principles: https://www.youtube.com/watch?v=W2HVdB4Jbjs
- Claude Code Subconscious: https://www.youtube.com/watch?v=cq2ZYMcftfY
- Memory Masterclass: https://www.youtube.com/watch?v=gsedOXz8FX4
