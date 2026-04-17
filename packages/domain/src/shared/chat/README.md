# Chat Shared Domain

Browser-safe types, model cards, agent shapes, and pure helpers for the chat/AI layer.

## Contents

- **Model metadata**: `ModelProvider`, `SupportedModelId`, `ModelCard`, `ModelCapabilityMatrix`, `ModelUiPresentation`, `ModelInputPolicy`, `ModelToolPolicy`.
- **Model card catalog**: Pre-built cards for GPT-4.1, GPT-4.1 Mini, GPT-4o, Claude Sonnet 4, Claude 3.5 Haiku, Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash-Lite, Gemini 3.1 Pro, and Gemini 3.1 Flash-Lite.
- **Agent shapes**: `SystemAgentDefinition` (backend raw JSON), `StoredUserAgent` (DB persistence), `ResolvedAgentProfile` (unified controller shape).
- **Helpers**: `findModelCardByRegistryId`, `findModelCardByModelId`, `findModelCardByProvider`, `resolveSystemAgent`, `resolveUserAgent`, `duplicateSystemAgentAsUser`.

## Rules

- Do not import AI SDK packages, Svelte, SvelteKit, or server adapters here.
- Everything in this folder must be safe for browser import via `domain/shared`.
- `ModelCard` is the single source of truth for capability gating, fallback behavior, tool policy, and UI presentation.
- `systemPrompt` is first-class on agent shapes, not buried inside `ModelCard`.
