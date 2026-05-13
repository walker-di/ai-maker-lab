# Approval and Sync

Status: draft  
Mode: review-before-publish  
Channel: https://www.youtube.com/channel/UCpHzeNKAq7bFGE9ToFiXFaA

## Brand / claim review

Verdict:

```text
revise before publishing
```

The plan is safe as a strategy document, but public-facing drafts should avoid implying:

- the workflow is proven to grow the channel,
- YouTube metrics already exist,
- AI Maker Lab is a finished product,
- AI agents universally replace humans or full software teams,
- autonomous publishing is enabled.

## Safe claims

Use:

- “I’m experimenting with…”
- “I’m building…”
- “The current bottleneck is…”
- “The repo docs already contain video material…”
- “The goal is to reduce recording friction…”
- “This is a draft workflow I’m testing…”

Avoid:

- “This will grow the channel.”
- “This is the best AI development workflow.”
- “AI agents replace a software team.”
- “The metrics prove…” unless analytics are provided.
- “This is fully automated.”

## Approval queue

```text
[ ] Approve channel promise: "A cozy maker lab for building with AI"
[ ] Approve public brand name: "Walker AI Maker Lab"
[ ] Approve AI Builder Lab as the content/membership architecture
[ ] Approve cozy isometric maker-lab visual direction
[ ] Approve Lab Score as recurring rubric
[ ] Approve three-speed format system
[ ] Choose initial publishing path: development-sync build log OR AI Builder Lab starter season
[ ] Approve weekly build log as default cadence if using development-sync path
[ ] Approve AI Playground / Minecraft / Racing starter season if using monetization-forward path
[ ] Approve first 30-day content calendar
[ ] Approve metrics dashboard format
[ ] Provide YouTube Studio analytics export/screenshots
[ ] Confirm brand voice
[ ] Confirm approved claims
[ ] Confirm forbidden claims
[ ] Confirm primary 2026 revenue focus: AI Playground, Fortalece, Picflow, ia.walker, membership, or other
[ ] Confirm whether to create Fortalece manual campaign/content items from this packet
```

## Fortalece sync payload — manual review only

No API calls. No publishing. This is a draft payload for manual review if the user wants to track the channel direction in Fortalece later.

```yaml
fortalece_sync:
  mode: manual_review
  campaigns:
    - title: "AI Maker Lab YouTube Channel Operating System"
      description: "Approval-first content workflow for turning fast AI development work into a YouTube calendar, repeatable video formats, scripts, and metrics review. Channel: https://www.youtube.com/channel/UCpHzeNKAq7bFGE9ToFiXFaA"
      personas:
        - "AI builders"
        - "Technical founders"
        - "Developers using coding agents"
      target_platforms:
        - youtube
        - blog
        - linkedin
      status: draft

  content_items:
    - platform: youtube
      title: "My AI Development Is Faster Than My Content Process"
      content: "Build-in-public channel reset video explaining the development-to-video bottleneck and the new three-speed content system."
      status: idea
      funnel_stage: awareness
      ai_generated: true
      distribution_type: organic

    - platform: youtube
      title: "I’m Building an AI Software Team: CEO, Orchestrator, Coder, QA, Designer"
      content: "Workflow breakdown based on Sprint 003 Paperclip company docs."
      status: idea
      funnel_stage: awareness
      ai_generated: true
      distribution_type: organic

    - platform: linkedin
      title: "Turning AI development into a content calendar"
      content: "Manual-review LinkedIn post about using dev content notes to keep content synced with fast AI product development."
      status: draft
      funnel_stage: awareness
      ai_generated: true
      distribution_type: organic

  blog_posts:
    - title_en: "How I’m Turning Fast AI Development Into a YouTube Content System"
      content_en: "Draft article adapted from the YouTube operating plan: the problem, the three-speed content system, topic scorecard, weekly build-log template, and metrics dashboard."
      excerpt_en: "A practical workflow for keeping YouTube content synced with fast-moving AI product development."
      seo_title_en: "AI Development Content Calendar"
      seo_description_en: "A practical system for turning fast AI development work into YouTube videos, scripts, and a content calendar."
      seo_keywords:
        - "AI development workflow"
        - "AI coding agents"
        - "build in public"
        - "YouTube content calendar"
        - "AI product development"
      status: draft
      platform: blog
      ai_generated: true
      distribution_type: organic

    - title_en: "AI Builder Lab: A Cozy Maker System for Building With AI"
      content_en: "Draft article introducing the Walker AI Maker Lab brand direction, AI Builder Lab content architecture, Lab Score rubric, and starter season across AI Playground, Voxel Lab, and Sim Lab."
      excerpt_en: "A cozy maker-lab direction for building practical AI tools, workflows, games, and experiments in public."
      seo_title_en: "AI Builder Lab Channel Plan"
      seo_description_en: "A channel strategy for a cozy AI maker lab focused on practical builds, AI Playground, game prototypes, and reusable lab assets."
      seo_keywords:
        - "AI Builder Lab"
        - "AI Playground"
        - "AI maker lab"
        - "AI game development"
        - "creative AI workflows"
      status: draft
      platform: blog
      ai_generated: true
      distribution_type: organic

  action_requests: []
```

## Validation verdict

```text
Validation verdict: pass-with-gaps
```

Gaps:

- YouTube channel URL is now provided.
- Public RSS feed resolved channel title as `Walker AI Maker Lab`.
- Public RSS feed returned no recent video entries in this check.
- YouTube Studio analytics are still missing.
- Competitor list is still missing.
- Brand voice is inferred, not confirmed.
- Approved/forbidden claims still need user confirmation.

## Required fixes before publishing

- Confirm final channel promise.
- Confirm whether the channel is intentionally new/empty or whether public videos are hidden/unlisted.
- Provide YouTube Studio data once there are uploads or if private/unlisted analytics exist.
- Review every script for unsupported claims before recording.
