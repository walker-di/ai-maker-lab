/**
 * Application service that merges built-in arenas (backend-owned JSON) with
 * user-authored arenas (Surreal-backed) into a single ordered catalog of
 * `ResolvedArenaEntry` instances for the desktop and web clients.
 */

import type { ResolvedArenaEntry } from '../../shared/voxsim/index.js';
import type {
  IArenaCatalogService,
  IBuiltInArenaSource,
  IUserArenaRepository,
  UserArenaRecord,
} from './ports.js';

export interface ArenaCatalogServiceOptions {
  builtIns: IBuiltInArenaSource;
  users: IUserArenaRepository;
}

export class ArenaCatalogService implements IArenaCatalogService {
  private readonly builtIns: IBuiltInArenaSource;
  private readonly users: IUserArenaRepository;

  constructor(options: ArenaCatalogServiceOptions) {
    this.builtIns = options.builtIns;
    this.users = options.users;
  }

  async listResolved(): Promise<ResolvedArenaEntry[]> {
    const [builtIns, users] = await Promise.all([
      this.builtIns.listArenas(),
      this.users.list(),
    ]);

    const resolved: ResolvedArenaEntry[] = [];
    for (const entry of builtIns) {
      resolved.push({
        id: entry.id,
        metadata: entry.metadata,
        definition: entry.definition,
        source: 'builtin',
        builtInId: entry.id,
        isEditable: false,
      });
    }
    const sortedUsers = [...users].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    for (const user of sortedUsers) {
      resolved.push(toUserResolved(user));
    }
    return resolved;
  }

  async loadResolved(id: string): Promise<ResolvedArenaEntry | undefined> {
    const builtIn = await this.builtIns.findArena(id);
    if (builtIn) {
      return {
        id: builtIn.id,
        metadata: builtIn.metadata,
        definition: builtIn.definition,
        source: 'builtin',
        builtInId: builtIn.id,
        isEditable: false,
      };
    }
    const user = await this.users.findById(id);
    if (user) return toUserResolved(user);
    return undefined;
  }
}

function toUserResolved(record: UserArenaRecord): ResolvedArenaEntry {
  return {
    id: record.id,
    metadata: record.metadata,
    definition: record.definition,
    source: 'user',
    inheritsFromBuiltInId: record.inheritsFromBuiltInId,
    isEditable: true,
  };
}
