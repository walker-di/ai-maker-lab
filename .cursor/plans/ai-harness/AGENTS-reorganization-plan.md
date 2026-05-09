# Pi.dev Organization Plan

**Status:** Draft  
**Date:** 2026-05-08  
**Scope:** Full `~/.pi/agent/` organization — `AGENTS.md`, `APPEND_SYSTEM.md`, skills inventory, agent configs, and cross-linking. Not just AGENTS.md cleanup.  
**Goal:** Fix mixed concerns across the entire pi.dev configuration layer; remove conflicting signals for subagents; make every agent self-contained via its own config; resolve skill overlaps; align with the harness POC (serial loop with existing substrate) and consolidated study (feedforward + feedback, deterministic checks, small loops, packaging).

**References:**
- `ai-herness-POC.md` — substrate inventory, 8-phase simulation, gap analysis, skill trigger mapping  
- `lernings/herness-study-consolidated.md` — best practices for Pi harness engineering (feedforward + feedback, deterministic checks, small loops, skill design templates)  
- Existing local skills: `conductor`, `harness-playbook`, `plan-implemention`, `spike`, `post-mortem`, `self-evolve`
- Existing `~/.pi/agent/AGENTS.md` — current delegation policy + mixed parent doctrine

**Constraint:** No new Pi extension. No new skill directories. Edit existing files and agents only. Use existing extensions, skills, agents, and tools only.

---

## 1. Scope and Problem Statement

### 1.0 What This Plan Covers

This is a **full pi.dev reorganization**, not just an AGENTS.md edit. The affected surface area:

| Surface | What It Is | Current Problem |
|---|---|---|
| `AGENTS.md` | Global always-on reference | ~330 lines of mixed parent doctrine + agent table + workflows + error rules |
| `APPEND_SYSTEM.md` | Unavoidable universal rules | Contains parent-only doctrine that leaks to every subagent |
| **Skills** (7 installed) | On-demand procedure docs | Overlapping triggers: `conductor`, `harness-playbook`, and `plan-implemention` all touch orchestration; no clear trigger boundary |
| **Agent configs** (6 custom) | Per-agent system prompts | All set `inheritProjectContext: true`, pulling in the polluted AGENTS.md |
| **Chains** | Reusable subagent sequences | Not widely known; only 2 defined |

### 1.1 AGENTS.md Does Too Many Jobs

### 1.1 AGENTS.md Does Too Many Jobs
Current `~/.pi/agent/AGENTS.md` is ~330 lines and contains four incompatible types of content:

| Content Type | What It Actually Is | Where It Belongs |
|---|---|---|
| Parent orchestration doctrine | "You are a conductor, never a coder", pre-action checkpoint, manager mindset | `skills/conductor/SKILL.md` (existing) |
| Shared reference | Agent table, context strategy | Short reference (`AGENTS.md`) |
| Detailed procedures | Full 8-phase harness loop, standard workflow scripts, prompt templates | On-demand skill (`harness-playbook`) |
| Error-handling rules | qa-worker + domain-reviewer error-handling requirements | Per-agent config |

This means **every agent** (including subagents meant to edit files) receives parent-only rules like "NEVER edit files" and "NEVER run tests." The study calls this **feedforward pollution**: instructions meant for the parent leak into generator contexts, forcing the model to waste tokens resolving contradictions instead of executing its role.

### 1.2 APPEND_SYSTEM.md Leaks Into Subagents
From source analysis of `pi-subagents/src/runs/shared/subagent-prompt-runtime.ts`:

- `stripProjectContext()` strips only the `# Project Context` block (which contains `AGENTS.md`).
- **APPEND_SYSTEM.md has NO stripping code whatsoever.** It is loaded by Pi's `DefaultResourceLoader` before any extension prompt rewriting runs.

**Result:** Every subagent gets APPEND_SYSTEM.md in its system prompt. APPEND_SYSTEM.md currently contains parent-only doctrine (`"You are a conductor only, never a coder. NEVER edit files."`). The subagent's own `systemPrompt` then says `"You are a backend implementation specialist... edit files."` — a **direct contradiction** in the same prompt.

The POC confirms this is a real problem, not theoretical: subagents with contradictory identity statements show lower reliability and require more retry cycles.

### 1.3 Parent Still Does Too Much Directly
Despite previous edits, AGENTS.md and APPEND_SYSTEM.md still allow (and in some cases encourage) the parent to:
- Run `bun test` / validation commands itself
- Read files to "gather context"
- Run any test/typecheck/lint

These activities should be delegated to `qa-worker` and `scout` respectively. The consolidated study emphasizes: **"The parent is a manager and orchestrator, not a worker."** The pre-action checkpoint is a feedforward guardrail, but it only works if it lives where the parent (and only the parent) can see it.

### 1.4 Skill Overlap and Ambiguous Triggers

Currently installed skills and their stated triggers:

| Skill | Claimed Trigger | Actual Overlap |
|---|---|---|
| `conductor` | "orchestrate agents", "multi-agent", "parallel review" | Contains parent doctrine ("NEVER edit files", pre-action checkpoint), delegation protocol, AND topology selection |
| `harness-playbook` | "complex multi-file", "cross-layer" | Contains the full 8-phase loop, references `conductor` and `plan-implemention` |
| `plan-implemention` | "plan implementation before coding" | Delegation-heavy planning workflow; overlaps with harness Phase 1 |
| `spike` | "prepare for a task", "investigation" | Research spike before coding; could be Phase 1 of harness or standalone |
| `post-mortem` | "end of session" | Reflection + dispatch; no overlap, but underutilized |
| `self-evolve` | "improve an instruction artifact" | Evolves SKILL.md/AGENTS.md; should be triggered after post-mortem findings |

**Problem:** `conductor` and `harness-playbook` both contain parent-level doctrine. A parent seeing "orchestrate agents" might load `conductor`; seeing "complex feature" might load `harness-playbook`. Both tell the parent not to edit files, both mention topology selection, both mandate runtime verification. This is **duplicate doctrine** — the study warns: "Stale duplicate doctrine creates confusion about which file is authoritative."

