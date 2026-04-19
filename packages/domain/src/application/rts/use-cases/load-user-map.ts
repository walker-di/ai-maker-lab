import type { UserMapRecord } from '../../../shared/rts/index.js';
import type { IUserMapRepository } from '../ports.js';

export interface LoadUserMapUseCase {
  execute(id: string): Promise<UserMapRecord | undefined>;
}

export function createLoadUserMap(repo: IUserMapRepository): LoadUserMapUseCase {
  return { execute: (id) => repo.findById(id) };
}
