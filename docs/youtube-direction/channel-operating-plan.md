# Channel Operating Plan

Status: draft  
Mode: review-before-publish

## Channel promise

Primary brand promise:

> A cozy maker lab for building with AI.

Practical content promise:

> Sharing AI development ideas, concept products, and real product build lessons in public.

Longer version:

> Walker AI Maker Lab is a cozy space for building with AI: development ideas, concept products, creator workflows, automation experiments, agent systems, and occasional lessons from real products such as ia-walker, Picflow, Fortalece.ai, and IDentifQ.

## Core problem

AI development is moving faster than video recording. That creates a content bottleneck:

- Too many possible topics.
- Features change before they are recorded.
- Tutorial ideas become stale quickly.
- Recording requires too much context rebuilding.
- Long-form content competes with development time.

The solution is not to record more. The solution is to record **later, simpler, and from proof**.

## Operating principle

> Capture during development. Record after development settles.

The channel should follow development, but with a deliberate buffer. Every meaningful development session creates a small note and raw proof. The weekly video is recorded from the clearest artifact from the previous week, not from the current unfinished work.

## Default format: artifact-first development recap

Use this as the default long-form format until production becomes easy.

```text
Artifact-first development recap
Length: 6–12 minutes
Prep: one artifact, one note, one short script
Recording style: screen share + voiceover, optional face cam
```

The video does **not** need to be a full tutorial or live build. It answers five questions:

1. What can the viewer see first?
2. What changed?
3. Why did it matter?
4. What broke or was confusing?
5. What comes next?

Default structure:

```text
00:00 Show the artifact/result first
00:20 State the development goal
01:00 Explain what changed
03:00 Show the workflow, code, diagram, or agent output
06:00 Explain the failure, tradeoff, or surprise
08:00 Share the useful lesson
10:00 Say what happens next
```

If a topic cannot produce a visible artifact, it should usually become a short note, LinkedIn post, or private backlog item — not the main video.

## Topic selection rules

Choose topics from **proof**, not from ideas.

A topic is eligible for the weekly main video only if it has at least two of these:

- a working screen or demo;
- a before/after comparison;
- a diagram or architecture sketch;
- a QA artifact, test result, or screenshot;
- an agent transcript/output that changed the work;
- a failure/error that teaches something;
- a product decision that affects the next build.

### Weekly selection rule

At the end of each week:

1. Look only at the previous week’s dev notes.
2. Pick the clearest artifact, not the newest feature.
3. If two topics tie, choose the one with lower recording effort.
4. If no topic has enough proof, record a short `what changed this week` recap instead of forcing a main video.

### Topic scorecard

Score each candidate from 1–5.

| Criterion | Question |
|---|---|
| Development relevance | Did this happen in the latest completed build cycle? |
| Visual proof | Can I show a screen, diagram, diff, QA artifact, or agent output? |
| Viewer value | Will another builder learn something useful? |
| Story tension | Is there a failure, decision, tradeoff, or surprise? |
| Search/discovery potential | Would someone search for this topic? |
| Recording effort | Can I record it without heavy prep? |

Decision rule:

| Score | Action |
|---:|---|
| 24–30 | Main video or evergreen deep dive |
| 18–23 | Weekly recap segment |
| 12–17 | Short / quick update |
| <12 | Keep as private note |

Important rule:

> High relevance does not beat low clarity. If it is hard to explain, wait one week and let the topic settle.

## Audience

Primary audience:

- AI builders and indie hackers exploring AI product ideas, prototypes, and real shipping lessons.
- Developers using coding agents but struggling with orchestration and verification.
- Technical founders building AI-assisted product workflows.
- Svelte/SvelteKit/Bun developers interested in AI product architecture.

Audience pains:

- They can generate code faster than they can verify it.
- They do not know how to structure multi-agent development work.
- They want practical examples, not only AI hype.
- They want to see product concepts, real-product lessons, QA, architecture, and tradeoffs.

## Content pillars

### 1. Lab Builds

Demo-first builds that produce concept products, useful prototypes, templates, or experiments. Some episodes may reference real products, but the default assumption is that AI Maker Lab itself is in development.

Examples:

- `Designing an AI Playground That Could Become a Product`
- `Minecraft Clone in 30 Minutes: Voxel Engine MVP`
- `Racing Game MVP: Physics, Lap Timer, and Drift Feel`

### 2. AI Development Workflows

