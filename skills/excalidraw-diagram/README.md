# Excalidraw Diagram Skill

This repo vendors a Codex-friendly local skill for generating Excalidraw diagrams that argue visually, not just display labeled boxes.

## Repo-Local Codex Wiring

- Skill folder: `skills/excalidraw-diagram/`
- Skill instructions: `skills/excalidraw-diagram/SKILL.md`
- Codex UI metadata: `skills/excalidraw-diagram/agents/openai.yaml`
- Project skill registration: root `AGENTS.md`

## Renderer Setup

The skill includes a render pipeline so Codex can render `.excalidraw` JSON to PNG, inspect the result, and iterate on layout issues.

```bash
cd skills/excalidraw-diagram/references
uv sync
uv run playwright install chromium
```

## Usage

Ask Codex to use the local skill directly:

> "Use $excalidraw-diagram to create an Excalidraw diagram showing how the AG-UI protocol streams events from an AI agent to a frontend UI"

## Customization

Edit `skills/excalidraw-diagram/references/color-palette.md` to change the brand palette used by the skill.
