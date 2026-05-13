# AI CMO Intake — YouTube Channel Direction

Status: draft  
Mode: review-before-publish  
Date: 2026-05-13

> This run has incomplete intake. Recommendations are qualitative and should not be treated as verified YouTube analytics, market, or channel findings until channel data is provided.

## Intake YAML

```yaml
ai_cmo_intake:
  run_name: "AI Maker Lab YouTube channel operating plan"
  date: "2026-05-13"
  requester: "Walker"

  product:
    name: "AI Maker Lab"
    website_url: "https://www.youtube.com/channel/UCpHzeNKAq7bFGE9ToFiXFaA"
    one_sentence_description: "A Bun/SvelteKit monorepo and lab for building AI-assisted product workflows, agent orchestration, marketing/storyboard tools, and experiments."
    longer_description: "AI Maker Lab is a development workspace for building AI product experiments with clean architecture, shared UI/domain packages, SvelteKit, SurrealDB, AI agent workflows, QA evidence, and product-oriented development loops."
    current_positioning: "Cozy build-in-public AI maker lab focused on practical tools, creator workflows, AI experiments, agent workflows, games/prototypes, and useful software creation."
    key_features:
      - "Bun workspace monorepo"
      - "SvelteKit desktop/web app shell"
      - "Shared UI package"
      - "Shared domain/application/infrastructure package"
      - "AI agent orchestration experiments"
      - "AI Playground / Lab concept for prompts, agents, evals, and save/share experiments"
      - "Game/prototype content tracks such as Minecraft clone / Voxel Lab and Racing / Sim Lab"
      - "Storyboard/video/content tooling"
      - "Paperclip company / multi-agent sprint workflow docs"
      - "QA evidence workflow with Playwright, screenshots, and optional videos"
    user_facing_changes_to_promote:
      - "Sprint 003 Paperclip company workflow"
      - "AI agent company structure: CEO, Orchestrator, Coder, QA, Designer"
      - "Experiment redo workflow"
      - "AI development-to-content workflow"
      - "AI Playground / AI Builder Lab starter season"
      - "Cozy maker-lab brand direction"

  audience:
    icp_personas:
      - "AI builders and indie hackers trying to ship real products with AI agents"
      - "Developers using coding agents but struggling with orchestration and verification"
      - "Technical founders building AI-assisted product workflows"
      - "Svelte/SvelteKit/Bun developers interested in AI product architecture"
    target_segments:
      - "AI software builders"
      - "Agent workflow practitioners"
      - "Build-in-public founders"
      - "Creative technologists and makers"
      - "Game/prototype builders interested in AI-assisted workflows"
      - "Developer-content audience"
    target_regions: [] # missing
    target_languages:
      - en
    buyer_pains:
      - "AI development moves faster than documentation and recording"
      - "Hard to choose which development topic deserves a video"
      - "Hard to turn messy implementation work into clear scripts"
      - "Agent workflows are powerful but hard to explain concisely"
      - "Recording long tutorials lags behind actual development progress"
    desired_outcomes:
      - "A repeatable video format synced with development"
      - "A reliable weekly content calendar"
      - "A topic selection system"
      - "Metrics that show which themes deserve deeper videos"
      - "Scripts that reduce recording friction"

  market:
    competitors: [] # missing
    alternatives:
      - "Ad-hoc build-in-public updates"
      - "Long tutorial-only YouTube strategy"
      - "Twitter/X-only development updates"
      - "Blog-only engineering notes"
    differentiators:
      - "Real AI product development, not only demos"
      - "Cozy creative maker-lab identity instead of generic AI hype branding"
      - "Agent workflow + QA evidence focus"
      - "Visible build tracks: AI Playground, voxel/Minecraft-style prototypes, racing/simulation prototypes"
      - "Shows both product and engineering process"
      - "Can turn sprint docs and development artifacts into video structure"
    category_terms:
      - "AI agents"
      - "AI coding workflow"
      - "build in public"
      - "AI product development"
      - "SvelteKit AI app"
      - "software agent orchestration"
      - "AI development workflow"
      - "agentic software engineering"
      - "AI Builder Lab"
      - "AI Playground"
      - "AI game development"
      - "AI tools for creators"
      - "creative AI workflows"

  brand_safety:
    brand_voice: "Technical, candid, practical, experimental, build-in-public, evidence-first, cozy, creative, calm, and slightly playful."
    approved_claims:
      - "AI Maker Lab is a Bun workspace monorepo."
      - "The repo uses SvelteKit, shared UI, and shared domain packages."
      - "Sprint 003 documents a Paperclip company workflow with CEO, Orchestrator, Coder, QA, and Designer roles."
      - "The docs include a suggested recording order and video material checklist."
      - "Current difficulty: AI development is faster than recording/content production."
      - "The intended channel vibe is a cozy maker lab for building with AI."
      - "AI Builder Lab can be used as the content/membership architecture under the Walker AI Maker Lab brand."
    forbidden_claims:
      - "Do not claim current YouTube growth, revenue, CTR, retention, or subscriber performance without analytics exports."
      - "Do not claim the workflow is proven to grow a YouTube channel yet."
      - "Do not imply autonomous publishing."
      - "Do not imply analytics, GSC, or YouTube API integrations are connected unless provided."
      - "Do not present synthetic topic scores as real audience demand."
    required_disclaimers:
      - "Metrics are templates until YouTube Studio data is provided."
      - "All outputs are review-before-publish drafts."
    sensitive_topics:
      - "Overclaiming AI productivity"
      - "Unverified revenue/growth claims"
      - "Misrepresenting development experiments as finished products"
      - "Over-commercializing product mentions before trust is built"

  channels:
    allowed_channels:
      - youtube
      - blog
      - linkedin
      - seo_geo
    disallowed_channels:
      - "auto-posting"
      - "live community posting without approval"
    channel_notes:
      youtube: "Primary focus for this run."
      blog: "Useful for repurposing scripts into posts."
      linkedin: "Manual draft/export only."
      x_twitter: "Manual draft/export only unless explicitly approved."
      reddit: "Manual draft/export only; only after real thread review."
      hn: "Manual draft/export only; only after real thread review."

  publish_policy:
    mode: review-before-publish
    auto_publish_allowed: false
    approvers:
      - "Walker"
    approval_notes: "No live posting or API publishing in this run."

  fortalece_context:
    app_path: "/Users/walker/Documents/Dev/pic-pay/apps/fortalece-ai-web"
    project_scope: "not selected"
    existing_campaign_ids: []
    existing_content_item_ids: []
    existing_blog_post_ids: []
    desired_sync_mode: manual_review

  evidence_sources:
    product_docs:
      - "/Users/walker/Documents/Dev/AI Maker Lab/ai-maker-lab/README.md"
      - "/Users/walker/Documents/Dev/AI Maker Lab/ai-maker-lab/docs/sprint/003/README.md"
      - "/Users/walker/Documents/Dev/AI Maker Lab/ai-maker-lab/docs/sprint/003/plans/01-tooling-comparison.md"
      - "/Users/walker/Documents/Dev/AI Maker Lab/ai-maker-lab/docs/sprint/003/plans/04-qa-agent.md"
      - "/Users/walker/Documents/Dev/AI Maker Lab/ai-maker-lab/docs/sprint/003/plans/06-experiment-redo-workflow.md"
    website_notes: "Public YouTube channel supplied by user: https://www.youtube.com/channel/UCpHzeNKAq7bFGE9ToFiXFaA. Public RSS feed resolved channel title as Walker AI Maker Lab and channel id as pHzeNKAq7bFGE9ToFiXFaA on 2026-05-13. RSS feed returned no recent public video entries in this check."
    analytics_exports: []
    search_console_exports: []
    community_links: []
    screenshots: []
    api_responses: []

  requested_outputs:
    weekly_review: true
    seo_geo_audit: false
    community_scan: false
    draft_pack: true
    approval_queue: true
    fortalece_sync_yaml: true
```

