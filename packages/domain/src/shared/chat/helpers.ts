import type { ModelCard } from './model-card.js';
import type { ModelProvider } from './model-provider.js';
import type { SystemAgentDefinition, StoredUserAgent, ResolvedAgentProfile } from './agent-types.js';
import { MODEL_CARD_CATALOG } from './model-cards.js';

export function findModelCardByRegistryId(
  registryId: string,
  catalog: readonly ModelCard[] = MODEL_CARD_CATALOG,
): ModelCard | undefined {
  return catalog.find((card) => card.registryId === registryId);
}

export function findModelCardByModelId(
  modelId: string,
  catalog: readonly ModelCard[] = MODEL_CARD_CATALOG,
): ModelCard | undefined {
  return catalog.find((card) => card.modelId === modelId);
}

export function findModelCardByProvider(
  provider: ModelProvider,
  catalog: readonly ModelCard[] = MODEL_CARD_CATALOG,
): ModelCard[] {
  return catalog.filter((card) => card.provider === provider);
}

export function resolveSystemAgent(definition: SystemAgentDefinition): ResolvedAgentProfile {
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    source: 'system',
    systemAgentId: definition.id,
    isInherited: false,
    isStandalone: false,
    isEditable: false,
    modelCard: definition.modelCard,
    systemPrompt: definition.systemPrompt,
    toolsEnabled: definition.toolsEnabled ?? true,
    toolState: { ...definition.defaultToolState },
    metadata: { ...definition.metadata },
  };
}

export function resolveUserAgent(
  userAgent: StoredUserAgent,
  systemDefinition: SystemAgentDefinition | undefined,
  modelCard: ModelCard,
): ResolvedAgentProfile {
  const isInherited = userAgent.inheritsFromSystemAgentId != null && systemDefinition != null;
  const isDuplicatedFromSystem = userAgent.duplicatedFromSystemAgentId != null;

  const baseName = isInherited ? systemDefinition!.name : userAgent.id;
  const baseDescription = isInherited ? systemDefinition!.description : '';
  const baseToolState = isInherited ? { ...systemDefinition!.defaultToolState } : {};
  const baseMetadata = isInherited ? { ...systemDefinition!.metadata } : {};
  const baseToolsEnabled = isInherited ? systemDefinition!.toolsEnabled ?? true : true;
  const toolsEnabled = userAgent.toolsEnabled ?? baseToolsEnabled;

  return {
    id: userAgent.id,
    name: userAgent.userOverrides.name ?? baseName,
    description: userAgent.userOverrides.description ?? baseDescription,
    source: 'user',
    inheritsFromSystemAgentId: userAgent.inheritsFromSystemAgentId,
    isInherited,
    isDuplicatedFromSystem,
    isStandalone: !isInherited && userAgent.inheritsFromSystemAgentId == null,
    isEditable: true,
    modelCard,
    systemPrompt: userAgent.systemPrompt,
    toolsEnabled,
    toolState: { ...baseToolState, ...userAgent.toolOverrides },
    metadata: { ...baseMetadata, ...userAgent.userOverrides },
  };
}

export function duplicateSystemAgentAsUser(
  definition: SystemAgentDefinition,
  newUserId: string,
): StoredUserAgent {
  const now = new Date().toISOString();
  return {
    id: newUserId,
    source: 'user',
    duplicatedFromSystemAgentId: definition.id,
    modelCardId: definition.modelCard.registryId,
    systemPrompt: definition.systemPrompt,
    toolOverrides: { ...definition.defaultToolState },
    userOverrides: {
      name: definition.name,
      description: definition.description,
    },
    createdAt: now,
    updatedAt: now,
  };
}
