# PRD: Pi AI Harness Program

Status: Draft

Owner: AI Harness

Date: 2026-05-08

## Summary

The Pi AI Harness program defines a **package-first** set of reference Pi packages, skills, prompts, and extensions that make coding agents reliable on Pi: layered context, tool guardrails, deterministic verification before LLM evaluation, independent evaluators, raw trace observability, and optional durable memory via QMD Subconscious.

The program does not require changing Pi upstream. It standardizes how teams install and compose harness pieces, with a **canonical command namespace** `/harness:*` (learning notes that used `/orch:*` are treated as illustrative aliases only).

Architecture decisions live in `.cursor/plans/ai-harness/ai-harness-ADR.md`.

## Problem

- Agents fail in repeatable ways that prompts alone do not fix.
- Without explicit checks and separate evaluation, implementers self-approve weak work.
- Monolithic context and lossy summaries erase facts needed for debugging and learning.
- Multi-agent sketches often jump to swarms or DAG engines before a minimal loop works.
- Users lack a single mental model and install path for “what good looks like” on Pi.

## Goals

- Publish a clear **ADR + PRD** pair for the harness program (this document + `ai-harness-ADR.md`).
- Phase delivery so **safety and audit** precede autonomous multi-step loops, and **memory compounding** follows a working eval path.
- Standardize **role + scope + checks** contracts for specialists and evaluators.
- Prefer **session fork / branch isolation** for parallel specialist contexts when the orchestration package implements multi-session flows.
- Integrate with **QMD Subconscious** for retrieval memory and harness learnings when that product is installed (see linked PRD).
- Use **`harness:*`** commands consistently for user-facing orchestration, audit, and policy.

## Non-Goals

- Owning or forking Pi core.
- Building a hosted multi-tenant orchestration SaaS.
- Replacing the QMD Subconscious specification (this PRD references it; memory depth stays there).
- Guaranteeing a specific commercial Pi package name or npm scope in this document.
- Mandating parallelism or a generic workflow graph in v1 of the program.

## Scope boundaries

| In scope | Out of scope |
| --- | --- |
| Reference Pi package(s): starter prompts/skills, policy extension, eval loop, audit, failure-learning hooks | Pi product roadmap or API guarantees |
| Documentation, templates, policy schema examples | Changing `ai-maker-lab` app code unless a future task explicitly ties harness to this repo |
| Conventions for `harness:*` commands and extension audibility | Re-implementing QMD or Letta |

## Product principles

- **Harness over prompt.** Executable structure (checks, hooks, state) beats longer system text.
- **Deterministic before inferential.** Run what can be computed before asking a model to judge.
- **Independent evaluators.** Evaluators do not edit project files; they emit structured feedback.
- **Small loops first.** Serial planner → generator → checks → evaluator → retry before swarms or DAGs.
- **Raw traces matter.** Keep enough detail for grep-like diagnosis; compaction is not the only archive.
- **Whisper, don’t drown.** Memory injection stays budgeted and relevant (aligned with QMD Subconscious principles).

## Terminology

| Term | Meaning |
| --- | --- |
| Engineering Lead | User-facing name for the coordinating agent (supervisor); plans, routes, merges, triggers evals |
| Planner | Produces structured goals, constraints, acceptance criteria, affected areas |
| Generator / Specialist | Scoped implementer with explicit `writes_to` and checks |
| Evaluator | Read-only reviewer with structured pass/fail and findings |
| Supervisor | Same role as Engineering Lead in diagrams where “supervisor” reads clearer |

## Target users

### Primary: Solo developer using Pi daily

Wants safer defaults, repeatable verify/review flows, and optional cross-session memory.

### Secondary: Harness engineer / platform

Wants extension auditability, trace capture, and harness learnings that become rules or checks.

### Secondary: Pi package author

Wants patterns for extensions, skills, and manifests that compose without importing business logic into shared UI.

## User stories

### Harness audit

As a user, I want to see what the harness actually loaded so I can debug behavior.

Acceptance:

- A documented `/harness:audit` (or equivalent registered command) lists context files, extensions, commands, tools, skills, session/branch hints, model settings, and active policy summary when the audit package is installed.
- Output is suitable for pasting into an issue without dumping secrets by default.

### Path and command policy

As a user, I want dangerous file and shell operations gated.

Acceptance:

- Extension can block or confirm writes to protected paths and risky commands per project policy file (e.g. `.pi/harness-policy.json` as documented in the package).
- Block events can be logged as structured data for harness learnings.

### Serial harness run

As a user, I want a single command to run a minimal quality loop.

Acceptance:

- Documented `/harness:run` drives: contract/plan → scoped implementation → deterministic checks → evaluator → bounded retry → short final report.
- Evaluator does not apply patches; findings route back to the generator path.
- Commands and retry budgets are configurable within safe defaults.

### Skills as procedures

As a harness engineer, I want skills that read like runbooks.

