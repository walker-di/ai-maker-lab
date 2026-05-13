# AI Builder Lab Season Plan

Status: draft  
Mode: review-before-publish  
Source considered: `docs/concept.md`

This season plan adds the monetization-forward content arc from `docs/concept.md`: **AI Playground → Minecraft clone → Racing game → shared AI system**.

It should coexist with the existing AI Maker Lab build-log plan. Use it when the goal is channel growth + monetization through visible builds and reusable lab assets.

## Meta-structure

### Playlist 1 — AI Playground / The Lab

Purpose:

- prompt/agent playground
- evals
- datasets
- save/share experiments
- reusable templates

Monetization:

- subscription for save/share
- private projects
- eval history
- team spaces
- templates

### Playlist 2 — Minecraft Clone / Voxel Lab

Purpose:

- high-progress long-running build series
- voxel rendering
- terrain generation
- AI-assisted content generation
- NPCs/memory later

Monetization:

- voxel starter kit
- terrain generator presets
- procedural generation templates
- agent tooling

### Playlist 3 — Racing Game / Sim Lab

Purpose:

- high visual payoff
- physics and tuning
- AI drivers
- telemetry
- track generation

Monetization:

- racing physics kit
- telemetry dashboard
- AI driver notebooks
- tuning agent templates

## Signature episode structure

Use the same chapters across all three playlists:

```text
1. Cold open demo (0:00–0:20)
2. Goal + success criteria (0:20–1:30)
3. Architecture sketch (1:30–3:00)
4. Build in 3–5 steps (3:00–70%)
5. Break it + fix it (last 25%)
6. Perf/cost notes (2–4 min)
7. Recap + next episode teaser (30s)
8. Single CTA (10–15s)
```

On-screen labels:

```text
BUILD → TEST → BREAK → FIX → MEASURE → SHIP
```

## Four-week starter season

### Week 1 — AI Playground

Main video:

```text
Title: I Built an AI Playground That Actually Ships Features
Thumbnail text: AI PLAYGROUND ✅
Format: Build Series
Status: draft
```

Core build:

- prompt/agent runner
- tool calling
- versioned prompts / experiments
- basic eval loop
- save/share concept if available

Success criteria:

- user can run an experiment
- user can save or version the result
- user can compare at least one output/eval

Shorts:

- `Save feature in 5 seconds`
- `One-click eval loop`
- `Tool calling demo`

Membership/SaaS asset:

- starter prompt packs
- eval templates
- save/share experiments

### Week 2 — Minecraft Clone / Voxel Lab

Main video:

```text
Title: Minecraft Clone in 30 Minutes: Voxel Engine MVP
Thumbnail text: VOXELS WORK
Format: Build Series
Status: draft
```

Core build:

- voxel world rendering
- chunks
- block placement/removal
- simple terrain generation

AI connection:

- use AI Playground to generate terrain parameter presets
- use AI Playground to generate biome/block palette ideas

Success criteria:

- stable simple world renders
- player can place/remove blocks
- terrain generation is visible

Shorts:

- `Voxel world in 10 seconds`
- `AI picked the terrain rules`
- `Blocks finally work`

Membership asset:

- voxel starter kit
- terrain generator presets
- terrain tuning agent prompt/eval

### Week 3 — Racing Game / Sim Lab

Main video:

```text
Title: Racing Game MVP: Physics, Lap Timer, and Drift Feel
Thumbnail text: IT DRIFTS 🔥
Format: Build Series
Status: draft
```

Core build:

- car controller
- physics tuning
- simple track loop
- lap timer
- ghost replay if feasible

AI connection:

- use AI Playground to tune physics parameters
- use AI Playground to generate constrained track segments

Success criteria:

- car can complete a lap
- lap timer works
- handling has a clear arcade/sim target

Shorts:

- `The car finally drifts`
- `AI helped tune the handling`
- `Ghost replay in 15 seconds`

Membership asset:

- racing physics tuning dashboard template
- telemetry logger
- parameter search agent

### Week 4 — Shared AI Game Brain

Main video:

```text
Title: One AI System to Power Both Games: Tools + Memory + Evals
Thumbnail text: AI GAME BRAIN
Format: Bridge episode
Status: draft
```

Core build:

- shared agent framework
- tools: spawn object / change params / run sim / capture metrics
- memory: per-project notes + experiment history
- evals: did it improve FPS, lap time, or qualitative fun score?

Success criteria:

- one AI Playground workflow can interact with both game projects conceptually or through tool adapters
- one eval/rubric is shared across projects

Shorts:

- `One AI brain for two games`
- `Tools + memory + evals`
- `The lab remembers experiments`

Membership asset:

- Game AI Toolkit
- tool schemas
- eval templates
- memory patterns
- ready-to-run project templates

## Next episode backlog

### Minecraft / Voxel Lab

| Title | Thumbnail | Asset |
|---|---|---|
| Chunk Meshing Optimization | 10X FPS | Greedy meshing starter |
| Inventory + Crafting MVP | CRAFTING ✅ | Crafting system template |
| Mobs/NPCs Powered by an Agent | NPC HAS MEMORY | NPC memory/tool schema |
| Procedural Structures with Constraints | AI BUILT THIS | Structure generation templates |

### Racing / Sim Lab

| Title | Thumbnail | Asset |
|---|---|---|
| AI Drivers with Waypoints | AI DRIVER | AI driver notebook |
| Telemetry + Auto-Tuning Agent | AUTO TUNED | Telemetry dashboard |
| Track Generator + Difficulty Scaler | ENDLESS TRACKS | Track generation templates |
| Damage, Boosts, and Items | CHAOS MODE | Arcade mode kit |

### AI Playground / The Lab

| Title | Thumbnail | Asset |
|---|---|---|
| RAG Mode for Docs and Code | RAG INSIDE | RAG starter template |
| Eval Suite for Prompts and Agents | NO MORE BREAKING | Eval harness |
| Team Workspace + Sharing | TEAM LAB | Collaboration workflow |
| Cost Controls: Caching, Batching, Routing | COST ↓ 60% | Cost calculator |

## Content strategy note

Fastest revenue path:

> Start with AI Playground videos first, because that is what can convert to subscriptions. Then use Minecraft and Racing as the content engine demonstrating why the Playground is useful.

## Approval checklist

```text
[ ] Confirm whether AI Playground is the primary 2026 revenue focus
[ ] Confirm game tech stack: Unity / Godot / Unreal / Web / other
[ ] Confirm whether Minecraft/Racing are public product tracks or prototype-only content tracks
[ ] Approve AI Builder Lab as the monetization/content umbrella
[ ] Approve the four-week starter season
[ ] Decide whether this replaces or follows the existing 30-day calendar
```
