import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Surreal } from 'surrealdb';
import type { SystemAgentDefinition } from '../../shared/chat/index.js';
import { Gpt41ModelCard, Claude4SonnetModelCard, MODEL_CARD_CATALOG } from '../../shared/chat/index.js';
import { createDbConnection } from '../../infrastructure/database/client.js';
import { SurrealDbAdapter } from '../../infrastructure/database/SurrealDbAdapter.js';
import { SurrealUserAgentRepository } from '../../infrastructure/database/chat/SurrealUserAgentRepository.js';
import { AgentCatalogService } from './agent-catalog-service.js';
import { InMemorySystemSource } from './__test-helpers__/test-fixtures.js';

const SYSTEM_GENERAL: SystemAgentDefinition = {
  id: 'system-general',
  name: 'General Assistant',
  description: 'A helpful general-purpose assistant.',
  modelCard: Gpt41ModelCard,
  systemPrompt: 'You are a helpful assistant.',
  defaultToolState: { search: true },
  metadata: {},
};

const SYSTEM_CREATIVE: SystemAgentDefinition = {
  id: 'system-creative',
  name: 'Creative Writer',
  description: 'An assistant for creative writing.',
  modelCard: Claude4SonnetModelCard,
  systemPrompt: 'You are a creative writing assistant.',
  defaultToolState: {},
  metadata: { category: 'creative' },
};

