# Definition of Ready (DoR)

Use this checklist **before** moving a build ticket to Coder implementation (`in_progress` checkout) on **non-trivial** work (multi-file behavior change, new API surface, persistence shape change, or chat UX change).

Owner: **Orchestrator** (prepare) + **CEO / CTO** (ack on ambiguous risk).

## Checklist

- [ ] **OpenSpec change exists** for the slice (`openspec/changes/<id>/`) with `proposal.md`, `design.md`, `tasks.md`, and delta specs under `specs/**` as required by the schema.
- [ ] **Paperclip thread links the change id** (or post-archive `openspec/specs/**` paths) so heartbeats and humans share a pointer.
- [ ] **Acceptance criteria** are written as **3–7 testable bullets** (QA can execute; at least one notes automated coverage intent: unit / repo test / e2e).
- [ ] **Risks called out** (data loss, security, perf, migration) with a one-line mitigation or “accepted risk”.
- [ ] **Rollback / feature-flag stance** noted when user-visible behavior ships (even if “none; revert PR”).
- [ ] **E2E scope** identified for desktop/chat surfaces when routes, streaming, or persistence are touched (which Playwright spec or `skip` rationale).
- [ ] **OpenAPI / contract** stub or example payloads linked when HTTP/RPC contracts change (OpenSpec covers intent; wire contracts may still need OpenAPI).

## Explicit outs (do not block on)

- Perfect upfront specs for greenfield spikes under explicit “spike” labeling.
- One-line typo fixes and pure refactors with no behavior change.
