# Post-Mortem: Subagent `resource_exhausted` Failure in Harness POC

Date: 2026-05-08  
Session affected: Harness activation on `ai-herness-POC.md`

---

## Goal vs Outcome

**Goal**: Run the full 8-phase harness serial loop on the POC document.  
**Outcome**: Blocked at Phase 1 (Plan). 5 consecutive subagent failures across all models.

---

## Root Cause Analysis

### TL;DR

**Two independent issues are at play:**

1. **Cursor provider HTTP/2 connection exhaustion** — `pi-cursor-provider`'s shared HTTP/2 proxy to `api2.cursor.sh` returns `resource_exhausted` for subagent child sessions. ALL subagents that use cursor models fail.
2. **Wrong model format in harness-playbook** — The cloudflare model is specified with a **space separator** (`"cloudflare-workers-ai @cf/moonshotai/kimi-k2.6"`) instead of a **slash separator** (`"cloudflare-workers-ai/@cf/moonshotai/kimi-k2.6"`). This causes model resolution to fail, silently falling back to the agent's default cursor model from `settings.json`, which then hits issue #1.

---

## Evidence Chain

### 1. The Error Pattern

| Attempt | Agent | Explicit Model | Result |
|---|---|---|---|
| 1 | `worker` | *(none)* — uses `cursor/claude-4.6-sonnet` from agentOverrides | ❌ `resource_exhausted` |
| 2 | `delegate` | `cursor/gemini-2.5-pro` | ❌ `resource_exhausted` |
| 3 | `worker` | `cursor/claude-4.6-sonnet` | ❌ `resource_exhausted` |
| 4 | `planner` | `cloudflare-workers-ai @cf/moonshotai/kimi-k2.6` | ❌ `resource_exhausted` |
| 5 | `worker` | `cloudflare-workers-ai @cf/moonshotai/kimi-k2.6` | ❌ `resource_exhausted` |

**Key observation**: ALL 5 attempts failed identically. Even the one using `cursor/gemini-2.5-pro` failed. This means the failure is NOT model-specific — it's infrastructure-level.

### 2. Where `resource_exhausted` Comes From

The error `Connect error resource_exhausted: Error` comes from the **Connect protocol layer** (gRPC-Connect over HTTP/2), not from the LLM API itself.

