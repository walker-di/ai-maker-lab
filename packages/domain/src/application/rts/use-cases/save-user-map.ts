import type {
  Generation,
  MapDefinition,
  UserMapRecord,
} from '../../../shared/rts/index.js';
import type { IUserMapRepository } from '../ports.js';

export interface SaveUserMapInput {
  map: MapDefinition;
  params?: Generation.MapGenerationParams;
  title: string;
  author: string;
}

export interface SaveUserMapUseCase {
  execute(input: SaveUserMapInput): Promise<UserMapRecord>;
}

export function createSaveUserMap(repo: IUserMapRepository): SaveUserMapUseCase {
  return {
    async execute(input) {
      const now = new Date().toISOString();
      const id = `usermap-${Math.floor(Math.random() * 1e10).toString(36)}`;
      const record: UserMapRecord = {
        id,
        definition: {
          ...input.map,
          metadata: {
            ...input.map.metadata,
            title: input.title,
            author: input.author,
            createdAt: now,
            updatedAt: now,
            source: input.map.metadata.source === 'generated' ? 'generated' : 'user',
          },
        },
        params: input.params,
        metadata: {
          title: input.title,
          author: input.author,
          createdAt: now,
          updatedAt: now,
          source: input.map.metadata.source === 'generated' ? 'generated' : 'user',
        },
      };
      return repo.save(record);
    },
  };
}
