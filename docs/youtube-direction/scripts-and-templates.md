# Scripts and Templates

Status: draft  
Mode: review-before-publish

Use these templates to reduce recording friction. The default video is an **artifact-first development recap**, not a full tutorial.

## Ultra-short dev content note

Create this after every meaningful development session. Keep it under five minutes.

```markdown
# Dev Content Note

Date:
Feature / task:
Status:

## Artifact
What can I show? Link screenshot, clip, doc, diff, QA artifact, agent output, or error.

## Change
What changed in one or two sentences?

## Why it matters
Why would another builder care?

## Friction
What was confusing, broken, risky, or surprising?

## Next step
What happens next?

## Content fit
- [ ] Short
- [ ] Weekly recap segment
- [ ] Main recap
- [ ] Deep dive later
- [ ] Private note only
```

## Topic picker

Use this at the end of the week.

```markdown
# Weekly Topic Picker

Week:
Candidate notes:

| Candidate | Artifact/proof | Lesson | Effort low/med/high | Decision |
|---|---|---|---|---|
|  |  |  |  |  |

Chosen video:
Chosen because:
Deferred topics:
Shorts to cut:
```

Decision rule:

```text
Choose the useful topic with the clearest artifact and lowest recording effort.
```

## 7-line main video script

This is the default script. Fill it in, then record.

```text
Title:
Primary artifact:

1. Artifact first: Here is what I built / changed / found.
2. Goal: I was trying to [goal].
3. Context: This matters because [builder/product reason].
4. Change: The main thing that changed was [specific change].
5. Friction: The hard/confusing part was [failure/tradeoff/surprise].
6. Lesson: The useful takeaway is [lesson].
7. Next: Next I’m going to [next step].
```

## 6–12 minute recap outline

Use this only if the 7-line script needs a little more structure.

```text
00:00 Artifact first
Show the result, screenshot, diagram, QA evidence, or failure.

00:20 Goal
“I was trying to...”

01:00 Context
Why this mattered for AI Maker Lab or for other builders.

02:00 What changed
Walk through one to three concrete changes.

04:00 Proof
Show the artifact again in more detail.

06:00 Friction
Explain the failure, tradeoff, surprise, or decision.

08:00 Lesson
What another builder can reuse.

10:00 Next
What happens in the next build.
```

## Fast capture script

Use for shorts or 2–5 minute updates.

```text
I was trying to build [goal].

The artifact is [demo/screenshot/doc/error].

The interesting part was [lesson/conflict].

Here is the quick proof: [show screen/artifact].

Next I need to [next step].
```

## Weekly artifact recap script

Use for the default weekly video.

```text
Title:
Building AI Maker Lab: [artifact/result]

Hook:
This is the clearest artifact from last week’s AI Maker Lab development.

Goal:
I was trying to [goal].

What changed:
1. [Change one]
2. [Change two]
3. [Change three]

Evidence:
Here is the screen, diagram, sprint doc, QA artifact, or agent output.

Friction:
The hardest part was...

Lesson:
The useful takeaway is...

Next:
Next week I’m focusing on...
```

## Feature demo script

Use when the artifact is a working feature.

```text
Title:
I built [feature] for [reason]

Artifact first:
Here is the feature working.

Before:
Previously, I had to...

After:
Now, I can...

How it works:
The simple version is...

Tradeoff:
The tricky part was...

Next:
The next improvement is...
```

## Workflow / architecture recap script

Use when the artifact is a process, role split, diagram, or repo structure.

```text
Title:
How I designed [system/workflow]

Artifact first:
Here is the diagram / workflow / repo structure.

Problem:
The old way broke because...

Approach:
I separated the system into:
1. ...
2. ...
3. ...

Example:
Here is one real use case.

Tradeoff:
This helps with...
It does not solve...

Lesson:
The main idea another builder can reuse is...
```

## Failure / lesson script

Use when the artifact is a bug, failed workflow, rejected plan, or QA evidence.

```text
Title:
This AI workflow failed because [reason]

Artifact first:
Here is the failure / evidence.

Expectation:
I thought [assumption].

Reality:
What happened was...

Why:
The failure came from...

Fix:
I changed the workflow by...

Lesson:
The useful takeaway is...
```

## Shorts template

Create 2–3 shorts from each main recap.

```text
Short title:
Source timestamp/artifact:

0–1s: Show result/failure first.
1–6s: “I was trying to...”
6–12s: Show proof.
12–20s: “The lesson is...” or “Next I’m testing...”
```

## Video 1 draft — channel reset

Status: draft  
Channel: YouTube  
Title: `My AI Development Is Faster Than My Content Process`

```text
Artifact first:
Here is the new YouTube direction folder I’m using to fix my content bottleneck.

Goal:
My AI development workflow has become faster than my ability to record it.

Context:
I’m developing the AI Maker Lab concept, and the work now moves through agents, sprint docs, architecture decisions, QA evidence, and product experiments.

Problem:
The old content process does not work anymore. By the time I choose a topic and prepare a tutorial, the system has already changed.

New system:
I’m switching to a one-week-lag format:
1. capture proof during development,
2. record the clearest artifact from the previous week,
3. turn the recap into shorts,
4. only make deep dives after a topic proves useful.

Lesson:
The content system has to follow development without pretending the concept is a finished product or trying to keep up with every single change live.

Close:
The goal is simple: make the channel follow the development instead of competing with it.
```

## LinkedIn manual-export draft

Status: draft  
Channel: LinkedIn  
Publish mode: manual review only

```text
My AI development workflow has started moving faster than my content workflow.

That sounds like a good problem, but it creates a real bottleneck:

- too many possible topics
- features changing before I record them
- tutorials becoming outdated
- no consistent way to choose what deserves a video

So I’m changing the system.

Instead of trying to record everything live, I’m going to record one development cycle behind.

During development I’ll only capture proof:

- screenshots
- short clips
- QA artifacts
- agent outputs
- notes about what broke or changed

Then each week I’ll choose the clearest artifact from the previous week and turn it into one simple recap video plus a few shorts.

AI Maker Lab is still in development, so the focus is on ideas, prototypes, workflows, and lessons. Sometimes I’ll use real products like ia-walker, Picflow, Fortalece.ai, or IDentifQ as concrete examples.

The goal is to make content follow the actual product development rhythm — not slow it down.
```

## Blog draft outline

Status: draft  
Channel: blog  
Title: `How I’m Turning Fast AI Development Into a YouTube Content System`

```markdown
# How I’m Turning Fast AI Development Into a YouTube Content System

## The problem

AI development can move faster than recording, editing, and publishing.

## Why normal tutorials are too slow

Tutorials require stable topics, polished demos, and context rebuilding. Fast AI development produces changing systems, messy decisions, and frequent workflow changes.

## The new rule: record one week behind

Instead of recording everything live, the channel records from the previous week’s clearest artifact. AI Maker Lab should be framed as an in-development concept/workspace, while real products such as ia-walker, Picflow, Fortalece.ai, and IDentifQ can appear as case studies when relevant.

## The artifact-first recap

Each video starts with the proof: demo, screenshot, diagram, QA evidence, agent output, or failure.

## The dev content note

Every meaningful development session produces a small note with the artifact, change, reason, friction, and next step.

## The topic picker

Topics are chosen by visible proof, useful lesson, and low recording effort.

## What I’ll measure

Metrics include YouTube Studio performance and development-sync metrics like recording lag and content-note conversion rate.

## Next step

Start with the first artifact-first recap and let the metrics decide which topics deserve deeper videos.
```
