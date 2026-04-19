import type {
  ResolvedRtsMap,
} from '../../shared/rts/index.js';
import type {
  IRtsMapSource,
  IUserMapRepository,
} from './ports.js';

/**
 * Aggregates built-in maps and (optionally) user-saved maps into a single
 * `ResolvedRtsMap[]` view consumed by the runtime and match-setup UI.
 */
export class MapCatalogService {
  constructor(
    private readonly builtIns: IRtsMapSource,
    private readonly userMaps?: IUserMapRepository,
  ) {}

  async listResolved(): Promise<ResolvedRtsMap[]> {
    const builtIns = await this.builtIns.listMaps();
    const out: ResolvedRtsMap[] = [];
    for (const map of builtIns) {
      out.push({
        id: map.id,
        metadata: map.metadata,
        definition: map,
        source: 'builtin',
        builtInId: map.id,
        isEditable: false,
      });
    }
    if (this.userMaps) {
      const records = await this.userMaps.list();
      for (const record of records) {
        out.push({
          id: record.id,
          metadata: record.metadata,
          definition: record.definition,
          source: record.metadata.source === 'generated' ? 'generated' : 'user',
          isEditable: false,
        });
      }
    }
    return out;
  }

  async loadResolved(id: string): Promise<ResolvedRtsMap | undefined> {
    const builtIn = await this.builtIns.findMap(id);
    if (builtIn) {
      return {
        id,
        metadata: builtIn.metadata,
        definition: builtIn,
        source: 'builtin',
        builtInId: id,
        isEditable: false,
      };
    }
    if (this.userMaps) {
      const record = await this.userMaps.findById(id);
      if (record) {
        return {
          id: record.id,
          metadata: record.metadata,
          definition: record.definition,
          source: record.metadata.source === 'generated' ? 'generated' : 'user',
          isEditable: false,
        };
      }
    }
    return undefined;
  }
}
