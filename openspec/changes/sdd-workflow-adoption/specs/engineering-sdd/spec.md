## ADDED Requirements

### Requirement: Repository hosts a default OpenSpec schema

The repository SHALL include a project-local OpenSpec schema named **`spec-driven`** under `openspec/schemas/spec-driven/` and declare it as the **default** schema in `openspec/config.yaml`.

#### Scenario: Creating a new change uses the default schema

- **WHEN** a contributor runs `openspec new change "<name>"` without `--schema`
- **THEN** the scaffolded change references the `spec-driven` schema in its `.openspec.yaml`

### Requirement: SDD adoption change is tracked

The repository SHALL include an OpenSpec change at **`openspec/changes/sdd-workflow-adoption/`** containing `proposal.md`, `design.md`, `tasks.md`, and at least one delta spec under `specs/**`.

#### Scenario: Validation succeeds for the adoption change

- **WHEN** a contributor runs `openspec validate sdd-workflow-adoption --type change --no-interactive`
- **THEN** validation completes successfully

### Requirement: Definition of Ready is documented

The repository SHALL include **`docs/process/definition-of-ready.md`** enumerating explicit gates before Coder checkout on non-trivial work, including OpenSpec change existence, acceptance criteria depth, risk/rollback notes, and e2e scope identification when applicable.

#### Scenario: Agents can discover DoR from AGENTS

- **WHEN** a contributor reads root `AGENTS.md`
- **THEN** they can navigate to `docs/process/` from linked guidance

### Requirement: Paperclip plan template exists

The repository SHALL include **`docs/process/paperclip-plan-template.md`** with the headings: Context, Goals, Non-goals, User flows, Acceptance criteria, Data model touchpoints, API / adapter touchpoints, Risks, Rollout.

#### Scenario: Orchestrator copies headings for a company plan doc

- **WHEN** an issue needs a Paperclip `plan` document beyond OpenSpec deltas
- **THEN** the headings exist as a single copy-paste source in-repo
