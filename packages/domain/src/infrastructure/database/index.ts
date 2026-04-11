export { getDb, closeDb, createDbConnection, type IDbConfig } from './client.js';
export { INIT_DB_QUERY } from './init-db.query.js';
export { createRecordId, RecordId, type IRecordId } from './record-id.js';
export { SurrealDbAdapter } from './SurrealDbAdapter.js';
export { SurrealTodoRepository } from './SurrealTodoRepository.js';
