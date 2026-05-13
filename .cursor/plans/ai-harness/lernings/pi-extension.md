Your study is already at the level of a serious harness architecture document. The important thing now is avoiding two traps:

1. building a giant orchestration framework too early
2. turning the orchestrator into “just another chatting agent”

The strongest direction for Pi is:

> **Supervisor harness + specialized workers + deterministic evaluators + shared memory substrate**

Not a swarm.

Your document already converges on the right architecture.

---

# Recommended Architecture

You should structure the system as:

```text
User
  ↓
Supervisor / Orchestrator Agent
  ↓
Planner
  ↓
Task Router
  ├── Backend Agent
  ├── Frontend Agent
  ├── QA Agent
  ├── Architect Agent
  ├── Security Agent
  ├── Docs Agent
  └── Release Agent
  ↓
Evaluator Layer
  ↓
Reporter
```

The orchestrator should NOT write most code itself.

Its job is:

* decomposition
* routing
* coordination
* dependency management
* memory
* retries
* verification orchestration
* final synthesis

That distinction is critical.

---

# The Most Important Design Decision

## Do NOT make agents conversational personalities

Make them:

```ts
Role
+ Scope
+ Inputs
+ Outputs
+ Constraints
+ Checks
```

Example:

```yaml
agent: backend
writes_to:
  - apps/api/**
cannot_touch:
  - apps/web/**
required_checks:
  - bun test
  - bun typecheck
```

This matters more than prompt quality.

---

# Recommended Agent Topology

## 1. Supervisor Agent

This is the only agent exposed to the user.

Responsibilities:

* read request
* create execution plan
* define acceptance criteria
* assign tasks
* coordinate retries
* merge outputs
* trigger evaluators
* maintain memory
* generate final report

Should NOT:

* edit large code directly
* self-approve
* run broad autonomous loops forever

---

## 2. Planner Agent

Converts vague requests into:

```json
{
  "goal": "...",
  "constraints": [],
  "acceptance_criteria": [],
  "affected_areas": [],
  "required_agents": [],
  "risks": []
}
```

This becomes the contract for all downstream agents.

Your study correctly emphasizes this.

---

## 3. Worker Agents

You already identified the right initial set.

### Backend Agent

Focus:

* APIs
* schemas
* database
* services
* queues
* auth
* infra code

### Frontend Agent

Focus:

* UI
* responsive
* accessibility
* state management
* UX

### QA Agent

Focus:

* tests
* Playwright
* repro steps
* regression checks
* edge cases

### Architect Agent

Focus:

* boundaries
* scalability
* patterns
* dependency direction
* domain consistency

Should mostly REVIEW rather than write.

This is important.

### Security Agent

Very valuable later.

Focus:

* secrets
* auth flows
* injection
* permissions
* unsafe shell
* SSRF
* XSS
* dependency risk

---

# The Key Insight:

# Evaluators must be independent

Your study nails this.

Never allow:

```text
generator == evaluator
```

That is where most agent systems collapse.

The evaluator must:

* receive original task
* receive diff
* receive verification output
* NOT mutate code

Instead:

```json
{
  "status": "fail",
  "findings": [...]
}
```

Then supervisor routes fixes back to generators.

This single design decision dramatically improves reliability.

---

# Recommended Pi-Based Implementation

Pi is actually unusually well-suited for this architecture because of:

* session trees
* extensions
* tool interception
* SDK
* resource loader
* branch summaries
* extension state
* tool result persistence

([Pi.dev][1])

---

# Recommended Technical Stack

## Layer 1 — Pi Extensions

Use extensions for:

* guardrails
* routing
* orchestration commands
* memory
* observability
* permissions
* evaluator triggers

NOT for business logic.

---

## Layer 2 — Skills

Each agent should map to a skill package.

Example:

```text
skills/
  backend/
  frontend/
  qa/
  architect/
  security/
```

Each contains:

```text
SKILL.md
references/
scripts/
assets/
```

Exactly like your study recommends.

---

## Layer 3 — Orchestrator Extension

This becomes the brain.

Example commands:

```text
/orch:plan
/orch:run
/orch:status
/orch:retry
/orch:audit
/orch:memory
```

The orchestrator extension should:

* spawn sessions
* fork branches
* assign scopes
* inject contracts
* collect outputs
* trigger evaluators
* persist memory

---

# Strong Recommendation:

# Use Session Forking Aggressively

Do NOT let all agents share one giant context.

Instead:

```text
main session
  ├── backend branch
  ├── frontend branch
  ├── qa branch
  └── architect branch
```

