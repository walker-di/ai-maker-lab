## Why

The board asked to **implement the SDD readiness plan** captured on Paperclip **AIMA-11**: move from intent scattered across chats to **reviewable specs + traceable tasks** before implementation.

## What Changes

- A **default OpenSpec schema** (`spec-driven`) and **first tracked change** (`sdd-workflow-adoption`) exist under `openspec/` (CLI integrations may already exist from an earlier bootstrap commit in this branch).
- **Process templates** live in-repo under `docs/process/` (Definition of Ready + Paperclip `plan` headings).
- Root `AGENTS.md` already documents the **OpenSpec vs Paperclip** split; this change links concrete paths.

## Capabilities

### New Capabilities

- **Engineering SDD workflow**: teams can open a change folder, validate it with the OpenSpec CLI, and link it from Paperclip threads.

### Modified Capabilities

- None to product runtime; this is **process and repository structure** only.

## Impact

- Engineers and agents have a **single obvious place** (`openspec/changes/...`) for spec deltas alongside `docs/process` for gates.
- No runtime behavior change until follow-up feature changes land under their own OpenSpec change ids.
