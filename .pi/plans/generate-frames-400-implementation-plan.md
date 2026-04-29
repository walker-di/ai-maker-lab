# Generate Frames 400 Error — Implementation Plan

## Summary
- **Goal:** Fix "The request was invalid. Please check your input" error when clicking "Generate frames" on `/experiments/storyboard`.
- **Root causes identified:**
  1. **Primary — `count` type mismatch:** The shadcn `Input` component passes a dynamic `{type}` prop to the native `<input>`, which may prevent Svelte 5 from applying `to_number` conversion. The `count` field arrives as a string (`"3"`) in the JSON body, but the Zod schema `GenerateStoryboardFramesDtoSchema` uses `z.number()` (no coercion), so it rejects the request with a 400.
  2. **Secondary — Error classification conflation:** `toMarketingErrorResponse` maps any error whose message contains `"invalid"` to HTTP 400. This means `StoryboardService.assertDraft()` throwing `"Generated storyboard frame is invalid."` (a server-side AI output issue) is reported to the user as a validation error with the same "request was invalid" message.
  3. **Tertiary — Hidden error details:** The transport stores the actual server error in `technicalMessage`, but the UI only displays the generic `userMessage`, making it impossible for the user (or developer) to diagnose the problem.
- **Assumptions:** The `count` coercion is the primary trigger in this specific case. The error classification and visibility issues are contributing problems that should be fixed in the same change.
- **Non-goals:** Redesigning the entire error handling pipeline. Changing the storyboard feature's business logic.

## Source Reports
- [x] ✅ UI/frontend planning report incorporated: `plan-ui-generate-frames-400`
- [x] ✅ Backend planning report incorporated: `plan-backend-generate-frames-400`
- [x] ✅ Tests planning report incorporated: `plan-tests-generate-frames-400`

## Architecture Validation
- ✅ Clean architecture boundaries: All changes respect domain/application/infrastructure separation. Schema changes in `packages/domain`, transport in app adapters, UI in `packages/ui`.
- ✅ Svelte 5/frontend idioms: Uses `$state`, `$bindable`, runes syntax. Defensive type coercion at the boundary.
- ✅ API/infrastructure boundaries: Zod coercion is the standard approach for HTTP boundaries where JSON types may be imprecise.
- ✅ i18n/accessibility: Error messages remain i18n-friendly through existing `m.*` message functions. Technical details are shown as supplementary info, not replacing localized messages.
- ✅ Testing strategy: Covers validation schema, error classification, page model, and manual browser verification.

## Implementation Checklist

### UI/frontend
- [ ] **AddFramesDialog: coerce count to number defensively** — In `packages/ui/src/lib/storyboard/AddFramesDialog.svelte`, change the `submit` function to ensure `count` is coerced to a number before calling `onGenerate`:
  ```
  await onGenerate({ prompt: prompt.trim(), count: Number(count) });
  ```
  This is a defensive fix at the UI boundary regardless of whether the backend also adds coercion.

- [ ] **AddFramesDialog: validate count client-side** — Add client-side validation for `count` (must be integer >= 1 and <= 20, not NaN) alongside the existing prompt validation:
  ```
  if (!Number.isFinite(count) || count < 1 || count > 20) { error = 'Frame count must be between 1 and 20'; return; }
  ```

- [ ] **Page model: show technical error details** — In `apps/desktop-app/src/routes/experiments/storyboard/storyboard-page.svelte.ts`, update the `run()` function's catch block to include `technicalMessage` when available from `StoryboardTransportError`:
  ```
  operationError = cause instanceof StoryboardTransportError
    ? (cause.technicalMessage ? `${cause.message} (${cause.technicalMessage})` : cause.message)
    : ...
  ```

- [ ] **Page template: collapsible technical details** — In `apps/desktop-app/src/routes/experiments/storyboard/+page.svelte`, consider rendering `technicalMessage` in a `<details>` element within the error banner for developer visibility without cluttering the UI.

### Backend
- [ ] **Zod schema: add coercion for count** — In `packages/domain/src/shared/marketing/validation.ts`, change:
  ```
  count: z.number().int().min(1).max(20).default(3)
  ```
  to:
  ```
  count: z.coerce.number().int().min(1).max(20).default(3)
  ```
  This ensures string `"3"` from HTTP JSON is correctly coerced to number `3`.

- [ ] **Error classification: distinguish AI-output errors from user-input errors** — In `apps/desktop-app/src/lib/server/marketing-service.ts`, update `toMarketingErrorResponse` to differentiate server-side "invalid" errors (like `assertDraft`) from user input "invalid" errors. Options:
  - Create a `StoryboardGenerationError` class in the domain layer that extends `Error` with a specific name/kind, and handle it as 500 (or 422) instead of 400 in `toMarketingErrorResponse`.
  - Or refine the string-matching heuristic to check for Zod-specific patterns first and default other "invalid" messages to 500.