- `Connect` (capitalized) = [Connect-RPC](https://connectrpc.com/) protocol used by Cursor
- `resource_exhausted` = gRPC status code 8, meaning "some resource has been exhausted"
- The `pi-cursor-provider` uses `h2-bridge.mjs` to open persistent HTTP/2 streams to `https://api2.cursor.sh`
- HTTP/2 has a max concurrent stream limit per connection (default ~100). When exceeded, the server can return `REFUSED_STREAM` or the client gets `resource_exhausted`

### 3. The Settings.json Reveals the Smoking Gun

```json
{
  "defaultProvider": "cloudflare-workers-ai",
  "defaultModel": "@cf/moonshotai/kimi-k2.6",
  "subagents": {
    "agentOverrides": {
      "delegate": { "model": "cursor/gpt-5.4", ... },
      "scout": { "model": "cursor/gpt-5.4", ... },
      "planner": { "model": "cursor/claude-4.6-sonnet", ... },
      "reviewer": { "model": "cursor/claude-4.6-sonnet", ... },
      "worker": { "model": "cursor/claude-4.6-sonnet", ... },
      "frontend-worker": { "model": "cursor/claude-4.6-sonnet", ... },
      "backend-worker": { "model": "cursor/claude-4.6-sonnet", ... },
      "qa-worker": { "model": "cursor/claude-4.6-sonnet", ... },
      "domain-reviewer": { "model": "cursor/claude-4.6-sonnet", ... }
    }
  }
}
```

**Every single subagent override points to `cursor/*` models.** The parent session uses cloudflare successfully, but subagents are hardcoded to cursor — and cursor's HTTP/2 proxy is exhausted.

### 4. The Model Format Bug

In `harness-playbook/SKILL.md`:
```javascript
model: "cloudflare-workers-ai @cf/moonshotai/kimi-k2.6"  // ❌ WRONG: space separator
```

Pi's `resolveModelCandidate` function:
```typescript
if (model.includes("/")) return model;  // Early return for provider/model format
// Otherwise, look up by ID in availableModels
```

The space format `"cloudflare-workers-ai @cf/moonshotai/kimi-k2.6"`:
- Does NOT contain `/`
- Fails to match any model in `availableModels` (IDs don't include the provider prefix with space)
- Returns the raw string

The child Pi session receives this raw string, can't resolve it, and falls back to... the agent's default model from `agentOverrides` → `cursor/claude-4.6-sonnet` → which hits the cursor exhaustion.

**Correct format** should be one of:
```javascript
model: "cloudflare-workers-ai/@cf/moonshotai/kimi-k2.6"  // ✅ full provider/model
model: "@cf/moonshotai/kimi-k2.6"                         // ✅ bare, resolved against currentProvider
```

### 5. Why the Parent Session Works

The parent session uses `cloudflare-workers-ai` provider directly. Cloudflare Workers AI uses standard HTTP/1.1 (or HTTP/2 without the Connect protocol). It doesn't go through the `h2-bridge.mjs` proxy. So the parent session is unaffected by the cursor HTTP/2 exhaustion.

---

## The Two Root Causes

### Root Cause 1: Cursor Provider HTTP/2 Exhaustion (Infrastructure)

| Aspect | Detail |
|---|---|
| What | `pi-cursor-provider`'s HTTP/2 connection pool to `api2.cursor.sh` is exhausted |
| Symptom | `Connect error resource_exhausted: Error` on every subagent |
| Affected | ALL subagents using `cursor/*` models (which is ALL of them via agentOverrides) |
| Evidence | 5/5 subagent failures, identical error, `h2-bridge.mjs` uses HTTP/2 to Cursor |
| When | When subagent child sessions spawn and try to establish a new HTTP/2 stream |
| Why parent works | Parent uses cloudflare provider, which doesn't use the Cursor HTTP/2 bridge |
| Is it transient? | Likely yes — could be Cursor's side rate limiting, or local HTTP/2 stream exhaustion |

### Root Cause 2: Wrong Model Format in Harness Playbook (Bug)

| Aspect | Detail |
|---|---|
| What | `harness-playbook` specifies `"cloudflare-workers-ai @cf/moonshotai/kimi-k2.6"` (space) instead of `"cloudflare-workers-ai/@cf/moonshotai/kimi-k2.6"` (slash) |
| Symptom | Model resolution silently fails, falls back to agent default |
| Affected | ANY subagent call that explicitly uses the harness-playbook model spec |
| Evidence | `resolveModelCandidate` code in `pi-subagents/src/runs/shared/model-fallback.ts` checks for `/` |
| Fix | Change space to slash in ALL harness-playbook examples |
| Severity | High — without the cursor exhaustion issue, this would silently waste tokens on wrong model |

---

## Additional Finding: `resource_exhausted` Not in Retry Patterns

The `pi-subagents` fallback matcher (`model-fallback.ts`) does NOT include `resource_exhausted` in `RETRYABLE_MODEL_FAILURE_PATTERNS`:

```typescript
const RETRYABLE_MODEL_FAILURE_PATTERNS = [
  /rate\s*limit/i,
  /too many requests/i,
  /\b429\b/,
  /quota/i,
  /billing/i,
  /overloaded/i,
  /service unavailable/i,
  /timed? out/i,
  /timeout/i,
  // ... but NOT /resource_exhausted/
];
```

This means even if there WERE a fallback model configured, the fallback ladder would NOT trigger for `resource_exhausted`. The subagent fails immediately without retrying other models.

---

## Fix Checklist

### Immediate (Fix Only)

- [ ] **Fix harness-playbook model format**: Change `"cloudflare-workers-ai @cf/moonshotai/kimi-k2.6"` → `"cloudflare-workers-ai/@cf/moonshotai/kimi-k2.6"` in ALL examples
- [ ] **Fix Phase 6 retry logic**: The Javascript pseudocode uses `severityOrder(a) - severityOrder(b)` without defining the function — add the severity ranking
- [ ] **Remove stale embedded playbook in POC doc (Section 7)**: The POC doc still has the old mini-playbook; replace with reference to actual skill

### Short-Term (Fix + Verify)

- [ ] **Update agentOverrides to use cloudflare models**: In `settings.json`, change ALL `cursor/*` subagent overrides to `cloudflare-workers-ai/@cf/moonshotai/kimi-k2.6` or equivalent
- [ ] **Add `resource_exhausted` to retry patterns**: File an issue/PR against `pi-subagents` to include `resource_exhausted` in `RETRYABLE_MODEL_FAILURE_PATTERNS`
- [ ] **Test harness run when cursor recovers**: Save a test task for when the provider stabilizes

### Long-Term (Architecture)

- [ ] **Add subagent provider isolation**: Consider whether subagents should inherit the parent's `currentModelProvider` rather than overriding to cursor
- [ ] **Document provider compatibility matrix**: Which providers work with subagents? (Cloudflare ✅, Cursor ❌ currently)
- [ ] **Harness fallback strategy**: If subagents fail, the harness playbook should gracefully degrade to inline execution rather than complete failure

---

## Knowledge Gained

1. **Pi model format**: `provider/model` (slash), NOT `provider model` (space). The space separator passes through `resolveModelCandidate` as raw text, causing silent resolution failure.
2. **Cursor provider architecture**: Uses HTTP/2 (`h2-bridge.mjs`) to `api2.cursor.sh`. HTTP/2 stream limits + Connect protocol overhead make it susceptible to `resource_exhausted` under concurrent load.
3. **Subagent model resolution order**: `params.modelOverride` → agent default (from override config) → system default. If `params.modelOverride` fails resolution, the agent default kicks in silently.
4. **`resource_exhausted` ≠ retryable**: Pi's fallback logic does not recognize this as a retryable failure. The subagent fails hard.
5. **Parent/provider isolation**: Parent uses cloudflare fine, subagents hit cursor exhaustion. Subagents are NOT transparently using the parent's provider.

---

## Open Questions

1. Is the cursor HTTP/2 exhaustion transient (will fix itself) or permanent (needs code change)?
2. Does `@cf/moonshotai/kimi-k2.6` support the full token count of subagent sessions? (Subagent prompts are large with full context injection.)
3. Will cloudflare models even WORK in subagents, or is there a fundamental incompatibility with the subagent session creation?
4. Should the harness playbook design a graceful degradation path when subagents are unavailable?

---

## Summary

- **What broke**: Subagent infrastructure (cursor HTTP/2 exhaustion) + harness model format bug
- **Why it matters**: The harness loop cannot execute without subagents. This is a 100% blocker.
- **Immediate fix**: Fix model format; wait for cursor recovery OR switch agentOverrides to cloudflare
- **What we should monitor**: Is `resource_exhausted` transient? Test subagent with cloudflare model after fix.
- **What to record**: `resource_exhausted` is NOT retryable in pi-subagents. Document as known limitation.
