## Context

`ai-maker-lab` is a Bun monorepo with strict adapter/domain/UI boundaries (see root `AGENTS.md`). Paperclip orchestrates agent heartbeats; OpenSpec holds **durable functional intent** next to the code.

## Goals / Non-Goals

**Goals:**

- Make **OpenSpec + Paperclip** the default pairing: OpenSpec answers “what must be true”; Paperclip answers “who owns checkout and review right now”.
- Provide **checklists** (DoR, plan template) so Orchestrator/QA can enforce readiness without ad-hoc negotiation.

**Non-Goals:**

- Replace `docs/experiment/**` long-form architecture series (they remain; OpenSpec links into them when needed).
- Add noisy CI gates that fail unrelated PRs (optional automation stays out until the board asks for it).

## Decisions

### 1. Default schema: `spec-driven`

We initialize the **project-local** `spec-driven` schema and set it as default in `openspec/config.yaml` so `openspec new change` works without extra flags.

**Alternatives considered:**

- **Schema-less / ad-hoc markdown only** — rejected because the CLI and skills expect a schema for validation and templates.

### 2. Process templates live under `docs/process/`

DoR and Paperclip plan headings are **versioned in git** beside other engineering docs.

**Alternatives considered:**

- **Paperclip-only templates** — rejected because agents working locally still need repo-resident pointers without opening the control plane.

### 3. Board-owned decisions stay open tasks

**Pilot slice** and **“spec complete” owner** remain CEO/board decisions; this change tracks them as unchecked tasks until answered.

## Risks / Trade-offs

- **Process weight:** mitigated by explicit “outs” on the DoR for spikes and trivial fixes.
- **Drift between OpenSpec and Paperclip:** mitigated by requiring a **link** from the Paperclip thread to the active change id.
