import type {
  ResolvedAgentProfile,
  HostedNativeToolName,
  ModelToolPolicyHookInput,
} from '../../shared/chat/index.js';
import { isHostedNativeToolName } from '../../shared/chat/index.js';

export interface ResolvedHostedToolState {
  readonly enabledTools: readonly HostedNativeToolName[];
  readonly providerOptions: Record<string, unknown>;
}

export interface HostedToolResolutionContext {
  readonly hasAttachments?: boolean;
  readonly attachmentClassifications?: readonly string[];
}

export function resolveHostedToolState(
  agent: ResolvedAgentProfile,
  context: HostedToolResolutionContext = {},
): ResolvedHostedToolState {
  const { modelCard } = agent;

  if (agent.toolsEnabled === false) {
    return { enabledTools: [], providerOptions: {} };
  }

  if (!modelCard.capabilities.tools || modelCard.nativeToolSupportLevel !== 'hosted') {
    return { enabledTools: [], providerOptions: {} };
  }

  const allowedTools = new Set(modelCard.nativeTools);
  const enabledTools = new Set<HostedNativeToolName>(modelCard.toolPolicy.defaultEnabledTools);
  const removableTools = new Set(modelCard.toolPolicy.removableTools);

  for (const toolName of modelCard.toolPolicy.modelSpecificToolAdditions) {
    if (allowedTools.has(toolName)) {
      enabledTools.add(toolName);
    }
  }

  for (const [toolName, isEnabled] of Object.entries(agent.toolState)) {
    if (!isHostedNativeToolName(toolName) || !allowedTools.has(toolName)) {
      continue;
    }

    if (isEnabled) {
      enabledTools.add(toolName);
      continue;
    }

    if (removableTools.has(toolName)) {
      enabledTools.delete(toolName);
    }
  }

  let resolvedTools = [...enabledTools].filter((toolName) => allowedTools.has(toolName));
  let providerOptions: Record<string, unknown> =
    resolvedTools.length > 0 ? { ...modelCard.toolPolicy.providerOptionPresets } : {};

  const hook = modelCard.toolPolicy.hook;
  if (hook) {
    const hookInput: ModelToolPolicyHookInput = {
      enabledTools: resolvedTools,
      providerOptions,
      hasAttachments: context.hasAttachments ?? false,
      attachmentClassifications: context.attachmentClassifications ?? [],
    };

    const hookResult = hook(hookInput);
    if (hookResult) {
      const next = new Set(resolvedTools);
      for (const tool of hookResult.addedTools ?? []) {
        if (allowedTools.has(tool)) {
          next.add(tool);
        }
      }
      for (const tool of hookResult.removedTools ?? []) {
        next.delete(tool);
      }
      resolvedTools = [...next];

      if (hookResult.providerOptionOverrides) {
        providerOptions = { ...providerOptions, ...hookResult.providerOptionOverrides };
      }
    }
  }

  return {
    enabledTools: resolvedTools,
    providerOptions,
  };
}