### 1.5 Subagents Pull in Parent Doctrine via `inheritProjectContext: true`
Every custom agent (frontend-worker, backend-worker, qa-worker, domain-reviewer) currently sets `inheritProjectContext: true`. This means they pull in the global AGENTS.md — which is full of parent orchestration rules telling them NOT to do their job.

The study's rule: **"Agent = Model + Harness."** The harness for a generator agent must include its full identity, tech stack, architecture rules, and process — without noise from parent-level doctrine. Setting `inheritProjectContext: false` and making each agent config self-contained fixes this.

---

## 2. Design Principles

These principles are derived from the POC's gap analysis and the consolidated study's best practices.

### 2.1 APPEND_SYSTEM.md = Unavoidable → Minimal Universal Rules Only
APPEND_SYSTEM.md is loaded by Pi's `DefaultResourceLoader` **before** the subagent prompt runtime extension runs. There is **no `--no-context-files` flag in the subagent spawn args.** Therefore any content in APPEND_SYSTEM.md will always reach subagents. Keep it minimal — only rules that truly apply to every Pi agent (parent + subagents). This aligns with the study's **least-privilege context** principle.

### 2.2 AGENTS.md = Controllable → Short Shared Reference
AGENTS.md lives inside the `# Project Context` section of the system prompt. Pi's `stripProjectContext()` can strip this when `inheritProjectContext: false`. Keep AGENTS.md as a **brief reference** useful to all agents, but strip it from subagents that carry their own full identity. The study recommends: "Short always-on context. Links to deeper docs instead of full pasted manuals."

### 2.3 Agent Configs = Full Self-Contained Identity
Each `.agent.md` file under `agents/` is the agent's primary system prompt. It must contain the agent's **complete** identity, rules, and methodology. Set `inheritProjectContext: false` so the global AGENTS.md does NOT leak in. The study's formula: **Agent = Model + Harness**. The harness is the context, tools, guardrails, memory, and workflow control. If the harness is polluted with parent doctrine, the agent fails.

### 2.4 Skills = On-Demand Doctrine and Procedures, With Clear Trigger Boundaries

Parent-only rules (conductor mindset, delegation protocol, pre-action checkpoint) go into **skills** — loaded explicitly by the parent, invisible to subagents. Detailed harness workflows (8-phase loop, standard scripts) also go into skills. The study: "Skills are Pi's best fit for repeatable procedures... Keep only name and description in always-on context. Load full `SKILL.md` on demand."

**No new skill directories.** Existing skills are reorganized in place. The key change is: **convert overlapping doctrine into a clear taxonomy** so the parent knows which skill to load when.

### 2.5 Clear Skill Taxonomy (Resolves Overlap)

| Skill | What It Actually Is | What It Is NOT | Correct Trigger |
|---|---|---|---|
| `AGENTS.md` | **Global delegation policy** — agent table, context strategy, intercom reference, model routing note | NOT parent doctrine; NOT workflows; NOT error rules | Always-on; subagents may optionally inherit |
| `harness-playbook` | **Concrete serial harness operating procedure** — the 8-phase loop (plan → route → generate → check → evaluate → retry → runtime verify → report) | NOT topology philosophy; NOT generic delegation rules; NOT parent mindset coaching | User says "run harness", "complex multi-file", or parent chooses to activate harness mode |
| `conductor` | **Adaptive multi-agent topology/decomposition skill** — when to parallelize, when to chain, how to craft worker prompts, communication topology | NOT the 8-phase loop; NOT specific check commands; NOT JSON schemas | User says "orchestrate", "get multiple perspectives", "parallel review", or task is ambiguous/multi-domain |
| `plan-implemention` | **Planning workflow** — investigate via 3 parallel subagents (UI + backend + tests) before coding | NOT the harness loop; NOT runtime verification | User says "plan before implementing", "create a plan", or investigation is needed before commitment |
| `spike` | **Research spike** — delegated investigation, risk analysis, option comparison | NOT planning; NOT implementation | User says "spike", "investigate", "prepare for", "understand before building" |
| `post-mortem` | **Session reflection** — extract learnings, dispatch to ledger/wiki/self-evolve | NOT planning; NOT harness execution | End of any significant session or failed harness run |
| `self-evolve` | **Instruction artifact improvement** — evolve SKILL.md/AGENTS.md via Hermes | NOT direct editing; not runtime implementation | After post-mortem finds unclear instructions, or user explicitly requests prompt tuning |

**Rationale:** This is the key fix for the overlap. Currently `conductor` contains parent doctrine AND topology guidance AND delegation protocol AND mandatory runtime verification. The harness-playbook also contains parent-level rules. After reorganization:
- `conductor` keeps **only** topology/decomposition philosophy (Conductor/Fugu paper ideas).
- `harness-playbook` keeps **only** the concrete 8-phase serial loop with schemas and commands.
- Shared parent doctrine (pre-action checkpoint, "never edit", "delegate all the things") moves to **one place**: the `conductor` skill's hard-rules section, which already has it. The harness-playbook references conductor for those rules instead of duplicating them.

### 2.6 Deterministic Checks Before LLM Evaluation
The study and POC both emphasize: **prefer `tsc`, lint, tests, schema validation before inferential checks.** The reorganization must make it easy for the parent to run deterministic checks (via `qa-worker`) before evaluator agents. This is a sequencing concern, not a file-location concern, but the clarity of agent roles directly impacts whether checks get skipped.

---

## 3. Pi Mechanics (Source-Code Confirmed)

### 3.1 Subagent Spawn Process

When `subagent()` is invoked, `buildPiArgs()` in `pi-subagents/src/runs/shared/pi-args.ts` builds the command line:

