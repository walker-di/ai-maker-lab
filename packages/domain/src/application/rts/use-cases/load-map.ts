import type { ResolvedRtsMap } from '../../../shared/rts/index.js';
import type { MapCatalogService } from '../MapCatalogService.js';

export interface LoadMapUseCase {
  execute(id: string): Promise<ResolvedRtsMap | undefined>;
}

export function createLoadMap(catalog: MapCatalogService): LoadMapUseCase {
  return { execute: (id) => catalog.loadResolved(id) };
}