Pi’s session tree system is a major advantage here. ([Pi.dev][1])

Benefits:

* isolated context
* smaller token usage
* less hallucinated cross-contamination
* easier retries
* cleaner evaluation

---

# Recommended Workflow

## Phase 1 — Planning

Supervisor:

* parses request
* builds contract
* identifies write scopes
* identifies dependencies

Output:

```json
{
  "tasks": [...],
  "dependencies": [...],
  "acceptance_criteria": [...]
}
```

---

## Phase 2 — Execution

Spawn workers.

Example:

```text
backend:
  scope: apps/api/**

frontend:
  scope: apps/web/**

qa:
  readonly: true
```

Workers only operate within allowed paths.

Use extension-level enforcement.

---

## Phase 3 — Deterministic Checks

Before ANY evaluator:

Run:

* lint
* tests
* typecheck
* build
* Playwright
* schema validation

Your study is absolutely correct:

> deterministic > inferential

---

## Phase 4 — Evaluators

Architect evaluator:

* structure
* layering
* scope creep

QA evaluator:

* missing tests
* regressions
* broken UX

Security evaluator:

* auth
* injection
* secrets

---

## Phase 5 — Retry Loop

Supervisor routes findings back to generators.

Small loops only.

Your “Ralph Loop” section is extremely important.

Avoid:

```text
mega-autonomous-agent
```

Prefer:

```text
small diff
→ verify
→ evaluate
→ retry
```

---

# Memory Architecture

Your memory section is one of the strongest parts of the study.

You should implement:

```text
working memory
+
episodic memory
+
harness learnings
+
project memory
```

---

# Recommended Actual Storage

## Working Memory

Current context window only.

---

## Episodic Memory

Pi session JSONL.

Good enough initially.

---

## Durable Project Memory

```text
.pi/orchestrator/memory/
```

Store:

```json
{
  "type": "harness_learning",
  "failure": "frontend repeatedly breaks dark mode",
  "guardrail": "always run visual theme checks",
  "confidence": 0.82
}
```

---

# One of Your Best Ideas:

# Harness Learnings

This is where your system becomes compounding.

Example lifecycle:

```text
failure repeated 3x
→ extracted
→ proposed learning
→ approved
→ converted into:
   - rule
   - evaluator check
   - skill gotcha
   - guardrail
```

That is exactly how mature agent systems evolve.

---

# Biggest Mistake To Avoid

Do NOT build:

```text
generic DAG orchestration engine
```

first.

Huge mistake.

Your study correctly warns against it.

Instead:

Start with:

```text
planner
→ generator
→ evaluator
```

Then add:

* retries
* memory
* isolation
* specialization
* branch management

Only later:

* parallelism
* dynamic routing
* graph execution

---

# Recommended MVP

Build ONLY this first:

## `/orch:run`

Pipeline:

```text
1. planner
2. backend/frontend generator
3. deterministic checks
4. evaluator
5. retry if needed
6. final report
```

That alone is already powerful.

---

# Concrete Pi Features You Should Exploit

## Extension Hooks

Especially:

```ts
pi.on("tool_call")
pi.on("before_agent_start")
pi.on("agent_end")
```

These are your orchestration backbone. ([Pi.dev][1])

---

## Tool Interception

Use for:

* scope enforcement
* dangerous command blocking
* evaluator auto-triggering
* observability

---

## appendEntry()

Critical for orchestration state persistence.

([Pi.dev][1])

Use it for:

```text
task graph
agent assignments
retry counts
accepted learnings
evaluation history
```

---

# Recommended Agent Contract Format

Use strict structured contracts.

Example:

```json
{
  "task_id": "task_42",
  "role": "frontend",
  "goal": "Add settings modal",
  "scope": [
    "apps/web/components/settings/**"
  ],
  "constraints": [
    "Do not modify backend"
  ],
  "acceptance_criteria": [
    "Responsive",
    "Keyboard accessible",
    "Dark mode compatible"
  ],
  "required_checks": [
    "pnpm test",
    "pnpm lint"
  ]
}
```

This is MUCH better than freeform prompting.

---

# What Makes Your Study Strong

You already converged on several advanced truths:

## 1. Harness > Prompt

Correct.

## 2. Deterministic checks > vibes

Correct.

## 3. Raw traces matter

Correct.

## 4. Small loops beat giant autonomy

Very correct.

## 5. Independent evaluators are essential

Probably the single most important insight.

## 6. Memory should be retrieval-based

Correct.

## 7. Package-first architecture for Pi

Correct.

---

# Final Recommendation

Your best next move is NOT:

```text
multi-agent framework
```

