import { streamText, generateText, type StreamTextResult, type GenerateTextResult, type ModelMessage, type StreamTextOnFinishCallback, type ToolSet } from 'ai';
import type { ResolvedAgentProfile, ModelCard } from '../../shared/chat/index.js';
import { findModelCardByRegistryId, MODEL_CARD_CATALOG, FAMILY_STRATEGIES } from '../../shared/chat/index.js';
import type { ProviderRegistry } from '../../infrastructure/ai/provider-registry.js';
import { resolveWrappedModel, type RegistryModelId } from '../../infrastructure/ai/wrapped-models.js';

type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };

export interface ModelHandlerRequest {
  readonly messages: ModelMessage[];
  readonly threadId?: string;
  readonly onFinish?: StreamTextOnFinishCallback<ToolSet>;
}

export class ModelHandler {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly catalog: readonly ModelCard[] = MODEL_CARD_CATALOG,
  ) {}

  stream(
    agent: ResolvedAgentProfile,
    request: ModelHandlerRequest,
  ): StreamTextResult<any, any> {
    const model = this.resolveModel(agent.modelCard.registryId);
    const { messages, providerOptions } = this.prepare(agent, request);

    return streamText({
      model,
      system: agent.systemPrompt,
      messages,
      providerOptions: providerOptions as Record<string, Record<string, JSONValue>>,
      onFinish: request.onFinish,
    });
  }

  async generate(
    agent: ResolvedAgentProfile,
    request: ModelHandlerRequest,
  ): Promise<GenerateTextResult<any, any>> {
    const model = this.resolveModel(agent.modelCard.registryId);
    const { messages, providerOptions } = this.prepare(agent, request);

    return generateText({
      model,
      system: agent.systemPrompt,
      messages,
      providerOptions: providerOptions as Record<string, Record<string, JSONValue>>,
    });
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
  ): { messages: ModelMessage[]; providerOptions: Record<string, unknown> } {
    const strategy = FAMILY_STRATEGIES[agent.modelCard.familyId];
    const messages = strategy?.prepareMessages
      ? strategy.prepareMessages([...request.messages], agent.modelCard)
      : [...request.messages];
    const providerOptions: Record<string, unknown> = {
      ...agent.modelCard.providerOptionsPreset,
      ...strategy?.providerOptions,
    };
    return { messages, providerOptions };
  }
}
