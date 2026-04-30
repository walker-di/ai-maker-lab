## Architecture

This change adds only frontend/UI layer code. The backend is already complete.

### Layer Boundaries

```
packages/ui/src/lib/marketing/canvas/     ← NEW: Shared canvas editor components
packages/ui/src/lib/marketing/stories/    ← ENHANCED: Scene/clip management components
apps/desktop-app/src/routes/marketing/    ← NEW: Canvas template + scene editor pages
apps/desktop-app/src/lib/adapters/marketing/ ← EXISTING: Transport (no changes)
packages/domain/src/                      ← EXISTING: Backend (minimal verification)
```

### Component Architecture

```
CanvasEditor.svelte
├── canvas-service.svelte.ts (Fabric.js lifecycle & state)
├── canvas-history.svelte.ts (undo/redo)
├── canvas-zoom-pan.svelte.ts (zoom & pan)
├── CanvasToolbar.svelte (tool/action buttons)
└── tools/
    ├── add-rectangle.ts
    ├── add-circle.ts
    ├── add-text.ts
    ├── add-image.ts
    └── add-line.ts
```

### Page Model Pattern

Each page follows the established pattern:

```
+page.svelte          → Imports composition, renders UI components
*.svelte.ts           → Page model (runes state + methods, depends on transport)
*.composition.ts      → Creates transport + model, calls loadInitial()
*.test.ts             → Unit tests with mock transport
```

### Data Flow

```
User action → Page Model method → MarketingCatalogTransport
  → HTTP fetch → API route → Service → Repository → SurrealDB
  ← JSON response ← Transport ← Page Model state update ← UI re-render
```

Canvas data flows:

```
Fabric.js canvas → canvas.toJSON() → CanvasEditor.onCanvasChange(json)
  → Page Model.canvasJson state → save() → transport.createCanvasTemplate({ canvasData: json })
```

### Key Design Decisions

1. **Canvas editor lives in packages/ui** (not app-local) because it will be reused by both canvas template pages and the scene editor.

2. **Fabric.js v7 direct usage** — no wrapper library. The canvas-service encapsulates all Fabric API calls so components never import from `fabric` directly.

3. **Minimal tool set first** — 5 core tools (rectangle, circle, text, image, line) covers 80% of use cases. The 16 shape tools from the original are deferred.

4. **Scene editor is a single-page editor** (not multi-route like the original) — the scene list, selected scene's canvas, and clip list all live on one page for better UX.

5. **No canvas SSR** — Fabric.js requires DOM. Components use `onMount` for canvas initialization and `browser` checks where needed.

6. **Preview generation** — Canvas `toDataURL()` generates a PNG data URL client-side, which is uploaded as a preview image via the asset transport.

### Dependencies

- `fabric` (v7.3.1) — already in workspace dependencies
- `@lucide/svelte` — already available
- shadcn-svelte components (`Button`, `Input`, `Textarea`, `Select`, `Card`, `Badge`, `ToggleGroup`) — already available via `ui/source`
