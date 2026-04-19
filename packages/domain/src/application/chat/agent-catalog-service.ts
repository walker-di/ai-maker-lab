import type { ResolvedAgentProfile, StoredUserAgent, ModelCard } from '../../shared/chat/index.js';
import {
  resolveSystemAgent,
  resolveUserAgent,
  duplicateSystemAgentAsUser,
  findModelCardByRegistryId,
  MODEL_CARD_CATALOG,
} from '../../shared/chat/index.js';
import type {
  ISystemAgentDefinitionSource,
  IUserAgentRepository,
  CreateUserAgentInput,
  UpdateUserAgentInput,
} from './ports.js';

export class AgentCatalogService {
  constructor(
    private readonly systemSource: ISystemAgentDefinitionSource,
    private readonly userAgentRepo: IUserAgentRepository,
    private readonly catalog: readonly ModelCard[] = MODEL_CARD_CATALOG,
  ) {}

  async listAgents(): Promise<ResolvedAgentProfile[]> {
    const systemDefs = this.systemSource.loadAll();
    const userAgents = await this.userAgentRepo.list();

    const systemResolved = systemDefs.map(resolveSystemAgent);

    const sortedUserAgents = [...userAgents].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    const userResolved = sortedUserAgents.map((ua) => this.resolveUser(ua));

    return [...systemResolved, ...userResolved];
  }

  async findAgent(agentId: string): Promise<ResolvedAgentProfile | undefined> {
    const systemDef = this.systemSource.findById(agentId);
    if (systemDef) {
      return resolveSystemAgent(systemDef);
    }

    const userAgent = await this.userAgentRepo.findById(agentId);
    if (userAgent) {
      return this.resolveUser(userAgent);
    }

    return undefined;
  }

  async createUserAgent(input: CreateUserAgentInput): Promise<ResolvedAgentProfile> {
    const stored = await this.userAgentRepo.create(input);
    return this.resolveUser(stored);
  }

  async updateUserAgent(id: string, overrides: UpdateUserAgentInput): Promise<ResolvedAgentProfile> {
    const stored = await this.userAgentRepo.update(id, overrides);
    return this.resolveUser(stored);
  }

  async duplicateSystemAgent(systemAgentId: string): Promise<ResolvedAgentProfile> {
    const systemDef = this.systemSource.findById(systemAgentId);
    if (!systemDef) {
      throw new Error(`System agent not found: ${systemAgentId}`);
    }

    const snapshot = duplicateSystemAgentAsUser(systemDef, systemAgentId);
    const stored = await this.userAgentRepo.create({
      name: snapshot.userOverrides.name ?? systemDef.name,
      description: snapshot.userOverrides.description ?? systemDef.description,
      modelCardId: snapshot.modelCardId,
      systemPrompt: snapshot.systemPrompt,
      toolOverrides: snapshot.toolOverrides,
      duplicatedFromSystemAgentId: snapshot.duplicatedFromSystemAgentId,
    });

    return this.resolveUser(stored);
  }

  async inheritSystemAgent(
    systemAgentId: string,
    overrides?: Partial<Pick<CreateUserAgentInput, 'systemPrompt' | 'toolOverrides'>>,
  ): Promise<ResolvedAgentProfile> {
    const systemDef = this.systemSource.findById(systemAgentId);
    if (!systemDef) {
      throw new Error(`System agent not found: ${systemAgentId}`);
    }

    const stored = await this.userAgentRepo.create({
      name: systemDef.name,
      description: systemDef.description,
      modelCardId: systemDef.modelCard.registryId,
      systemPrompt: overrides?.systemPrompt ?? systemDef.systemPrompt,
      toolOverrides: overrides?.toolOverrides,
      inheritsFromSystemAgentId: systemAgentId,
    });

    return this.resolveUser(stored);
  }

  private resolveUser(userAgent: StoredUserAgent): ResolvedAgentProfile {
    const systemDef = userAgent.inheritsFromSystemAgentId
      ? this.systemSource.findById(userAgent.inheritsFromSystemAgentId)
      : undefined;

    const card = findModelCardByRegistryId(userAgent.modelCardId, this.catalog)
      ?? this.catalog[0];

    return resolveUserAgent(userAgent, systemDef, card);
  }
}