```
pi --model <model>
   --session <sessionFile>
   --append-system-prompt <agent-prompt.md>
   --extensions <subagent-prompt-runtime.ts>
   --no-skills   # if inheritSkills=false
   --tools <tools>
   Task: <task>
```

Key behavior:
- `--append-system-prompt` injects the agent's custom system prompt.
- `--no-skills` strips global skills if `inheritSkills: false`.
- Pi's `DefaultResourceLoader` runs **before** any extension — it loads `APPEND_SYSTEM.md` from disk into the system prompt.
- Then `subagent-prompt-runtime.ts` hooks `before_agent_start` and rewrites the prompt.

### 3.2 The Stripper Code (from `subagent-prompt-runtime.ts`)

```typescript
const PROJECT_CONTEXT_HEADER = "\n\n# Project Context\n\nProject-specific instructions and guidelines:\n\n";

export function stripProjectContext(prompt: string): string {
  const startIndex = prompt.indexOf(PROJECT_CONTEXT_HEADER);
  if (startIndex === -1) return prompt;
  const endIndex = findSectionEnd(prompt, startIndex + PROJECT_CONTEXT_HEADER.length,
    [SKILLS_HEADER, DATE_HEADER]);
  return `${prompt.slice(0, startIndex)}${prompt.slice(endIndex)}`;
}
```

**What gets stripped:**
1. `inheritProjectContext: false` → strips `# Project Context` (AGENTS.md content)
2. `inheritSkills: false` → strips skills list
3. `stripSubagentOrchestrationSkill` → removes `<skill name="pi-subagents">...` block

**What DOES NOT get stripped:**
- APPEND_SYSTEM.md content
- Pi's base system prompt

### 3.3 Child Boundary Instructions

Every subagent gets these prepended:

```typescript
export const CHILD_SUBAGENT_BOUNDARY_INSTRUCTIONS = [
  "You are a child subagent, not the parent orchestrator.",
  "The parent session owns delegation, orchestration, review fanout, and follow-up worker launches.",
  "Ignore prior parent-only orchestration instructions in inherited conversation history.",
  "Do not propose or run subagents. Complete only your assigned role-specific task with the tools available to you.",
  "If you need to edit files, call the actual edit/write tools. Do not print tool-call syntax, patches, or pseudo-tool calls as text.",
].join("\n");
```

**The boundary instructions are a band-aid, not a fix.** They tell the model to "ignore" contradictions, but the contradictions still consume reasoning tokens and occasionally win. The reorganization removes the contradiction at the source.

---

## 4. Proposed Architecture

### 4.1 Where Each Type of Content Lives

| Content | Current Location | New Location | Inherits Into Subagents? | Why |
|---|---|---|---|---|
| **Parent doctrine** (conductor mindset, pre-action checkpoint, delegation rules) | AGENTS.md + APPEND_SYSTEM.md | `skills/conductor/SKILL.md` | ❌ Parent loads explicitly | Already exists; remove duplicate from harness-playbook |
| **Shared reference** (agent table, context strategy) | AGENTS.md | `AGENTS.md` (trimmed, <60 lines) | Optional (`inheritProjectContext`) | Neutral enough for all agents |
| **Agent identity** (tech stack, architecture rules, methodology) | Agent configs (partial) + inherited AGENTS.md | Agent configs (complete, standalone) | ✅ Agent's own systemPrompt | Self-contained, no external deps |
| **Detailed harness workflow** (8-phase loop) | AGENTS.md §Harness Mode | `skills/harness-playbook/SKILL.md` | ❌ Loaded on demand | Already exists ✓ |
| **Topology selection** (when to delegate, parallel vs serial) | AGENTS.md §When to delegate | `skills/conductor/SKILL.md` | ❌ Loaded on demand | Already exists ✓ |
| **Quota/retry policy** | AGENTS.md §Quota + §Escalation | `SUBAGENT_MODEL_MATRIX.md` or agent config frontmatter | ✅ Always-on model config | Not behavioral doctrine |
| **Intercom protocol** | AGENTS.md + APPEND_SYSTEM.md | `AGENTS.md` (neutral reference) | ✅ Shared coordination skill | All agents use intercom |
| **Error handling rules** (evaluator requirements, defensive coding checks) | AGENTS.md §Error handling | Split: qa-worker + domain-reviewer configs | ✅ Per-agent system prompt | Specific to role |
| **Standard workflows** (frontend-only, backend-only, billing flows) | AGENTS.md §Standard workflows | Move to `harness-playbook` skill or per-agent process sections | ❌ Loaded on demand | Too procedural for always-on |
| **Project conventions** (tech stack, API patterns, repo layout) | — | `<repo>/AGENTS.md` | ✅ All agents in project | Project-specific, not role-specific |

### 4.2 How This Maps to the Harness POC

The POC's 8-phase serial loop (Plan → Route → Generate → Checks → Evaluate → Retry → Runtime Verify → Report) requires clear role boundaries. This reorganization enables that loop:

- **Phase 1 (Plan):** Parent loads `conductor` skill (for parent doctrine + topology) + `harness-playbook` (for loop procedure) → dispatches `planner`.
- **Phase 2 (Route):** Parent uses `conductor` skill topology guidance → chooses parallel/serial.
- **Phase 3 (Generate):** Workers run with `inheritProjectContext: false`, receiving ONLY their self-contained identity. No leaked "NEVER edit" rules.
- **Phase 4 (Checks):** Parent dispatches `qa-worker` to run deterministic checks (`bun test`, `bun typecheck`).
- **Phase 5 (Evaluate):** `domain-reviewer` and `reviewer` run in `fresh` context with contract + diff + check output. Read-only by design.
- **Phase 6 (Retry):** Parent routes severity-ordered findings back to the original worker.
- **Phase 7 (Runtime Verify):** `qa-worker` again — this time with browser/Playwright for UI, or API tests for backend.
- **Phase 8 (Report):** Parent synthesizes. No delegated agent needed.

### 4.3 File Mapping

