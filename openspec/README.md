# OpenSpec in `ai-maker-lab`

This directory holds **project-local OpenSpec** configuration: the default workflow schema and active change proposals.

- **Upstream docs:** [OpenSpec](https://openspec.dev/) · [`Fission-AI/OpenSpec`](https://github.com/Fission-AI/OpenSpec)
- **CLI:** `bunx @fission-ai/openspec@latest` (see `init`, `new change`, `validate`, `show`)
- **Default schema:** `openspec/schemas/spec-driven` (artifacts: proposal, specs, design, tasks)
- **Active adoption change:** `openspec/changes/sdd-workflow-adoption/` (tracks rollout tasks for Paperclip **AIMA-11**)

Paperclip owns checkout and review routing; OpenSpec owns **durable requirements** next to code. Link the change folder from the Paperclip issue thread when work is non-trivial.
