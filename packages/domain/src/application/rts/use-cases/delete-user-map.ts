import type { IUserMapRepository } from '../ports.js';

export interface DeleteUserMapUseCase {
  execute(id: string): Promise<void>;
}

export function createDeleteUserMap(repo: IUserMapRepository): DeleteUserMapUseCase {
  return { execute: (id) => repo.remove(id) };
}