```
~/.pi/agent/
├── AGENTS.md                          # 50-line shared reference
├── APPEND_SYSTEM.md                   # ~8-line universal rules
├── SUBAGENT_MODEL_MATRIX.md           # Model routing (unchanged)
├── skills/
│   ├── conductor/                     # Already exists ✓ — parent doctrine + topology
│   ├── harness-playbook/              # Already exists ✓ — 8-phase loop procedure
│   ├── plan-implemention/             # Already exists ✓ — planning workflow
│   ├── spike/                         # Already exists ✓ — research spike
│   ├── post-mortem/                   # Already exists ✓ — session reflection
│   ├── self-evolve/                   # Already exists ✓ — artifact evolution
├── agents/
│   ├── frontend-worker.md             # inheritProjectContext: false, explicit identity
│   ├── backend-worker.md              # inheritProjectContext: false, explicit identity
│   ├── qa-worker.md                   # inheritProjectContext: false, explicit identity
│   ├── domain-reviewer.md             # inheritProjectContext: false, explicit identity
│   ├── designer.md                    # inheritProjectContext: false, explicit identity
│   ├── iterative-implementer.md       # inheritProjectContext: false, explicit identity
│   └── ...                            # Other agents updated similarly
└── chains/                            # Unchanged
```

---

## 5. Proposed File Contents

### 5.1 `~/.pi/agent/APPEND_SYSTEM.md`

```markdown
# Universal Agent Rules

You have access to the `subagent` tool to delegate work to specialist agents.
You have access to `append_ledger` for structured memory and `intercom` for cross-session coordination.
Use lowercase pi tool names: `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`.
```

**Rationale:** Barely 5 lines. Universally applicable to parent and subagents. Nothing about editing policy or delegation doctrine.

---

### 5.2 `~/.pi/agent/AGENTS.md`

```markdown
# AGENTS.md — Agent Ecosystem Reference

## Quick Agent Reference

| Agent | Role | Edits? | Use When |
|---|---|---|---|
| `frontend-worker` | Svelte 5 / SvelteKit UI | Yes | Any UI feature, component, page |
| `backend-worker` | Backend / domain / API | Yes | Service, repository, route, schema |
| `qa-worker` | Testing + runtime verification | Yes | Tests, browser QA, API checks |
| `domain-reviewer` | Architecture review | No | Review only, no edits |
| `scout` | Codebase reconnaissance | No | Context gathering before planning |
| `planner` | Structured planning | No | Complex multi-file tasks |
| `designer` | Visual design / UX | Design artifacts only | Sketches, UX critique |

## Context Strategy

| Mode | When to Use |
|---|---|
| `fresh` (default) | Self-contained tasks, clean-slate implementation |
| `fork` | Worker needs conversation context, refining prior work |

## For Complex Tasks

Read the `harness-playbook` skill for the full planner → generator → evaluator → retry → report workflow.
```

**Rationale:** ~40 lines. Pure reference. No behavioral doctrine. Subagents with `inheritProjectContext: false` won't see it; those with `true` get a useful peer directory. Aligned with the study's "Short always-on context" principle.

---

### 5.3 Existing Skills — Required Edits (No New Skills)

Instead of creating a new `parent-orchestrator` skill, we edit the **existing** skills to remove overlap and clarify triggers. The `conductor` skill already contains parent doctrine; we keep it there and make `harness-playbook` reference it rather than duplicate.

#### 5.3.1 `conductor/SKILL.md` — Keep as Authoritative Parent Doctrine + Topology

**What it already has (keep):**
- "Hard rules" section with "NEVER edit", "NEVER run tests", delegation protocol
- "Pre-action checkpoint" (already exists)
- "Workflow" section with topology patterns (single, parallel, chain, tree, debate, recursive)
- "Mandatory runtime verification" rule
- "Bounded recursion" rule

**What to add:**
- A "Skill Taxonomy" block at the top clarifying: "This skill covers parent mindset and topology selection. For the concrete 8-phase harness loop with JSON schemas, load `harness-playbook`."
- A cross-reference table pointing to other skills and when to use them.

**What to remove:**
- Any redundant duplication of the full 8-phase harness loop (that belongs in `harness-playbook`).
- Any standard workflow scripts that are procedural rather than topological (e.g., the exact "Feature implementation (frontend + backend)" step-by-step script — that belongs in `harness-playbook` or agent configs).

**Acceptance:** After edit, `conductor` is strictly: parent identity + topology philosophy + worker prompt engineering + bounded recursion rules.

#### 5.3.2 `harness-playbook/SKILL.md` — Keep as Concrete 8-Phase Loop Procedure

**What it already has (keep):**
- The 8-phase serial loop with exact Phase 1–8 steps
- JSON schemas for planner contract and evaluator output
- Example complete workflow
- Quality checklist

**What to add:**
- Phase 0 "Load Skills": explicit prerequisite to load `conductor` skill first for parent mindset + topology selection.
- A note: "Parent doctrine (never edit, delegate all work) is in `conductor` skill. Read that first."
- Cross-links to `plan-implemention` (as an alternative planner workflow) and `spike` (as pre-plan investigation).

**What to remove:**
- Any "parent must never edit files" doctrine that duplicates `conductor` (replace with reference).
- Any topology philosophy that duplicates `conductor` (replace with reference).

**Acceptance:** After edit, `harness-playbook` is strictly: the concrete serial loop, schemas, commands, and examples. No parent mindset coaching.

#### 5.3.3 `plan-implemention/SKILL.md` — Clarify as Planning-Only Alternative

**What to add:**
- A clear boundary note: "This is a planning workflow only. It produces a plan artifact; it does NOT run the harness loop. If the user wants the full harness loop (plan → generate → check → evaluate → retry → report), use `harness-playbook` instead."
- Cross-reference to `harness-playbook` for when planning is done and implementation begins.

**Acceptance:** After edit, `plan-implemention` is strictly: parallel investigation → unified plan artifact. No harness loop content.

