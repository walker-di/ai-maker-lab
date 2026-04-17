import { streamText, generateText, type StreamTextResult, type GenerateTextResult, type ModelMessage, type StreamTextOnFinishCallback, type ToolSet } from 'ai';
import type { ResolvedAgentProfile, ModelCard } from '../../shared/chat/index.js';
import { findModelCardByRegistryId, MODEL_CARD_CATALOG, FAMILY_STRATEGIES } from '../../shared/chat/index.js';
import type { ProviderRegistry } from '../../infrastructure/ai/provider-registry.js';
import { resolveWrappedModel, type RegistryModelId } from '../../infrastructure/ai/wrapped-models.js';
import { resolveHostedToolState } from './hosted-tool-resolution.js';
import { buildHostedNativeTools } from '../../infrastructure/ai/hosted-native-tools.js';
import { extractToolInvocationsFromResponseMessages } from './tool-invocation-extractor.js';

type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };
const CHAT_DEBUG_PREFIX = '[chat-debug]';

export interface ModelHandlerRequest {
  readonly messages: ModelMessage[];
  readonly threadId?: string;
  readonly onFinish?: StreamTextOnFinishCallback<ToolSet>;
  /**
   * Optional metadata about request inputs (e.g. attachments) forwarded to the
   * model card's tool-policy hook so it can shape the hosted tool set.
   */
  readonly attachmentClassifications?: readonly string[];
}

export interface ModelHandlerDebugInfo {
  readonly threadId?: string;
  readonly agentId: string;
  readonly agentName: string;
  readonly modelRegistryId: string;
  readonly enabledHostedTools: readonly string[];
  readonly attachedHostedTools: readonly string[];
  readonly skippedHostedTools: readonly string[];
  readonly providerOptions: Record<string, unknown>;
  readonly messageCount: number;
}

export function buildModelHandlerDebugInfo(input: ModelHandlerDebugInfo): ModelHandlerDebugInfo {
  return input;
}

function getMessagePartTypes(messages: readonly ModelMessage[]): string[][] {
  return messages.map((message) =>
    Array.isArray(message.content)
      ? message.content.map((part) =>
        typeof part === 'object' && part !== null && 'type' in part && typeof part.type === 'string'
          ? part.type
          : 'unknown'
      )
      : [],
  );
}

function logChatDebug(label: string, payload: Record<string, unknown>) {
  console.info(`${CHAT_DEBUG_PREFIX} ${label}`, payload);
}

/**
 * The provider registry can be passed directly (immutable) or as a getter so
 * callers can hot-swap the underlying registry without rebuilding the handler.
 * The desktop app uses the getter form so saving new API keys via the Settings
 * page rebuilds the registry without reconstructing ChatService/ModelHandler.
 */
export type ProviderRegistrySource = ProviderRegistry | (() => ProviderRegistry);

export class ModelHandler {
  private readonly registrySource: ProviderRegistrySource;
  private readonly catalog: readonly ModelCard[];

  constructor(
    registry: ProviderRegistrySource,
    catalog: readonly ModelCard[] = MODEL_CARD_CATALOG,
  ) {
    this.registrySource = registry;
    this.catalog = catalog;
  }

  private get registry(): ProviderRegistry {
    return typeof this.registrySource === 'function'
      ? (this.registrySource as () => ProviderRegistry)()
      : this.registrySource;
  }

  stream(
    agent: ResolvedAgentProfile,
    request: ModelHandlerRequest,
  ): StreamTextResult<any, any> {
    const model = this.resolveModel(agent.modelCard.registryId);
    const { messages, providerOptions, tools, debugInfo } = this.prepare(agent, request);

    logChatDebug('model-handler.stream.start', {
      ...debugInfo,
      messagePartTypes: getMessagePartTypes(messages),
    });

    return streamText({
      model,
      system: agent.systemPrompt,
      messages,
      tools,
      providerOptions: providerOptions as Record<string, Record<string, JSONValue>>,
      onFinish: async (event) => {
        const toolInvocations = extractToolInvocationsFromResponseMessages(event.response?.messages);
        logChatDebug('model-handler.stream.finish', {
          ...debugInfo,
          finishReason: event.finishReason,
          textLength: event.text.length,
          responseMessageCount: event.response?.messages?.length ?? 0,
          toolInvocations,
        });
        await request.onFinish?.(event);
      },
    });
  }

  async generate(
    agent: ResolvedAgentProfile,
    request: ModelHandlerRequest,
  ): Promise<GenerateTextResult<any, any>> {
    const model = this.resolveModel(agent.modelCard.registryId);
    const { messages, providerOptions, tools, debugInfo } = this.prepare(agent, request);

    logChatDebug('model-handler.generate.start', {
      ...debugInfo,
      messagePartTypes: getMessagePartTypes(messages),
    });

    const result = await generateText({
      model,
      system: agent.systemPrompt,
      messages,
      tools,
      providerOptions: providerOptions as Record<string, Record<string, JSONValue>>,
    });

    logChatDebug('model-handler.generate.finish', {
      ...debugInfo,
      finishReason: result.finishReason,
      textLength: result.text.length,
      responseMessageCount: result.response?.messages?.length ?? 0,
      toolInvocations: extractToolInvocationsFromResponseMessages(result.response?.messages),
    });

    return result;
  }

  private resolveModel(registryId: string) {
    const card = findModelCardByRegistryId(registryId, this.catalog);
    if (card) {
      return resolveWrappedModel(this.registry, card);
    }
    return this.registry.languageModel(registryId as RegistryModelId);
  }

  private prepare(
    agent: ResolvedAgentProfile,
    request: ModelHandlerRequest,
  ): {
    messages: ModelMessage[];
    providerOptions: Record<string, unknown>;
    tools: ToolSet;
    debugInfo: ModelHandlerDebugInfo;
  } {
    const strategy = FAMILY_STRATEGIES[agent.modelCard.familyId];
    const messages = strategy?.prepareMessages
      ? strategy.prepareMessages([...request.messages], agent.modelCard)
      : [...request.messages];
    const attachmentClassifications = request.attachmentClassifications ?? [];
    const hostedToolState = resolveHostedToolState(agent, {
      hasAttachments: attachmentClassifications.length > 0,
      attachmentClassifications,
    });
    const hostedTools = buildHostedNativeTools(agent.modelCard, hostedToolState.enabledTools);
    const providerOptions: Record<string, unknown> = {
      ...agent.modelCard.providerOptionsPreset,
      ...strategy?.providerOptions,
      ...hostedToolState.providerOptions,
    };
    return {
      messages,
      providerOptions,
      tools: hostedTools.tools,
      debugInfo: buildModelHandlerDebugInfo({
        threadId: request.threadId,
        agentId: agent.id,
        agentName: agent.name,
        modelRegistryId: agent.modelCard.registryId,
        enabledHostedTools: hostedToolState.enabledTools,
        attachedHostedTools: hostedTools.attachedTools,
        skippedHostedTools: hostedTools.skippedTools,
        providerOptions,
        messageCount: messages.length,
      }),
    };
  }
}
