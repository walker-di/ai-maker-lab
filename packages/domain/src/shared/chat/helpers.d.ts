import type { ModelCard } from './model-card.js';
import type { ModelProvider } from './model-provider.js';
import type { SystemAgentDefinition, StoredUserAgent, ResolvedAgentProfile } from './agent-types.js';
export declare function findModelCardByRegistryId(registryId: string, catalog?: readonly ModelCard[]): ModelCard | undefined;
export declare function findModelCardByModelId(modelId: string, catalog?: readonly ModelCard[]): ModelCard | undefined;
export declare function findModelCardByProvider(provider: ModelProvider, catalog?: readonly ModelCard[]): ModelCard[];
export declare function resolveSystemAgent(definition: SystemAgentDefinition): ResolvedAgentProfile;
export declare function resolveUserAgent(userAgent: StoredUserAgent, systemDefinition: SystemAgentDefinition | undefined, modelCard: ModelCard): ResolvedAgentProfile;
export declare function duplicateSystemAgentAsUser(definition: SystemAgentDefinition, newUserId: string): StoredUserAgent;
