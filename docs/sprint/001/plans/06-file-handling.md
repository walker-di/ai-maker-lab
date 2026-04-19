# Title

File Handling Plan With Effective Agent Media Policies

## Goal

Support local file attachments in chat by persisting file metadata in SurrealDB, resolving file content at send time into AI SDK-compatible content parts, and letting the effective resolved agent’s `ModelCard.inputPolicy` control how each model handles text, images, pdfs, files, and video, with explicit clean-architecture boundaries and detailed testing expectations.

## Scope

- Add composer attachment UX.
- Persist attachment metadata only.
- Resolve supported files into AI SDK-compatible content parts at send time.
- Handle unreadable, missing, moved, or unsupported files safely.
- Make unsupported-modality behavior effective-agent-driven instead of hardcoded by provider.
- Document the hook seam for transform and tool-assisted fallback behavior.

Out of scope for this step:

- Copying file contents into app-managed storage.
- Long-term asset synchronization.
- A full video-processing subsystem beyond the hook seam and fallback policy.

## Architecture

- `packages/domain/src/shared/chat`
  - Own `AttachmentRef`, attachment classifications, UI-safe attachment status, and `ModelInputPolicy`.
  - Stay browser-safe and free of Bun file APIs, AI SDK request types, and database types.
- `packages/domain/src/application/chat`
  - Own the attachment-resolution port and orchestration rules for mapping attachments into model-runtime input.
  - Decide whether the selected effective agent’s `ModelCard.inputPolicy` passes through, transforms, augments with tools, or rejects a given input.
- `packages/domain/src/infrastructure`
  - Resolve local files, inspect metadata, read supported content, and build AI SDK-compatible content parts.
  - Implement any configured fallback transforms or tool-augmentation preparation.
- `packages/domain/src/infrastructure/database/chat`
  - Persist attachment metadata and message linkage.
- `packages/ui`
  - Own composer attachment pills, transcript attachment display, unavailable-file indicators, and model-card-driven warnings.
- `apps/desktop-app`
  - Compose the shared UI and transport only.
  - Must not embed raw file inspection, system-agent merge rules, or provider-specific modality rules inside route files.

## Implementation Plan

1. Define shared attachment models.
   - Add `AttachmentRef` with:
     - `id`
     - `messageId`
     - `path`
     - `name`
     - `mimeType`
     - `size`
     - `lastModified`
     - `status`
   - Add attachment classifications such as:
     - `text`
     - `image`
     - `pdf`
     - `video`
     - `unsupported`
2. Add attachment persistence.
   - Store metadata only in SurrealDB.
   - Link attachment records to the message that referenced them.
   - Preserve original path for future resolution attempts.
   - Keep persistence shapes separate from browser-safe shared types through mappers.
3. Add composer attachment UX through shared UI.
   - drag-and-drop
   - file picker
   - removable attachment pills before send
   - unavailable or error state after reload if the file is gone
   - reusable components belong in `packages/ui` and are imported into the desktop app from `ui/source`
4. Add an attachment-resolution port in the application layer.
   - Resolve file metadata into AI SDK-compatible content parts at send time.
   - Keep the use case free of Node or Bun file APIs by using an adapter port.
   - Allow the port to return:
     - normalized content parts
     - rejection reasons
     - transform instructions
     - tool augmentation hints
5. Define effective-agent-driven `ModelInputPolicy` behavior for all supported input types.
   - `pass-through`
   - `transform`
   - `augment-with-tools`
   - `reject`
   - Apply the same policy model to text, image, pdf, file, and video so the handler stays consistently configurable.
6. Implement supported file handling in infrastructure.
   - text, code, json, csv, md: read as text and attach as AI SDK text content
   - image formats: send as AI SDK image input when supported
   - pdf: send as AI SDK file or document input when supported
   - video: pass through only when the effective model card explicitly supports video
7. Make video handling explicit.
   - Effective agents whose model cards support video can accept video directly.
   - Effective agents whose model cards do not support video must either:
     - use a configured fallback hook from `ModelCard.inputPolicy`, or
     - reject the send with a clear UI message.
   - Fallback hooks may:
     - transform video into images
     - extract text summaries
     - augment the request with tools