- [ ] **assertDraft: improve error message** — In `packages/domain/src/application/marketing/story-service.ts`, change `assertDraft()` error message from `'Generated storyboard frame is invalid.'` to something that won't be misclassified:
  ```
  throw new Error('AI generation produced an incomplete storyboard frame. Missing required fields.');
  ```
  Or better, use a typed error class.

- [ ] **API route: detailed error logging** — In `apps/desktop-app/src/routes/api/marketing/storyboards/[storyboardId]/frames/generate/+server.ts`, enhance the catch block to log more context:
  ```
  console.error('Failed to generate storyboard frames', {
    storyboardId: params.storyboardId,
    bodyKeys: Object.keys(body ?? {}),
    error,
  });
  ```

### Tests
- [ ] **Validation schema test: string count coercion** — In `packages/domain/src/shared/marketing/storyboard-validation.test.ts`, add:
  ```
  test('coerces string count to number', () => {
    expect(GenerateStoryboardFramesDtoSchema.parse({ prompt: 'A story', count: '3' })).toEqual({ prompt: 'A story', count: 3 });
  });
  ```

- [ ] **Validation schema test: NaN/invalid count rejection** — Add:
  ```
  test('rejects NaN and non-numeric count', () => {
    expect(GenerateStoryboardFramesDtoSchema.safeParse({ prompt: 'A story', count: 'abc' }).success).toBe(false);
    expect(GenerateStoryboardFramesDtoSchema.safeParse({ prompt: 'A story', count: NaN }).success).toBe(false);
  });
  ```

- [ ] **Error classification test** — Create or extend a test for `toMarketingErrorResponse` in `apps/desktop-app/src/lib/server/marketing-service.ts` (co-located test file) to verify:
  - Zod errors return 400 with "Validation failed: ..." message
  - "Generated storyboard frame is invalid" errors return 500 (or 422), NOT 400
  - "Storyboard not found" returns 404

- [ ] **Storyboard service test: assertDraft with empty fields** — In `packages/domain/src/application/marketing/storyboard-service.test.ts`, add a test that verifies `generateFrames` with an AI gateway that returns frames with empty fields throws the expected error.

- [ ] **Page model test: error display includes technical details** — In `apps/desktop-app/src/routes/experiments/storyboard/storyboard-page.test.ts`, verify that when transport throws `StoryboardTransportError` with `technicalMessage`, the `operationError` includes it.

### Validation
- [ ] Run `bun test` from `packages/domain` to verify schema and service tests pass
- [ ] Run `bun run check` from `apps/desktop-app` to verify no TypeScript errors
- [ ] Browser verify: Open `/experiments/storyboard`, create a storyboard, click "Generate frames" with a prompt and count=3, confirm frames are generated
- [ ] Browser verify: Clear the count field, click Generate, confirm client-side validation catches the error
- [ ] Browser verify: Intentionally trigger a server error and confirm the error banner shows useful detail

## Dependencies and Sequencing
1. **Backend Zod coercion** (`validation.ts`) — Do first. This is the primary fix and unblocks the feature.
2. **Backend error classification** (`marketing-service.ts`, `story-service.ts`) — Second. Prevents future misclassification.
3. **UI defensive coercion** (`AddFramesDialog.svelte`) — Can be done in parallel with #2. Defense in depth.
4. **UI error display** (`storyboard-page.svelte.ts`, `+page.svelte`) — After #2 since improved errors should be visible.
5. **Tests** — Write alongside each change. Validation tests with #1, error classification tests with #2, UI tests with #3/#4.

## Risks and Mitigations
- ⚠️ Risk: `z.coerce.number()` changes behavior for other callers of `GenerateStoryboardFramesDtoSchema`.
  - Mitigation: The schema is only used in the HTTP API route handler. All other callers (service layer, tests) already pass numbers. Coercion is strictly more permissive.

- ⚠️ Risk: Changing `assertDraft` error message or introducing typed errors could break error message assertions in existing tests.
  - Mitigation: The existing `storyboard-service.test.ts` doesn't test `assertDraft` failure. The mock AI gateway always returns valid drafts. No existing assertions will break.

- ⚠️ Risk: Showing `technicalMessage` in the UI could leak sensitive server details.
  - Mitigation: `technicalMessage` is already sanitized through `toMarketingErrorResponse` which uses `error.message`. No stack traces or internal paths are included. Use a `<details>` element so it's hidden by default.

- ⚠️ Risk: The primary cause might be AI gateway failure rather than `count` type mismatch.
  - Mitigation: The Zod coercion fix and the error classification fix address both scenarios. Even if the immediate trigger is the AI gateway, the error will now be correctly classified and shown with useful details.

## Open Questions
- ❓ Should `z.coerce.number()` be applied to other numeric fields in the marketing validation schemas for consistency? (Recommend: only where the field comes from HTTP input, not internal service calls.)
- ❓ Is a dedicated `StoryboardGenerationError` class in the domain layer warranted, or is refining the string-matching heuristic in `toMarketingErrorResponse` sufficient? (Recommend: typed error class for clean architecture.)