Your best next move is:

```text
safe orchestrator package
```

Specifically:

## Build these first

### 1. orchestration extension

### 2. path guard extension

### 3. evaluator package

### 4. memory package

### 5. harness audit command

Exactly the order your roadmap proposes.

That sequencing is very solid.

---

You are already thinking about this at the right abstraction level. The next step is reducing the design into a very small, reliable MVP loop before expanding into more autonomous coordination.

[1]: https://pi.dev/docs/latest/extensions?utm_source=chatgpt.com "Pi Coding Agent"

In normal IT companies, the role you’re describing is usually split across several existing roles rather than called “orchestrator.”

The closest real-world titles are:

| Your AI role                                        | Common industry equivalent           |
| --------------------------------------------------- | ------------------------------------ |
| Coordinates multiple specialist teams               | Technical Program Manager (TPM)      |
| Owns technical execution and architecture alignment | Tech Lead / Technical Lead           |
| Manages engineering delivery flow                   | Engineering Manager                  |
| Coordinates agile execution across teams            | Scrum Master / Delivery Manager      |
| Owns system-wide technical direction                | Software Architect / Chief Architect |
| Coordinates many parallel teams                     | Program Manager                      |

The strongest analogy for your AI system is probably:

# Technical Program Manager + Tech Lead + Architect

combined into one AI supervisor.

---

# In AI systems, the industry terms are usually:

| AI term                | Meaning                     |
| ---------------------- | --------------------------- |
| Supervisor Agent       | Oversees worker agents      |
| Coordinator Agent      | Routes work                 |
| Manager Agent          | Assigns tasks and retries   |
| Executive Agent        | High-level decision maker   |
| Planner Agent          | Creates execution plans     |
| Runtime Controller     | Manages execution lifecycle |
| Multi-Agent Controller | Coordinates agents          |
| Agent OS               | Full orchestration runtime  |

“Orchestrator” is common in AI infrastructure because of systems like:

* Kubernetes orchestration
* workflow orchestration
* container orchestration
* DAG orchestration

But for developers, it can sound overly infrastructure-focused.

---

# My recommendation

Instead of:

```text
Orchestrator Agent
```

use:

```text
Engineering Lead Agent
```

or

```text
Technical Lead Agent
```

Those names feel much more natural to engineers.

Especially because your agent:

* coordinates specialists,
* owns execution,
* validates quality,
* routes work,
* manages dependencies.

That is almost exactly what a human tech lead does. ([Wikipedia][1])

---

# Even Better Naming Structure

Instead of:

```text
orchestrator
subagents
```

use:

```text
Engineering Lead
Specialist Agents
```

Example:

```text
Engineering Lead
├── Backend Specialist
├── Frontend Specialist
├── QA Specialist
├── Architecture Reviewer
├── Security Reviewer
└── Release Specialist
```

This sounds much closer to a real engineering organization.

---

# Another Strong Option:

# “Technical Director”

If the system becomes more strategic and less hands-on:

```text
Technical Director Agent
```

works very well.

That role in companies often:

* coordinates teams,
* aligns architecture,
* allocates work,
* ensures delivery quality,
* bridges business and engineering. ([Wikipedia][2])

---

# What I Would Personally Use

For your architecture:

```text
Lead Engineer Agent
```

or

```text
Engineering Lead
```

because it implies:

* technical ownership
* coordination
* review authority
* delegation
* architecture awareness
* delivery responsibility

without sounding overly “AI framework.”

---

# Recommended Final Terminology

```text
Engineering Lead
  ├── Backend Engineer
  ├── Frontend Engineer
  ├── QA Engineer
  ├── Architect Reviewer
  ├── Security Reviewer
  └── Release Engineer
```

And internally:

```text
planner
generator
evaluator
```

Those internal terms are excellent and align with your study.

[1]: https://en.wikipedia.org/wiki/Lead_programmer?utm_source=chatgpt.com "Lead programmer"
[2]: https://en.wikipedia.org/wiki/Technical_director?utm_source=chatgpt.com "Technical director"

---

## Related documents

- Program ADR/PRD (canonical `harness:*` commands; `/orch:*` here is illustrative only): `.cursor/plans/ai-harness/ai-harness-ADR.md`, `.cursor/plans/ai-harness/ai-harness-PRD.md`
- Consolidated harness study: `.cursor/plans/ai-harness/lernings/herness-study-consolidated.md`
- Durable memory: `.cursor/plans/ai-harness/qmd-subconscious-ADR.md`, `.cursor/plans/ai-harness/qmd-subconscious-PRD.md`