describe('AgentCatalogService', () => {
  let db: Surreal;
  let service: AgentCatalogService;
  let userRepo: SurrealUserAgentRepository;

  function createService(
    systemAgents: SystemAgentDefinition[] = [SYSTEM_GENERAL, SYSTEM_CREATIVE],
  ) {
    const systemSource = new InMemorySystemSource(systemAgents);
    service = new AgentCatalogService(systemSource, userRepo, MODEL_CARD_CATALOG);
    return { service, systemSource, userRepo };
  }

  beforeEach(async () => {
    db = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    userRepo = new SurrealUserAgentRepository(new SurrealDbAdapter(db));
    createService();
  });

  afterEach(async () => { await db.close(); });

  test('lists system agents first, then user agents by updatedAt desc', async () => {
    const older = await userRepo.create({
      name: 'Older Agent',
      description: 'old',
      modelCardId: Gpt41ModelCard.registryId,
      systemPrompt: 'old prompt',
    });

    await new Promise((r) => setTimeout(r, 5));

    const newer = await userRepo.create({
      name: 'Newer Agent',
      description: 'new',
      modelCardId: Gpt41ModelCard.registryId,
      systemPrompt: 'new prompt',
    });

    const agents = await service.listAgents();

    expect(agents.length).toBe(4);
    expect(agents[0].id).toBe('system-general');
    expect(agents[1].id).toBe('system-creative');
    expect(agents[0].source).toBe('system');
    expect(agents[1].source).toBe('system');
    expect(agents[2].source).toBe('user');
    expect(agents[3].source).toBe('user');
    expect(agents[2].name).toBe('Newer Agent');
    expect(agents[3].name).toBe('Older Agent');
  });

  test('system agents are not editable', async () => {
    const agents = await service.listAgents();
    const system = agents.find((a) => a.id === 'system-general')!;

    expect(system.isEditable).toBe(false);
    expect(system.source).toBe('system');
    expect(system.systemAgentId).toBe('system-general');
  });

  test('finds system agent by id', async () => {
    const agent = await service.findAgent('system-general');

    expect(agent).toBeDefined();
    expect(agent!.name).toBe('General Assistant');
    expect(agent!.modelCard.registryId).toBe(Gpt41ModelCard.registryId);
  });

  test('finds user agent by id', async () => {
    const created = await userRepo.create({
      name: 'My Agent',
      description: 'custom',
      modelCardId: Gpt41ModelCard.registryId,
      systemPrompt: 'custom prompt',
    });

    const agent = await service.findAgent(created.id);
    expect(agent).toBeDefined();
    expect(agent!.name).toBe('My Agent');
    expect(agent!.isEditable).toBe(true);
  });

  test('returns undefined for unknown agent id', async () => {
    expect(await service.findAgent('nonexistent')).toBeUndefined();
  });

  test('creates a fully user-owned agent', async () => {
    const agent = await service.createUserAgent({
      name: 'Custom Bot',
      description: 'A custom bot',
      modelCardId: Gpt41ModelCard.registryId,
      systemPrompt: 'You are custom.',
    });

    expect(agent.source).toBe('user');
    expect(agent.isEditable).toBe(true);
    expect(agent.isInherited).toBe(false);
    expect(agent.isDuplicatedFromSystem).toBe(false);
    expect(agent.isStandalone).toBe(true);
    expect(agent.systemPrompt).toBe('You are custom.');
  });

  test('duplicateSystemAgent creates snapshot with no future linkage', async () => {
    const agent = await service.duplicateSystemAgent('system-general');

    expect(agent.source).toBe('user');
    expect(agent.isEditable).toBe(true);
    expect(agent.isInherited).toBe(false);
    expect(agent.isDuplicatedFromSystem).toBe(true);
    expect(agent.inheritsFromSystemAgentId).toBeUndefined();
    expect(agent.systemPrompt).toBe('You are a helpful assistant.');
    expect(agent.modelCard.registryId).toBe(Gpt41ModelCard.registryId);
  });

  test('duplicateSystemAgent throws for unknown system agent', async () => {
    await expect(service.duplicateSystemAgent('nonexistent')).rejects.toThrow(
      'System agent not found: nonexistent',
    );
  });

  test('inheritSystemAgent creates linked override with inheritsFromSystemAgentId', async () => {
    const agent = await service.inheritSystemAgent('system-general');

    expect(agent.source).toBe('user');
    expect(agent.isEditable).toBe(true);
    expect(agent.isInherited).toBe(true);
    expect(agent.isDuplicatedFromSystem).toBe(false);
    expect(agent.inheritsFromSystemAgentId).toBe('system-general');
    expect(agent.name).toBe('General Assistant');
    expect(agent.toolState).toEqual({ search: true });
  });

  test('inherited agent picks up overridden systemPrompt', async () => {
    const agent = await service.inheritSystemAgent('system-creative', {
      systemPrompt: 'Be extra creative.',
    });

    expect(agent.isInherited).toBe(true);
    expect(agent.systemPrompt).toBe('Be extra creative.');
    expect(agent.name).toBe('Creative Writer');
  });

  test('system JSON changes flow through inherited agents for non-overridden fields', async () => {
    const updatedGeneral: SystemAgentDefinition = {
      ...SYSTEM_GENERAL,
      name: 'Updated General',
      description: 'Updated description',
      defaultToolState: { search: true, browse: true },
    };

    const { service: freshService } = createService([updatedGeneral, SYSTEM_CREATIVE]);

    await freshService.inheritSystemAgent('system-general');

    const agents = await userRepo.list();
    const storedId = agents[0].id;

    const agent = await freshService.findAgent(storedId);
    expect(agent).toBeDefined();
    expect(agent!.name).toBe('Updated General');
    expect(agent!.toolState).toEqual({ search: true, browse: true });
  });

  test('updates a user agent', async () => {
    await service.createUserAgent({
      name: 'Original',
      description: 'original desc',
      modelCardId: Gpt41ModelCard.registryId,
      systemPrompt: 'original prompt',
    });

    const agents = await userRepo.list();
    const storedId = agents[0].id;

    const updated = await service.updateUserAgent(storedId, {
      systemPrompt: 'updated prompt',
      userOverrides: { name: 'Renamed' },
    });

    expect(updated.systemPrompt).toBe('updated prompt');
    expect(updated.name).toBe('Renamed');
  });

  test('effective modelCard is resolved from catalog', async () => {
    const agent = await service.createUserAgent({
      name: 'Claude User',
      description: 'uses claude',
      modelCardId: Claude4SonnetModelCard.registryId,
      systemPrompt: 'prompt',
    });

    expect(agent.modelCard.registryId).toBe(Claude4SonnetModelCard.registryId);
    expect(agent.modelCard.provider).toBe('anthropic');
  });
});
