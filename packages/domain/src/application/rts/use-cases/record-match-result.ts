import type { MatchResult, MatchResultRecord } from '../../../shared/rts/index.js';
import type { IMatchResultRepository } from '../ports.js';

export interface RecordMatchResultUseCase {
  execute(result: MatchResult): Promise<MatchResultRecord>;
}

export function createRecordMatchResult(repo: IMatchResultRepository): RecordMatchResultUseCase {
  return {
    execute: (result) => repo.record(result),
  };
}