#### 5.3.4 `spike/SKILL.md` — Clarify as Pre-Commit Investigation

**What to add:**
- Cross-reference to `plan-implemention`: "If the spike concludes the scope is clear enough to plan, hand off to `plan-implemention` or `harness-playbook` Phase 1."

**Acceptance:** After edit, `spike` is strictly: delegated research spike → report.

#### 5.3.5 `post-mortem/SKILL.md` and `self-evolve/SKILL.md` — Minor Cross-Link Updates

**What to add:**
- `post-mortem`: Add note "If skill/AGENTS.md issues found, dispatch to `self-evolve` instead of editing directly."
- `self-evolve`: Add note "Typical trigger: post-mortem finds unclear instructions, or user explicitly requests prompt tuning."

**Acceptance:** Both remain functionally unchanged; only trigger clarity improved.

---

### 5.4 Updated Agent Config: `frontend-worker` (Example)

```yaml
---
name: frontend-worker
description: Svelte 5 / SvelteKit frontend specialist. Implements UI features following clean architecture.
tools: read, grep, find, ls, bash, edit, write
systemPromptMode: append
inheritProjectContext: false          # CHANGED: was true
inheritSkills: false
skills: svelte-frontend
---

You are a frontend implementation specialist. You EDIT FILES — this is your job.

Tech stack: Svelte 5 (runes), SvelteKit, shadcn-svelte, Lucide icons, AI SDK Svelte, TypeScript.
Monorepo: apps/desktop-app, packages/ui, packages/domain.

## Architecture Rules
- .svelte = visual structure only (thin)
- .svelte.ts = component model logic ($state, $derived, $effect)
- Domain logic NEVER in .svelte or .svelte.ts
- Dependency: view → presentation-model → application → domain (never reverse)
- Shared UI in packages/ui; app-specific in apps/desktop-app
- Import browser-safe code from domain/shared only

## Svelte 5 Syntax (non-negotiable)
- Props: `let { foo }: Props = $props()` — never `export let`
- Reactivity: $state, $derived, $effect — never top-level `$:`
- Events: `onclick`, `onchange` — never `on:`
- Communication: callback props — never `createEventDispatcher`
- Composition: snippet props + {@render} — never `<slot>`
- Icons: `import ... from @lucide/svelte/icons/<name>` — never barrel

## Chat UI Rules
- Chat class from @ai-sdk/svelte — never destructure (breaks reactivity)
- ChatComposer requires Tooltip.Provider ancestor
- packages/ui types = structural mirrors only; do not import domain/shared

## Process
1. Inspect relevant routes/pages/components
2. Build change map: domain → application → adapter → .svelte.ts model → .svelte view
3. Implement inside-out; wire page/component last
4. Run deterministic checks: `bun test`, `bun typecheck`, `bun lint`
5. Summarize: files changed by layer, assumptions, debt left

## What You Can Do
- Read/write/edit files in the frontend scope
- Run bash for validation (vitest, typecheck, lint)
- Use grep/find/ls for code inspection

## What You Must NOT Do
- Modify backend/database code
- Skip the .svelte.ts model layer
- Use old Svelte 4 patterns ($:, on:, slots, createEventDispatcher)
- Propose or run subagents
- Declare task complete without running checks
```

**Key changes:**
- `inheritProjectContext: false` — no global AGENTS.md mixed in
- Explicit "You EDIT FILES" upfront — counteracts any leaked "never edit" from APPEND_SYSTEM
- Added deterministic-check step in process — aligns with study/POC emphasis on checks before declaring completion
- Self-contained: all rules the agent needs are in its own system prompt

---

### 5.5 Updated Agent Config: `backend-worker` (Example)

```yaml
---
name: backend-worker
description: Backend/domain implementation specialist. Implements services, repositories, APIs, following clean architecture with SurrealDB persistence.
tools: read, grep, find, ls, bash, edit, write
systemPromptMode: append
inheritProjectContext: false          # CHANGED: was true
inheritSkills: false
skills: backend-implementtion
---

You are a backend implementation specialist. You EDIT FILES — this is your job.

Tech stack: Bun, Hono, SurrealDB, AI SDK v5 (streaming), TypeScript.
Monorepo: apps/desktop-app, packages/ui, packages/domain.

## Architecture (clean, non-negotiable)
- **Domain**: entities, value objects, domain services, invariants, pure rules
- **Application**: use cases, command/query handlers, DTOs, port definitions
- **Adapters**: thin Hono routes, repo implementations, gateways, presenters
- **Infrastructure**: SurrealDB queries, SDK clients, wiring
- Dependency rule: infrastructure → adapters → application → domain (never reverse)

## Monorepo Rules
- Shared domain/application in packages/domain
- Browser-safe exports via domain/shared
- No duplication in apps/desktop-app
- Workspace imports, not relative cross-package

## SurrealDB Patterns
- Repositories handle ALL persistence details
- APIs use plain string IDs, not SurrealDB RecordId
- Services hold use cases; controllers are thin
- Each test file: own connection in beforeEach with unique namespace
- Reference pattern: SurrealTodoRepository.test.ts

## Testing (critical)
- Real SurrealDB mem:// via createDbConnection({ host: 'mem://' })
- NEVER InMemoryFooRepository fakes
- Only mock: AI SDK LLMs, file-system sources, third-party APIs
- close connection in afterEach

## Process
1. Inspect code paths
2. Identify bounded context, entrypoints, seams
3. Build change map by layer
4. Implement inside-out (domain → application → ports → adapters → wiring)
5. Add tests at correct layer
6. Run deterministic checks: `bun test`, `bun typecheck`, `bun lint`
7. Summarize: files by layer, assumptions, debt

## What You Can Do
- Read/write/edit files in backend scope
- Run bash for validation (jest, typecheck, build)
- Use grep/find/ls for code inspection

## What You Must NOT Do
- Modify frontend code
- Put framework types in domain
- Put domain logic in controllers/routes
- Propose or run subagents
- Declare task complete without running checks
```