Acceptance:

- Published templates include gotchas, inputs, steps, deterministic commands, done criteria, and references (see ADR-aligned skill shape in consolidated study).

### Memory and learnings (with QMD Subconscious)

As a user, I want failures and prefs to compound into retrievable memory.

Acceptance:

- Program docs point to QMD Subconscious PRD for recall, sleep-time extraction, and memory kinds.
- Failure-learning hooks in harness packages do not contradict QMD storage and privacy defaults.

## Functional requirements

### FR1 — Context layering

- Document and template stable split: global `AGENTS.md`, repo `AGENTS.md`, optional `APPEND_SYSTEM.md`, prompt templates, dynamic injection via `before_agent_start` where packages provide it.
- Always-on context stays short; deep material in skills `references/`.

### FR2 — Tool guardrails

- Policy-driven `tool_call` interception: path protection, command allow/deny, confirmations for destructive operations.
- Record blocked attempts with reason and optional user decision for learning pipelines.

### FR3 — Skills package

- Specialist and evaluator skills as separate packages or folders; explicit `/skill:name` for critical paths where routing must be deterministic.

### FR4 — Evaluation loop package

- Planner output in structured JSON (goal, constraints, acceptance criteria, scopes, risks).
- Evaluator output schema includes status, severity-ordered findings, repro hints, next actions; fails closed if required checks were not run.

### FR5 — Observability

- Raw check outputs and tool failures storable in sidecar traces or session entries per package design.
- Optional integration with QMD trace indexing as defined in QMD PRD, not duplicated here.

### FR6 — Packaging

- Example `pi` manifest snippet in package README: extensions, skills, prompts paths; security posture stated.
- Pin risky dependencies; document what each extension subscribes to and what it may execute.

### FR7 — Command namespace

- Canonical prefix: **`harness:`** for slash commands (`/harness:run`, `/harness:audit`, `/harness:policy`, etc.).
- Learning-note aliases (`orch:*`) are not used as canonical names in new artifacts.

## Non-functional requirements

- **Local-first and safe degradation:** if a subprocess (QMD, tests) fails, Pi remains usable; capture-only or skip-inject modes where applicable.
- **Auditable extensions:** documented event subscriptions, registered tools, filesystem writes, and `pi.exec` usage per package.
- **Privacy:** no exfiltration of secrets in audit or trace defaults; align with QMD redaction stance when memory is enabled.

## Dependencies

- **Pi**: extensions API, session manager, `appendEntry`, fork/clone, `pi.exec`.
- **QMD Subconscious** (optional but recommended for Phase 4 memory): `.cursor/plans/ai-harness/qmd-subconscious-PRD.md` and ADR.

## Phased roadmap

Aligned with the consolidated implementation priority; MVP is Phase 3 minimal loop plus Phase 1 artifacts.

| Phase | Focus | Deliverables (program level) |
| --- | --- | --- |
| 1 | Documentation and templates | This PRD/ADR, skill templates, starter prompts, minimal harness policy schema doc |
| 2 | Safety and audit | Path/command extension, `/harness:audit`, structured block logs |
| 3 | Evaluation loop | `/harness:run` serial loop, planner/generator/evaluator skills, retry budget, raw trace capture |
| 4 | Failure learning and memory | Proposed harness learnings flow; integration with QMD Subconscious for durable retrieval |
| 5 | Optimization | Prune noisy controls; optional cheaper models for substeps once checks are strong |

### MVP definition (narrow)

The smallest shippable slice that proves the program:

1. Published templates + policy schema (Phase 1).
2. Path/command guard extension with `/harness:policy` inspect (Phase 2).
3. `/harness:audit` (Phase 2).
4. `/harness:run`: planner → one scoped generator turn → deterministic checks → evaluator JSON → at least one retry path → short report (Phase 3).

No requirement for multi-agent parallelism or DAG scheduling in MVP.

## Success metrics

- **Adoption:** time from “clone repo” to documented first `/harness:audit` and `/harness:run` (lab measurement).
- **Safety:** count of blocked high-risk operations with structured logs (qualitative in early phases).
- **Quality:** evaluator-reported issues that reference file/line and required checks; reduction in repeated same-class failures after harness learnings (Phase 4).
- **Operability:** mean time to diagnose a failed loop using audit + raw trace (survey or internal dogfood).

## References

- ADR: `.cursor/plans/ai-harness/ai-harness-ADR.md`
- QMD Subconscious: `.cursor/plans/ai-harness/qmd-subconscious-ADR.md`, `.cursor/plans/ai-harness/qmd-subconscious-PRD.md`
- Research notes: `.cursor/plans/ai-harness/lernings/herness-study-consolidated.md`, `.cursor/plans/ai-harness/lernings/pi-extension.md`
- Pi extensions: https://pi.dev/docs/latest/extensions
- Pi session format: https://pi.dev/docs/latest/session-format
