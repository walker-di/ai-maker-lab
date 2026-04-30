## Why

The marketing-manager app migration to ai-maker-lab completed the backend layer (services, repositories, API routes, transport interfaces) for canvas templates and scenes, but deliberately excluded the UI layer. The canvas template editor (Fabric.js-based) and scene manager (scene editing, clip management, canvas-based clip builder) have no frontend implementation in the target. Users cannot create/edit canvas templates or manage scenes despite the API being fully functional.

This change completes the frontend migration for these two critical capabilities.

## What Changes

- Add a shared Fabric.js canvas editor component to `packages/ui/src/lib/marketing/canvas/`.
- Add canvas template create and edit pages under `apps/desktop-app/src/routes/marketing/canvas-templates/`.
- Add a scene management page with clip editing under `apps/desktop-app/src/routes/marketing/scenes/`.
- Add page models, compositions, and i18n message keys following existing patterns.
- Add page model unit tests and browser component tests.
- Update the existing canvas-templates list page to include create/edit navigation.
- Enhance the existing SceneList component with canvas previews and clip counts.

## Capabilities

### New Capabilities

- Users can create canvas templates with a visual Fabric.js editor (shapes, text, images, lines).
- Users can edit existing canvas templates, modifying canvas content and metadata.
- Users can manage scenes within a story: create, edit, reorder, delete scenes.
- Users can manage clips within scenes: create, edit, reorder, delete clips.
- Canvas editor supports undo/redo, zoom/pan, and five core tools (rectangle, circle, text, image, line).
- Canvas templates generate preview images on save.

### Modified Capabilities

- Canvas templates list page gains Create and Edit actions.
- SceneList component (packages/ui) gains canvas preview thumbnails and clip count badges.
- Marketing navigation supports scene editor access.

## Impact

- Adds new Svelte components to `packages/ui/src/lib/marketing/canvas/` and `packages/ui/src/lib/marketing/stories/`.
- Adds new route pages under `apps/desktop-app/src/routes/marketing/canvas-templates/` and `apps/desktop-app/src/routes/marketing/scenes/`.
- Does NOT change existing backend services, repositories, API routes, or transport implementations.
- Does NOT change database schema or persistence layer.
- Adds Fabric.js as a client-side dependency in the UI package (already present in workspace node_modules).
- Adds paraglide i18n message keys for new UI strings.

## Out of Scope

- Advanced shape tools (16 shape tools from original — arch, pentagon, arrow, hexagon, cross, star, cloud, etc.) — deferred to a follow-up change.
- Video export UI (ExportModal) — separate concern.
- AI auto-create scenes modals — separate AI feature.
- Narration/voice UI — can be added independently.
- BGM management UI — can be added independently.
- SVG generator/editor — advanced tool, deferred.
- Backend changes — API layer is already complete.