## Evidence inventory

| Evidence | Source |
|---|---|
| `ai-maker-lab` is a Bun workspace monorepo with desktop app, shared UI, and shared domain packages. | `README.md` |
| The project uses SvelteKit, shared UI, browser-safe domain imports, application and infrastructure boundaries. | `README.md`, `AGENTS.md` |
| Sprint 003 is explicitly a video pack. | `docs/sprint/003/README.md` |
| Sprint 003 defines a five-role Paperclip company: CEO → Orchestrator → Coder / QA / Designer. | `docs/sprint/003/README.md` |
| Sprint 003 includes suggested on-camera chapters. | `docs/sprint/003/README.md` |
| Sprint 003 states there is enough material for a video: six plans, refs, visuals, and a narrator script spine. | `docs/sprint/003/README.md` |
| The Paperclip workflow includes agent orchestration, tickets, budgets, QA evidence, and design sign-off. | `docs/sprint/003/plans/*.md` |
| QA evidence includes Playwright, screenshots, optional short video, and vision review. | `docs/sprint/003/plans/04-qa-agent.md` |
| The current bottleneck is selecting video themes/topics and keeping video creation synced with development. | User request |
| The channel concept should include AI Builder Lab positioning, content pillars aligned to monetization, AI Playground, Minecraft clone / Voxel Lab, Racing / Sim Lab, Lab Score, production workflow, and cozy maker-lab brand direction. | `docs/concept.md` |
| Public YouTube channel URL is available. | User-provided URL: `https://www.youtube.com/channel/UCpHzeNKAq7bFGE9ToFiXFaA` |
| Public RSS feed resolved title as `Walker AI Maker Lab` and channel id as `pHzeNKAq7bFGE9ToFiXFaA`. | `https://www.youtube.com/feeds/videos.xml?channel_id=UCpHzeNKAq7bFGE9ToFiXFaA`, checked 2026-05-13 |
| RSS feed returned no recent public video entries during this check. | Same RSS feed check, 2026-05-13 |

## Missing evidence

- YouTube Studio analytics.
- Current subscriber count.
- Current upload list and top videos from YouTube Studio. Public RSS returned no recent entries in this check.
- Audience geography/language data.
- Search terms.
- Competitor/channel references.
- Confirmed brand voice.
- Confirmed approved/forbidden claims.

## CMO diagnosis

The content problem is a throughput mismatch:

```text
AI development speed > recording speed > editing speed > publishing speed
```

Therefore, a normal tutorial-only strategy is likely too slow. The channel needs a development-to-video pipeline where every meaningful development session creates potential video material, and weekly videos are assembled from recent evidence instead of invented from scratch.
