## UI Package Context

- Workspace root: `../../`
- Package manager: Bun
- Package role: shared Svelte UI library

## Monorepo Rules

- Install dependencies from the repository root with `bun install`.
- Shared components belong in `src/lib`.
- `shadcn-svelte` is the standard component system for shared primitives in this package.
- `src/routes` and `src/stories` are demo and validation surfaces, not the primary library API.
- Export public components from `src/lib/index.ts`.
- Keep reusable UI here instead of rebuilding it inside `apps/desktop-app`.

## Consumption Rules

- The workspace app consumes source exports from `ui/source`.
- Generated shadcn components use the shared `$ui` alias, which resolves to `packages/ui/src/lib`.
- Keep the package root export valid for packaged builds from `dist`.
- When you add a new public component, wire both the library entrypoint and any relevant stories in the same change.
- Add shadcn components from `packages/ui` with `bun x shadcn-svelte@latest add <component> --overwrite`.
- For Lucide icons, import directly from `@lucide/svelte/icons/<icon-name>`.
- Do not use named imports or wildcard imports from `@lucide/svelte` in normal shared components. Reserve wildcard imports for intentional dynamic icon loaders and document the build-size tradeoff when you do.

## Chat Components

- `src/lib/chat/` contains shared chat UI components: `ChatComposer`, `ChatMessageBubble`, `ChatThreadListItem`, `ChatAgentListItem`, `ChatAgentCard`, `ChatAgentChip`, `ChatModelBadge`, `ChatAttachmentPill`, `ChatToolEventRow`, `ChatReplyPreview`.
- `ChatComposer` follows the shadcn-svelte `notion-prompt-form` pattern using `InputGroup`, `DropdownMenu`, `Tooltip`, and `Separator`.
- `ChatComposer` requires `Tooltip.Provider` context in the component tree. Pages that render `ChatComposer` (including conditionally, e.g. inside `{#if}` branches) must wrap their content with `<Tooltip.Provider>` from `ui/source`. Missing this provider causes a context error that silently aborts rendering.
- `ChatComposer.svelte.ts` contains the composer presentation model (`createChatComposerModel`).
- `src/lib/chat/types.ts` defines local UI types (`ChatAgentProfile`, `ChatThread`, `AttachmentRef`, `ModelUiPresentation`, etc.) so the UI package does not depend on `packages/domain`. Domain types satisfy these structurally at the app boundary.
- All chat components are barrel-exported from `src/lib/chat/index.ts` and re-exported from `src/lib/index.ts`.
