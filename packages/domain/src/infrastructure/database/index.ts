export { getDb, closeDb, createDbConnection, type IDbConfig } from './client.js';
export { INIT_DB_QUERY } from './init-db.query.js';
export { createRecordId, RecordId, type IRecordId } from './record-id.js';
export { SurrealDbAdapter } from './SurrealDbAdapter.js';
export { SurrealTodoRepository } from './SurrealTodoRepository.js';
export {
  SurrealUserAgentRepository,
  SurrealChatThreadRepository,
  SurrealChatMessageRepository,
  SurrealChatRunRepository,
  SurrealAttachmentRepository,
} from './chat/index.js';
export {
  SurrealUserMapRepository,
  SurrealPlayerProgressRepository,
} from './platformer/index.js';
export {
  SurrealRtsUserMapRepository,
  SurrealRtsMatchResultRepository,
} from './rts/index.js';
export {
  SurrealUserArenaRepository,
  SurrealAgentRepository,
  SurrealTrainingRunRepository,
  SurrealEpisodeRepository,
  SurrealReplayRepository,
  SurrealWeightCheckpointRepository,
  SurrealNeatGenomeRepository,
  SurrealNeatSpeciesRepository,
  SurrealNeatInnovationLogRepository,
} from './voxsim/index.js';
