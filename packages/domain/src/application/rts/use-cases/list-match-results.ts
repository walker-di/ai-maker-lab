import type {
  ListMatchResultsFilter,
  MatchResultRecord,
} from '../../../shared/rts/index.js';
import type { IMatchResultRepository } from '../ports.js';

export interface ListMatchResultsUseCase {
  execute(filter?: ListMatchResultsFilter): Promise<MatchResultRecord[]>;
}

export function createListMatchResults(repo: IMatchResultRepository): ListMatchResultsUseCase {
  return {
    execute: (filter) => repo.list(filter),
  };
}