---

## 6. Implementation Steps

Organized by the POC's success criteria and the study's implementation priority (documentation/templates first, then safety/audit, then evaluation loops).

### Phase 1: Documentation and Templates

| Step | Task | Output | Verification |
|---|---|---|---|
| 1.1 | Backup current `~/.pi/agent/APPEND_SYSTEM.md` | `.bak` file exists | `ls ~/.pi/agent/APPEND_SYSTEM.md.bak` |
| 1.2 | Replace APPEND_SYSTEM.md with minimal universal rules (Section 5.1) | File < 15 lines | `wc -l ~/.pi/agent/APPEND_SYSTEM.md` |
| 1.3 | Backup current `~/.pi/agent/AGENTS.md` | `.bak` file exists | — |
| 1.4 | Replace AGENTS.md with trimmed reference (Section 5.2) | File < 60 lines | `wc -l ~/.pi/agent/AGENTS.md` |
| 1.5 | Verify no parent-only doctrine remains in APPEND_SYSTEM.md or AGENTS.md | Clean content | `grep -i "conductor\|never edit\|pre-action" ~/.pi/agent/APPEND_SYSTEM.md ~/.pi/agent/AGENTS.md` returns nothing |

### Phase 2: Agent Config Reorganization (Safety / Audit)

| Step | Task | Output | Verification |
|---|---|---|---|
| 2.1 | Update `frontend-worker.md`: `inheritProjectContext: false`, self-contained identity, deterministic checks in process | Updated config | Session file has no leaked AGENTS.md content |
| 2.2 | Update `backend-worker.md`: `inheritProjectContext: false`, self-contained identity, deterministic checks in process | Updated config | Session file has no leaked AGENTS.md content |
| 2.3 | Update `qa-worker.md`: `inheritProjectContext: false`, explicit edit/no-edit policy | Updated config | — |
| 2.4 | Update `domain-reviewer.md`: `inheritProjectContext: false`, "Do NOT edit files" upfront | Updated config | — |
| 2.5 | Update `designer.md`: `inheritProjectContext: false` | Updated config | — |
| 2.6 | Update `iterative-implementer.md`: `inheritProjectContext: false` | Updated config | — |
| 2.7 | Run `subagent({ action: "list" })` to validate all agent configs parse correctly | No validation errors | Agent list displays normally |

### Phase 3: Project-Level Context Template

| Step | Task | Output | Verification |
|---|---|---|---|
| 3.1 | Create `<repo>/AGENTS.md` template with tech stack, monorepo layout, API conventions | Template in repo | Parent reads it naturally (Pi walks up from cwd) |
| 3.2 | Add template to one project repo as trial | Repo has AGENTS.md | — |

### Phase 4: Smoke Tests (POC Success Criteria)

| Test | Task | POC Criterion Met |
|---|---|---|
| 4.1 | Parent dispatches `scout` for a codebase question → reads output → does NOT read files itself | Parent delegates context gathering |
| 4.2 | Parent dispatches `frontend-worker` for a small UI task → worker edits files without conflict | No "never edit" contradiction in session |
| 4.3 | Check subagent session file for leaked `# Project Context` content from global AGENTS.md | `inheritProjectContext: false` works |
| 4.4 | Parent dispatches `qa-worker` for `bun test` → reads results → does NOT run tests itself | Parent delegates verification |
| 4.5 | Parent loads `conductor` skill → executes harness-playbook Phase 1 (plan) on a real task | Planner outputs structured contract |

### Phase 5: Skills Reorganization (Overlap Resolution)

| Step | Task | Output | Verification |
|---|---|---|---|
| 5.1 | Edit `conductor/SKILL.md`: add skill taxonomy block, cross-reference table, remove duplicated 8-phase loop prose | Updated skill | `grep -c "harness-playbook" ~/.pi/agent/skills/conductor/SKILL.md` > 0 |
| 5.2 | Edit `harness-playbook/SKILL.md`: add Phase 0 "Load conductor skill"; remove duplicated parent doctrine; add cross-links to `plan-implemention` and `spike` | Updated skill | `grep -c "conductor" ~/.pi/agent/skills/harness-playbook/SKILL.md` > 0 |
| 5.3 | Edit `plan-implemention/SKILL.md`: add boundary note distinguishing from harness-playbook; add cross-link | Updated skill | Boundary note present |
| 5.4 | Edit `spike/SKILL.md`: add cross-link to `plan-implemention` and `harness-playbook` for handoff | Updated skill | Cross-link present |
| 5.5 | Edit `post-mortem/SKILL.md`: add cross-link to `self-evolve` for instruction fixes | Updated skill | Cross-link present |
| 5.6 | Edit `self-evolve/SKILL.md`: add trigger clarity note linking to post-mortem | Updated skill | Trigger note present |
| 5.7 | Verify no two skills contain the same paragraph of parent doctrine | No duplication | Diff skills' "Hard rules" sections are unique |

### Phase 6: Parent Behavior Audit

| Step | Task | Output |
|---|---|---|
| 6.1 | Run 3 real tasks through the full serial loop (plan → generate → checks → evaluate → report) | 3 harness events in ledger |
| 6.2 | Document any parent violations (parent editing files, running tests, reading for context) | Follow-up issue or wiki entry |
| 6.3 | Capture lessons learned to `pi-llm-wiki` or `.pi/raw/sources` | Wiki page or source file |

---

