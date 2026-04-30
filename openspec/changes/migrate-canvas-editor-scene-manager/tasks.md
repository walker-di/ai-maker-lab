## Implementation Tasks

### 1. Canvas editor core component (packages/ui)

- [ ] 1.1 Create `packages/ui/src/lib/marketing/canvas/canvas-service.svelte.ts` with Svelte 5 runes-based Fabric.js canvas state management (init, destroy, resize, activeObject, tool state, toJSON, loadFromJSON, toDataURL).
- [ ] 1.2 Create `packages/ui/src/lib/marketing/canvas/canvas-history.svelte.ts` implementing undo/redo with circular JSON snapshot buffer.
- [ ] 1.3 Create `packages/ui/src/lib/marketing/canvas/canvas-zoom-pan.svelte.ts` for wheel-to-zoom, space+drag pan, and zoom level state.
- [ ] 1.4 Create `packages/ui/src/lib/marketing/canvas/tools/add-rectangle.ts`, `add-circle.ts`, `add-text.ts`, `add-image.ts`, `add-line.ts` as Fabric object factory functions.
- [ ] 1.5 Create `packages/ui/src/lib/marketing/canvas/CanvasEditor.svelte` wrapping Fabric.js canvas with props for canvasData, width, height, aspectRatio, readonly, and onCanvasChange callback.
- [ ] 1.6 Create `packages/ui/src/lib/marketing/canvas/CanvasToolbar.svelte` with tool selection (select, rectangle, circle, text, image, line) and action buttons (delete, clear, undo, redo, zoom).
- [ ] 1.7 Create `packages/ui/src/lib/marketing/canvas/CanvasPreview.svelte` for read-only thumbnail rendering of canvas JSON data.
- [ ] 1.8 Create `packages/ui/src/lib/marketing/canvas/index.ts` exporting all canvas components and update `packages/ui/src/lib/marketing/index.ts`.

### 2. Canvas template pages (apps/desktop-app)

- [ ] 2.1 Create `apps/desktop-app/src/routes/marketing/canvas-templates/canvas-templates-page.svelte.ts` page model with list, delete, duplicate methods using MarketingCatalogTransport.
- [ ] 2.2 Create `apps/desktop-app/src/routes/marketing/canvas-templates/canvas-templates-page.composition.ts`.
- [ ] 2.3 Refactor existing `+page.svelte` to use page model and add "Create New" / "Edit" navigation actions.
- [ ] 2.4 Create `apps/desktop-app/src/routes/marketing/canvas-templates/new/+page.svelte` with canvas editor, metadata form (name, description, aspectRatio), and save action.
- [ ] 2.5 Create `apps/desktop-app/src/routes/marketing/canvas-templates/new/canvas-template-new-page.svelte.ts` page model.
- [ ] 2.6 Create `apps/desktop-app/src/routes/marketing/canvas-templates/[id]/+page.svelte` for edit with pre-loaded canvas data and metadata.
- [ ] 2.7 Create `apps/desktop-app/src/routes/marketing/canvas-templates/[id]/canvas-template-edit-page.svelte.ts` page model.
- [ ] 2.8 Create `apps/desktop-app/src/routes/marketing/canvas-templates/[id]/canvas-template-edit-page.composition.ts`.
- [ ] 2.9 Add paraglide i18n message keys for canvas template create/edit UI strings.

### 3. Scene manager pages (apps/desktop-app)

- [ ] 3.1 Create `apps/desktop-app/src/routes/marketing/scenes/[storyId]/+page.svelte` as the main scene editor page composing SceneList + CanvasEditor + ClipList.
- [ ] 3.2 Create `apps/desktop-app/src/routes/marketing/scenes/scene-editor-page.svelte.ts` page model with scene CRUD, clip CRUD, scene selection, and reordering.
- [ ] 3.3 Create `apps/desktop-app/src/routes/marketing/scenes/scene-editor-page.composition.ts`.
- [ ] 3.4 Enhance `packages/ui/src/lib/marketing/stories/SceneList.svelte` with canvas thumbnail preview, add-scene button, and clip count badge.
- [ ] 3.5 Create `packages/ui/src/lib/marketing/stories/SceneForm.svelte` for scene create/edit with description, duration, and template selection.
- [ ] 3.6 Create `packages/ui/src/lib/marketing/stories/ClipList.svelte` for clip management with type badges, thumbnails, duration, drag-reorder, add/edit/delete.
- [ ] 3.7 Create `packages/ui/src/lib/marketing/stories/ClipForm.svelte` for clip create/edit with type, content, narration text, duration fields.
- [ ] 3.8 Update `packages/ui/src/lib/marketing/stories/index.ts` to export new components.
- [ ] 3.9 Add paraglide i18n message keys for scene/clip management UI strings.

### 4. Backend verification and minimal additions

- [ ] 4.1 Verify `SurrealSceneRepository.findByStoryId()` returns scenes ordered by `orderIndex`; add ORDER BY if missing.
- [ ] 4.2 Verify `SurrealClipRepository.findBySceneId()` returns clips ordered by `orderIndex`; add ORDER BY if missing.
- [ ] 4.3 If canvas template preview upload needs base64 handling, add a helper to convert base64 to Buffer in the existing upload route or add `apps/desktop-app/src/routes/api/marketing/upload/template-preview/+server.ts`.

### 5. Tests

- [ ] 5.1 Create `apps/desktop-app/src/routes/marketing/canvas-templates/canvas-templates-page.test.ts` testing list, delete, duplicate with mock transport.
- [ ] 5.2 Create `apps/desktop-app/src/routes/marketing/canvas-templates/new/canvas-template-new-page.test.ts` testing save with correct DTO and validation.
- [ ] 5.3 Create `apps/desktop-app/src/routes/marketing/canvas-templates/[id]/canvas-template-edit-page.test.ts` testing load and update.
- [ ] 5.4 Create `apps/desktop-app/src/routes/marketing/scenes/scene-editor-page.test.ts` testing scene/clip CRUD and reordering.
- [ ] 5.5 Create `packages/ui/src/lib/marketing/canvas/__tests__/canvas-editor.browser.test.ts` testing canvas renders, toolbar interactions, and basic object CRUD.
- [ ] 5.6 Run `bun run check:desktop-app` to verify type checking passes.
- [ ] 5.7 Run `cd apps/desktop-app && bun run test:unit` to verify page model tests pass.
- [ ] 5.8 Run `cd packages/ui && bun test` to verify component tests pass.
- [ ] 5.9 Browser verify canvas template create/edit flow and scene management manually.