Multi-agent coding workflows, coding harnesses, verification loops, and agent workflow mistakes.

Examples:

- `Why One AI Agent Is Not Enough`
- `The QA Loop My AI Coding Agents Needed`
- `How I Keep AI Development From Outrunning Verification`

### 3. Building AI Products

AI Maker Lab concept evolution, feature prototypes, MVP decisions, product experiments, and lessons from real products when relevant.

Examples:

- `Building the AI Maker Lab Concept: Week 1`
- `What Actually Changed After Adding AI Agents to My Development Process`
- `What Picflow/Fortalece/ia-walker Taught Me About AI Product Work`

### 4. Agent Company / Paperclip Workflow

CEO / Orchestrator / Coder / QA / Designer roles, ticket loops, QA evidence, governance, and design review.

Examples:

- `I’m Building an AI Software Team: CEO, Orchestrator, Coder, QA, Designer`
- `My AI Coding Agent Now Has a QA Department`

### 5. Architecture and Clean Product Engineering

SvelteKit app shell, shared UI package, shared domain package, app adapters, SurrealDB workflows, and avoiding messy AI demo architecture.

Examples:

- `The Architecture Behind AI Maker Lab`
- `Why My Frontend Does Not Call APIs Directly`

### 6. AI News → Actions

News only when it produces a practical test for builders.

Examples:

- `What AI Builders Should Test This Week`
- `AI News → 3 Experiments Worth Running`

### 7. Paper → Product

Research or model releases turned into practical product implications.

### 8. Product Reviews / Lab Benchmarks

Trust-sensitive reviews using a fixed engineering rubric.

### 9. Content / Marketing Automation

AI CMO workflows, turning development into content calendars, launch notes, scripts, and blog/LinkedIn drafts.

## Signature mechanic — Lab Score

At the end of builds, reviews, news items, or product decisions, score the idea with:

| Dimension | Meaning |
|---|---|
| Value | Who benefits and how much |
| Effort | How hard it is to build/use |
| Risk | Failure modes, lock-in, reliability, compliance |
| Cost | API/GPU/tool/runtime cost |
| Time-to-ship | How quickly a builder can apply it |

Use Lab Score as a recurring close, not as a complicated production requirement.

## Three-speed video system

### Speed 1 — Fast Capture

Use during development.

Format:

- screenshot;
- 30–90 second screen recording;
- quick voice note;
- dev content note.

Purpose:

- Preserve proof before context disappears.
- Avoid rebuilding the story from memory.
- Create raw material for the weekly recap.

### Speed 2 — Weekly Artifact Recap

This is the default channel backbone.

Format:

- 6–12 minutes;
- one per week if possible;
- recorded from the previous week’s best artifact;
- screen share + voiceover.

Purpose:

- Keep publishing synced with development without recording every dev session.
- Avoid needing one perfect tutorial topic every week.
- Show real progress, failures, and decisions.

### Speed 3 — Evergreen Deep Dive

Use only after a topic proves valuable through weekly videos, comments, analytics, or repeated usefulness.

Format:

- 15–30 minutes;
- one or two per month at most;
- polished title/thumbnail/script.

Purpose:

- Turn proven weekly themes into searchable evergreen videos.
- Capture high-value architecture/workflow lessons.

## Production workflow

### During development

Capture proof, not polish:

- screenshots;
- 15–90 second clips;
- agent outputs;
- sprint docs;
- diagrams;
- before/after states;
- failure messages;
- QA artifacts.

### After each development session

Create one short dev content note using [scripts-and-templates.md](./scripts-and-templates.md).

### End of week

1. Review the previous week’s dev content notes.
2. Score candidate topics.
3. Pick one artifact-first recap.
4. Record the short script in one sitting.
5. Extract 2–3 shorts from the strongest proof clips.
6. Save deeper tutorial ideas only after the weekly recap proves the topic.

## Brand safety

Use safe claims:

- “I’m experimenting with…”
- “I’m developing the AI Maker Lab concept…”
- “This is a prototype / concept product…”
- “This lesson came from a real product such as ia-walker, Picflow, Fortalece.ai, or IDentifQ…” when true.
- “The current bottleneck is…”
- “This is what worked in this build…”
- “The goal is to reduce recording friction…”

Avoid unsafe claims:

- “This will grow the channel.”
- “This is the best AI development workflow.”
- “AI agents replace a software team.”
- “The metrics prove…” unless analytics are provided.
- “AI Maker Lab is a finished product.”
