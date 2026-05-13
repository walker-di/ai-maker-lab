# Production System

Status: draft  
Mode: review-before-publish  
Source considered: `docs/concept.md`

## Production principle

The production system should reduce recording burden, not create another project.

Use this rule:

> Capture proof while building. Record the explanation later.

The default video is an **artifact-first development recap** recorded from the previous week’s clearest artifact.

## Minimal assembly line

```text
Dev note → Artifact selection → 7-line script → Screen-share recording → Light edit → Draft package → Review
```

Do not start with a full script. Do not attempt to record every build live. Do not turn every feature into a tutorial.

## Default weekly video format

```text
Format: artifact-first development recap
Length: 6–12 minutes
Recording: screen share + mic, optional face cam
Required asset: one visible artifact
Optional assets: diagram, test output, agent output, failure screenshot
```

A visible artifact can be:

- working UI;
- code diff;
- architecture diagram;
- sprint doc;
- agent transcript;
- QA screenshot/video;
- terminal output;
- failed attempt that teaches something.

## Non-negotiables for main videos

Every main video should include:

- artifact/result in the first 20 seconds;
- one clear development goal;
- one useful lesson for other builders;
- one failure, tradeoff, or surprise;
- one next step;
- one CTA only.

Nice to have, but not required every week:

- architecture diagram;
- chapters;
- polished thumbnail;
- multiple camera angles;
- full tutorial explanation.

## Weekly schedule

| Day | Task | Output |
|---|---|---|
| Monday | Select last week’s best artifact. | Topic chosen. |
| Tuesday | Write 7-line script and gather proof clips. | Script skeleton. |
| Wednesday | Record one screen-share recap. | Raw recording. |
| Thursday | Light edit. | Review draft. |
| Friday | Package title, thumbnail text, description, shorts. | Approval-ready draft. |

If busy, use the emergency version:

```text
30 min: choose artifact + write script
45 min: record screen-share recap
45 min: cut obvious pauses + export draft
```

## Pre-production checklist

```text
[ ] Choose one artifact from last week, not current unfinished work
[ ] Confirm the artifact is safe to show
[ ] Write the 7-line script
[ ] Open the artifact/demo before recording
[ ] Prepare one backup visual: doc, diagram, test, or screenshot
[ ] Decide the single CTA
[ ] Draft title and thumbnail text after recording, not before
```

## Recording method

### 1. Capture during development

During normal development, only capture proof:

- 15–90 second screen clips;
- screenshots;
- errors;
- passing tests;
- QA evidence;
- agent outputs;
- diagrams;
- before/after screens.

Do not try to narrate perfectly during development.

### 2. Record the recap later

After the work settles, record one clean pass:

```text
1. Show the artifact.
2. Explain the original goal.
3. Show what changed.
4. Explain the hard part.
5. Show the evidence.
6. Share the lesson.
7. Say what happens next.
```

If you make a mistake, pause and restart the sentence. Do not restart the whole recording.

### 3. Optional pickup clips

Only capture extra clips if the main recap feels unclear:

- final demo;
- before/after comparison;
- one failure mode;
- one diagram;
- one metric/evidence clip.

## OBS scene setup

Minimal scenes:

| Scene | Use |
|---|---|
| DEMO | Cold open demo: screen/game capture + mic + optional small face cam |
| BUILD | Coding/building screen + mic + optional face cam |
| SCREEN ONLY | Clean code, docs, terminal, or app recording |
| DIAGRAM | Excalidraw/Figma/draw.io capture |
| OUTRO | Static CTA or next episode screen |

Safe recording defaults:

- record to MKV, remux to MP4;
- 1440p or 1080p;
- 60fps for games, 30fps for talk-heavy videos;
- separate audio tracks for mic and desktop when possible.

Mic filter chain:

```text
Noise suppression → Noise gate → Compressor → Limiter
```

## Editing workflow

### Pass 1 — Make it understandable

Goal: remove friction, not create a perfect video.

```text
[ ] Move artifact/result to the opening
[ ] Remove long pauses and waits
[ ] Cut repeated explanations
[ ] Keep the clearest failure/tradeoff
[ ] Keep one proof moment visible
[ ] End with next step
```

### Pass 2 — Add lightweight clarity

```text
[ ] Add 3–5 text labels: GOAL / ARTIFACT / PROBLEM / LESSON / NEXT
[ ] Zoom on critical code or UI moments
[ ] Add one diagram only if needed
[ ] Check audio levels
[ ] Add chapters if the video is longer than 8 minutes
```

Avoid heavy edits until the format is sustainable.

## Thumbnail spec

Rules:

- 1280×720;
- 3–5 words max;
- one strong artifact image;
- one badge: `BUILD`, `RECAP`, `QA`, `LAB`, or `AGENTS`;
- one result token if useful: `✅`, `Risk↓`, `Time↓`, `QA`, `Ship?`.

Thumbnail layout:

```text
[badge top-left]     [short text]

        [main artifact / screen / diagram]

[result token bottom-right]
```

## Metadata template

### Description

```markdown
In this Walker AI Maker Lab recap, I show [artifact/result] from building [thing].

We cover:
- the development goal
- what changed
- what broke or was confusing
- the useful lesson
- what I’m building next

Links:
- Repo/template:
- Lab notes:
- Related video:

Disclosure:
No sponsor unless explicitly stated. Any affiliate links will be marked.
```

### Pinned comment

```markdown
Resources from the episode:

- Artifact / repo / notes:
- Diagram:
- Follow-up issue / next build:

Question: what should I test or build next?
```

### Chapters

```text
00:00 Artifact first
00:20 Goal
01:00 What changed
03:00 How it works
06:00 What broke / tradeoff
08:00 Lesson
10:00 Next step
```

## Shorts structure

Create shorts from proof clips, not from new scripts.

```text
0–1s: Result or failure first
1–6s: What I was trying to do
6–12s: Proof clip
12–20s: Lesson or next hook
```

Examples:

- `AI dev is faster than recording.`
- `This QA artifact caught the issue.`
- `My agent workflow now has a QA role.`
- `I record one week behind development now.`
- `Choose YouTube topics from proof, not ideas.`

## Quality control before review

```text
[ ] Artifact appears in first 20 seconds
[ ] Viewer understands the goal by 1:00
[ ] The video has one main idea
[ ] A failure, tradeoff, or surprise is included
[ ] The lesson is useful to another builder
[ ] Audio is clear enough
[ ] Thumbnail text is 3–5 words
[ ] Description has links/placeholders
[ ] Only one CTA is used
[ ] Draft is marked for review-before-publish
```
