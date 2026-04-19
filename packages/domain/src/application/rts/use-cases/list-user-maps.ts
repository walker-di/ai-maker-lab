import type { UserMapRecord } from '../../../shared/rts/index.js';
import type { IUserMapRepository } from '../ports.js';

export interface ListUserMapsUseCase {
  execute(): Promise<UserMapRecord[]>;
}

export function createListUserMaps(repo: IUserMapRepository): ListUserMapsUseCase {
  return { execute: () => repo.list() };
}