## 7. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Agent forgets shared conventions (API patterns, monorepo structure) now that global AGENTS.md is stripped | Medium | Medium | Move project-specific conventions to `<repo>/AGENTS.md`; move shared patterns to agent config or a shared skill. Study: "Prefer explicit directory and boundary map." |
| Agent still gets leaked APPEND_SYSTEM.md minimal rules and those cause issues | Low | Low | APPEND_SYSTEM.md is now ~8 lines of universal rules only; actively harmless |
| Child boundary instruction "ignore parent-only orchestration" used to paper over a real bug | Medium | Medium | Reorganization removes the contradiction at the source; boundary instruction becomes redundant safety net |
| Skills don't show up in agent prompt | Low | High | Skills are listed in system prompt; agent-specific skill via `skills:` in agent config gets auto-loaded. Verify with `subagent({ action: "list" })` |
| Agent config frontmatter syntax error breaks agent discovery | Low | Medium | Pi validates frontmatter; test after Phase 2 changes |
| Repo `AGENTS.md` conflicts with global `AGENTS.md` or parent doesn't know to read it | Low | Low | Pi walks up from cwd and concatenates all matching AGENTS.md files — both get included naturally |
| Parent agent forgets to load `conductor` skill before harness | Medium | High | `harness-playbook` Phase 0 explicitly requires loading `conductor` first; AGENTS.md reference mentions it |
| Deterministic checks skipped because generator declares success before running them | Medium | High | Generator configs now include "Run deterministic checks" as an explicit process step; parent enforces Phase 4 before Phase 5 |
| Evaluator edits files despite "Do NOT edit" prompt (POC Gap: no `tool_call` enforcement) | Medium | High | Use `context: "fresh"` to remove temptation; parent inspects evaluator output for `edit`/`write` tool calls. Future extension can add read-only enforcement. |
| Token budget explosion from retry loops | Low | Medium | Cap retries at 3 (POC default); compact between turns; use smaller models for substeps via `SUBAGENT_MODEL_MATRIX.md` |
| **Skill overlap not fully resolved** — conductor still contains some procedural content or harness-playbook still contains topology philosophy | Medium | High | Section 5.3 defines exact edits per skill; acceptance criteria in Phase 5 verify no duplicate paragraphs remain |
| **Ambiguous trigger selection** — parent loads `conductor` when they should load `harness-playbook`, or vice versa | Medium | Medium | Skill taxonomy table (Section 2.5) is the source of truth; add to AGENTS.md reference; conductor description frontmatter updated to emphasize "topology" |
| **Stale duplicate doctrine after migration** — future edits to one skill forget to update the other | Medium | Medium | Add a "Cross-skill consistency check" to the verification checklist; run `grep` for shared phrases across skills during smoke tests |
| **Migration drift** — pi.dev files on disk diverge from this plan over time as users edit skills independently | Medium | Low | Schedule quarterly `self-evolve` run on all skills; post-mortem captures drift; AGENTS.md reference points to canonical skill descriptions |

---

## 8. Verification Checklist

- [ ] `~/.pi/agent/APPEND_SYSTEM.md` is < 15 lines and contains no parent-only doctrine
- [ ] `~/.pi/agent/AGENTS.md` is < 60 lines and is purely reference material
- [ ] `skills/conductor/SKILL.md` contains parent doctrine + topology guidance; no duplicated 8-phase loop prose
- [ ] All agent configs set `inheritProjectContext: false`
- [ ] All agent configs have explicit identity statement (edit vs no-edit)
- [ ] `frontend-worker.md` contains ALL Svelte 5 rules (not relying on inherited AGENTS.md)
- [ ] `backend-worker.md` contains ALL clean architecture rules (not relying on inherited AGENTS.md)
- [ ] `qa-worker.md` is self-contained
- [ ] `domain-reviewer.md` is self-contained
- [ ] `designer.md` is self-contained
- [ ] `iterative-implementer.md` is self-contained
- [ ] At least one `<repo>/AGENTS.md` trial exists
- [ ] `subagent({ action: "list" })` shows all agents correctly with no validation errors
- [ ] Smoke test: parent delegates `scout` for a codebase question → scout answers without parent reading files
- [ ] Smoke test: parent delegates `frontend-worker` for a small UI task → worker edits files without "never edit" conflict
- [ ] Confirm subagent session file does NOT contain `# Project Context` content from global AGENTS.md
- [ ] **Harness-playbook skill references `conductor` as prerequisite (Phase 0)**
- [ ] **Harness-playbook Phase 0 added: "Read conductor skill for parent doctrine and topology"**
- [ ] **Harness-playbook Phase 4 (deterministic checks) is mandatory before Phase 5 (evaluate)**
- [ ] **Harness-playbook Phase 5 evaluators use `context: "fresh"`**
- [ ] **3 real harness loop events logged to `pi-qmd-ledger` (main.jsonl)**

---

## Appendix A: Current Agent Config Analysis

| Agent | inheritProjectContext | Current System Prompt Length | Self-Contained? | Needs Change? |
|---|---|---|---|---|
| frontend-worker | true | ~70 lines | Partial (tech stack present) | Yes — add identity statement, set false, add deterministic check step |
| backend-worker | true | ~80 lines | Partial (architecture present) | Yes — add identity statement, set false, add deterministic check step |
| qa-worker | true | ~55 lines | Partial | Yes — add explicit edit/no-edit policy, set false |
| domain-reviewer | true | ~50 lines | Yes (review criteria present) | Yes — set false (already self-contained) |
| designer | true | ~45 lines | Yes | Yes — set false |
| iterative-implementer | true | ~45 lines | Partial | Yes — set false |

All current agent configs are already **substantial** in their system prompts. The main gaps are:
1. Explicit identity statement ("You EDIT FILES" / "You do NOT edit files")
2. `inheritProjectContext: false`
3. Deterministic check step in generator process (study: "Use computational checks before inferential checks")

## Appendix B: Mapping to Consolidated Study Recommendations