8. Clarify inheritance behavior for file and media policy.
   - File/media behavior is resolved from the effective agent and embedded `modelCard` after inheritance merge.
   - The UI must not separately merge system and user policy fields.
   - Duplicated agents snapshot the file/media policy at duplication time.
   - Inherited agents follow system policy for unresolved fields and use user overrides where present.
9. Implement unsupported or broken-file handling.
   - block send with a clear validation state if the file is unreadable or unsupported
   - after reload, mark missing files as unavailable instead of silently dropping them
   - preserve the original attachment record so history remains auditable
10. Integrate attachment handling with effective model cards and UI presentation.
   - prevent sends when the selected effective model card rejects the input
   - surface fallback hints and warnings from effective `ModelCard.uiPresentation`
   - never hardcode GPT, Claude, or Gemini behavior directly in the UI layer
11. Keep sprint 001 metadata-only.
   - never copy the file into app storage
   - never depend on the source file still existing for the metadata record to remain visible in history

## Tests

- Shared and application tests should use `bun:test`.
- Policy and orchestration tests in the application layer should use in-memory fakes for the attachment-resolution port and runtime port.
  - Cover:
    - `pass-through`
    - `transform`
    - `augment-with-tools`
    - `reject`
    - model-card capability mismatch
    - fallback-hook presence or absence
    - inherited-agent unresolved file/media policy
    - duplicated-agent snapshot file/media policy
- Infrastructure tests should verify:
  - file classification
  - metadata extraction
  - AI SDK content-part mapping for text, image, pdf, and video
  - transform and tool-augmentation preparation behavior
- Repository tests for attachment persistence should use a real in-memory SurrealDB instance, matching the pattern in [SurrealTodoRepository.test.ts](/Users/walker/Documents/Dev/AI Maker Lab/ai-maker-lab/packages/domain/src/infrastructure/database/SurrealTodoRepository.test.ts).
  - Cover:
    - attachment metadata persistence
    - message linkage
    - reload behavior
    - missing-file state persistence
    - any id normalization rules if supported
- UI tests should verify:
  - composer pill rendering
  - unavailable-attachment transcript states
  - effective-model-card-driven warnings and disabled send states
  - shared attachment UI lives in `packages/ui`, while route-level orchestration stays in `apps/desktop-app`
  - system and user agents show the same resolved file-policy presentation once merged

## Acceptance Criteria

- The docs clearly place shared attachment types in `domain/shared`, orchestration in `domain/application`, file inspection and content-part mapping in infrastructure, and reusable attachment UI in `packages/ui`.
- Reusable attachment UI is planned to live in `packages/ui` and be imported into the desktop app from `ui/source`.
- Attachment persistence is planned to be verified against a real in-memory SurrealDB instance, not only mocked storage.
- File and media policies are explicitly resolved from the effective agent and embedded `modelCard` after inheritance merge.
- Video behavior is explicit: direct support, configured fallback, or clear rejection.
- Missing or unsupported files fail clearly without corrupting the message or thread.

## Dependencies

- `01-model-card-handler.md` provides `ResolvedAgentProfile`, `ModelCard`, `ModelInputPolicy`, fallback-hook design, and capability flags.
- `02-backend-apis-services.md` provides agent-catalog merge behavior, message and attachment persistence, and AI SDK-backed execution.
- `03-chat-ui.md` provides composer and transcript attachment components.
- `04-ui-backend-integration.md` provides transport payloads that carry attachment metadata and normalized content-part state.
- Attachment request-shape planning should align with [AI SDK Overview](https://ai-sdk.dev/docs).

## Risks / Notes

- Metadata-only persistence is simpler, but it means old threads may reference files that no longer exist. The UI must make that state explicit.
- Video handling is where configurability matters most; the hook seam needs to be clear even if only minimal fallbacks ship in sprint 001.
- Large text and media inputs may need size guards or truncation later, but sprint 001 can start with clear validation and policy-driven rejection.
- File handling should stay additive to the chat flow, not turn into a separate asset-management system.
