/**
 * Arena use cases (v1). Thin orchestrators that compose ports defined in
 * `ports.ts`. Heavier logic (validation, merging) lives in `ArenaCatalogService`.
 */

import type {
  ArenaDefinition,
  ArenaMetadata,
  ArenaValidationResult,
  ResolvedArenaEntry,
} from '../../../shared/voxsim/index.js';
import { validateArenaDefinition } from '../../../shared/voxsim/index.js';
import type { ArenaCatalogService } from '../ArenaCatalogService.js';
import type {
  IArenaValidator,
  IBuiltInArenaSource,
  IUserArenaRepository,
} from '../ports.js';

export class ListArenas {
  constructor(private readonly catalog: ArenaCatalogService) {}
  async execute(): Promise<ResolvedArenaEntry[]> {
    return this.catalog.listResolved();
  }
}

export class LoadArena {
  constructor(private readonly catalog: ArenaCatalogService) {}
  async execute(id: string): Promise<ResolvedArenaEntry | undefined> {
    return this.catalog.loadResolved(id);
  }
}

export interface SaveUserArenaInput {
  metadata: ArenaMetadata;
  definition: ArenaDefinition;
  inheritsFromBuiltInId?: string;
}

export class SaveUserArena {
  constructor(
    private readonly users: IUserArenaRepository,
    private readonly validator: IArenaValidator = { validate: validateArenaDefinition },
  ) {}
  async execute(input: SaveUserArenaInput): Promise<ResolvedArenaEntry> {
    const result = this.validator.validate(input.definition);
    if (!result.ok) throw new ArenaValidationError(result);
    const record = await this.users.create({
      metadata: { ...input.metadata, source: 'user' },
      definition: input.definition,
      inheritsFromBuiltInId: input.inheritsFromBuiltInId,
    });
    return {
      id: record.id,
      metadata: record.metadata,
      definition: record.definition,
      source: 'user',
      inheritsFromBuiltInId: record.inheritsFromBuiltInId,
      isEditable: true,
    };
  }
}

export interface UpdateUserArenaInput {
  id: string;
  metadata?: ArenaMetadata;
  definition?: ArenaDefinition;
}

export class UpdateUserArena {
  constructor(
    private readonly users: IUserArenaRepository,
    private readonly validator: IArenaValidator = { validate: validateArenaDefinition },
  ) {}
  async execute(input: UpdateUserArenaInput): Promise<ResolvedArenaEntry> {
    if (input.definition) {
      const result = this.validator.validate(input.definition);
      if (!result.ok) throw new ArenaValidationError(result);
    }
    const record = await this.users.update(input.id, {
      metadata: input.metadata,
      definition: input.definition,
    });
    return {
      id: record.id,
      metadata: record.metadata,
      definition: record.definition,
      source: 'user',
      inheritsFromBuiltInId: record.inheritsFromBuiltInId,
      isEditable: true,
    };
  }
}

export class DeleteUserArena {
  constructor(private readonly users: IUserArenaRepository) {}
  async execute(id: string): Promise<void> {
    await this.users.delete(id);
  }
}

export interface DuplicateBuiltInArenaInput {
  builtInId: string;
  metadata: Partial<ArenaMetadata> & { author?: string };
}

export class DuplicateBuiltInArena {
  constructor(
    private readonly builtIns: IBuiltInArenaSource,
    private readonly users: IUserArenaRepository,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}
  async execute(input: DuplicateBuiltInArenaInput): Promise<ResolvedArenaEntry> {
    const built = await this.builtIns.findArena(input.builtInId);
    if (!built) throw new Error(`Built-in arena ${input.builtInId} not found`);
    const now = this.now();
    const metadata: ArenaMetadata = {
      title: input.metadata.title ?? `${built.metadata.title} (copy)`,
      author: input.metadata.author ?? built.metadata.author,
      createdAt: now,
      updatedAt: now,
      source: 'user',
    };
    const record = await this.users.create({
      metadata,
      definition: built.definition,
    });
    return {
      id: record.id,
      metadata: record.metadata,
      definition: record.definition,
      source: 'user',
      isEditable: true,
    };
  }
}

export class ValidateArena {
  constructor(private readonly validator: IArenaValidator = { validate: validateArenaDefinition }) {}
  execute(definition: ArenaDefinition): ArenaValidationResult {
    return this.validator.validate(definition);
  }
}

export class ArenaValidationError extends Error {
  constructor(public readonly result: ArenaValidationResult) {
    super(`Arena validation failed: ${result.errors.map((e) => e.code).join(', ')}`);
    this.name = 'ArenaValidationError';
  }
}
