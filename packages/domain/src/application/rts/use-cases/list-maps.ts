import type { ResolvedRtsMap } from '../../../shared/rts/index.js';
import type { MapCatalogService } from '../MapCatalogService.js';

export interface ListMapsUseCase {
  execute(): Promise<ResolvedRtsMap[]>;
}

export function createListMaps(catalog: MapCatalogService): ListMapsUseCase {
  return {
    execute: () => catalog.listResolved(),
  };
}