| Study Recommendation | How This Plan Addresses It |
|---|---|
| "Short always-on context" | AGENTS.md trimmed to ~40 lines; APPEND_SYSTEM.md to ~8 lines |
| "Agent = Model + Harness" | Agent configs become self-contained harnesses with full identity + rules |
| "Feedforward + feedback" | Feedforward in agent configs; feedback via deterministic checks + evaluator |
| "Prefer deterministic checks" | Generator configs include check step; harness-playbook mandates checks before eval |
| "Separate generator and evaluator" | `inheritProjectContext: false` removes leaked doctrine; evaluators run in `fresh` context |
| "Skills for repeatable procedures" | Parent doctrine stays in `conductor` skill; harness workflow stays in `harness-playbook`; no new skill created |
| "Small loops beat clever workflows" | First deliverable is docs/templates (Phase 1), then agent configs (Phase 2), then smoke tests (Phase 4) |
| "Keep core small, package reusable pieces" | No new extension; reorganization of existing files only |
| "Project-specific conventions in repo AGENTS.md" | Phase 3 creates project-level `<repo>/AGENTS.md` template |

---

## Appendix C: Skills Inventory (Current State vs. Target State)

| Skill | Current Location | Current Content Mix | Target State | Edits Required |
|---|---|---|---|---|
| `conductor` | `~/.pi/agent/skills/conductor/SKILL.md` | Parent doctrine + topology + procedural scripts + harness rules | Parent doctrine + topology + worker prompt engineering ONLY | Remove procedural scripts; add skill taxonomy block; add cross-references |
| `harness-playbook` | `~/.pi/agent/skills/harness-playbook/SKILL.md` | 8-phase loop + parent doctrine duplication + topology notes | 8-phase loop + schemas + examples ONLY | Add Phase 0 referencing conductor; remove duplicated doctrine; add cross-links |
| `plan-implemention` | `~/.pi/agent/skills/plan-implemention/SKILL.md` | Planning workflow with 3 parallel subagents | Planning workflow ONLY, with boundary note | Add boundary note vs harness-playbook; add cross-link |
| `spike` | `~/.pi/agent/skills/spike/SKILL.md` | Research spike delegation | Research spike ONLY, with handoff guidance | Add cross-links to plan-implemention and harness-playbook |
| `post-mortem` | `~/.pi/agent/skills/post-mortem/SKILL.md` | Session reflection + dispatch | Session reflection + dispatch, with self-evolve trigger | Add cross-link to self-evolve |
| `self-evolve` | `~/.pi/agent/skills/self-evolve/SKILL.md` | Artifact evolution via Hermes | Artifact evolution, with trigger clarity | Add trigger note linking to post-mortem |

### Skills that remain unchanged

| Skill | Why Unchanged |
|---|---|
| `backend-implemention` | Backend-specific feedforward rules; no overlap with orchestration |
| `svelte-frontend` | Frontend-specific feedforward rules; no overlap with orchestration |
| `use-browser` | Runtime verification tooling; no overlap with orchestration |
| `qmd-ledger` | Memory injection; no overlap with orchestration |
| `llm-wiki` | Knowledge management; no overlap with orchestration |

### New skills NOT created

| Proposed Skill | Why Rejected | Where Content Goes Instead |
|---|---|---|
| `parent-orchestrator` (NEW) | Would duplicate `conductor` which already has parent doctrine | Edit `conductor` in place; no new directory |

---

## Appendix D: Migration Steps for pi.dev Alignment

### Step 1: Audit Current State

```bash
# Count lines in context files
wc -l ~/.pi/agent/AGENTS.md ~/.pi/agent/APPEND_SYSTEM.md

# Check for parent-only doctrine leakage
grep -n "conductor\|never edit\|pre-action\|NEVER.*run tests" ~/.pi/agent/AGENTS.md ~/.pi/agent/APPEND_SYSTEM.md

# Check skill overlap
grep -c "NEVER edit\|NEVER run tests" ~/.pi/agent/skills/conductor/SKILL.md ~/.pi/agent/skills/harness-playbook/SKILL.md
```

### Step 2: Backup

```bash
cp ~/.pi/agent/AGENTS.md ~/.pi/agent/AGENTS.md.bak.$(date +%s)
cp ~/.pi/agent/APPEND_SYSTEM.md ~/.pi/agent/APPEND_SYSTEM.md.bak.$(date +%s)
for skill in conductor harness-playbook plan-implemention spike post-mortem self-evolve; do
  cp ~/.pi/agent/skills/$skill/SKILL.md ~/.pi/agent/skills/$skill/SKILL.md.bak.$(date +%s)
done
```

### Step 3: Edit in Priority Order

1. `APPEND_SYSTEM.md` — minimal universal rules (Phase 1.2)
2. `AGENTS.md` — trimmed reference (Phase 1.4)
3. `conductor/SKILL.md` — add taxonomy, remove procedural overlap (Phase 5.1)
4. `harness-playbook/SKILL.md` — add Phase 0, remove doctrine duplication (Phase 5.2)
5. `plan-implemention/SKILL.md` — add boundary note (Phase 5.3)
6. `spike/SKILL.md` — add cross-links (Phase 5.4)
7. `post-mortem/SKILL.md` + `self-evolve/SKILL.md` — trigger clarity (Phase 5.5–5.6)
8. Agent configs — `inheritProjectContext: false` + identity statements (Phase 2)

### Step 4: Validate with Representative Harness Tasks

Run these 3 tasks after reorganization to prove alignment:

| # | Task | What It Proves |
|---|---|---|
| 1 | "Plan and implement a simple API endpoint + UI panel using harness" | Full loop works; conductor + harness-playbook load without conflict |
| 2 | "Run a spike on auth architecture, then plan, then harness implement" | Spike → plan-implemention → harness-playbook handoff works |
| 3 | "Implement a feature, fail a check, retry, then post-mortem" | Retry path works; post-mortem finds skill issue; self-evolve queues fix |

### Step 5: Quarterly Drift Check

Add to calendar: every 90 days, run:

```bash
# Check for doctrine drift across skills
grep -h "NEVER edit\|NEVER run tests\|pre-action" ~/.pi/agent/skills/*/SKILL.md | sort | uniq -c | sort -rn
# Any line appearing in >1 skill is a drift bug
```
