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

## PNG export parity

When a folder contains both `*.excalidraw` and `*.excalidraw.png`, the PNG is the **rendered export** of the JSON canvas (same content, different file format). After changing JSON, re-run `render_excalidraw.py` so the PNG stays in sync for READMEs and visual review.

For **Paperclip** (or similar) review threads, **attach those PNGs to the issue and embed them in comments** so approvers are not forced to open the workspace — see `SKILL.md` (“Paperclip / issue review hygiene”).

## Usage

Ask Codex to use the local skill directly:

> "Use $excalidraw-diagram to create an Excalidraw diagram showing how the AG-UI protocol streams events from an AI agent to a frontend UI"

## Customization

Edit `skills/excalidraw-diagram/references/color-palette.md` to change the brand palette used by the skill.
