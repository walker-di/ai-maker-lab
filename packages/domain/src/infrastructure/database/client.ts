import { createNodeEngines } from '@surrealdb/node';
import { createRemoteEngines, Surreal } from 'surrealdb';
import { INIT_DB_QUERY } from './init-db.query.js';

const CONNECTION_TIMEOUT_MS = 30000;
const AUTH_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`[DB] ${operation} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function isEmbeddedHost(host: string): boolean {
  return (
    host.startsWith('mem://') ||
    host.startsWith('rocksdb://') ||
    host.startsWith('surrealkv://') ||
    host.startsWith('surrealkv+versioned://')
  );
}

export interface IDbConfig {
  host: string;
  namespace?: string;
  database?: string;
  username?: string;
  password?: string;
  token?: string;
}

let db: Surreal | undefined;
let connectionPromise: Promise<Surreal> | null = null;

export async function getDb(config?: IDbConfig): Promise<Surreal> {
  if (db) {
    return db;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  if (!config) {
    throw new Error('Database config is required for initial connection');
  }

  const startTime = Date.now();
  console.log(`[DB] Connecting to ${config.host}`);

  connectionPromise = (async () => {
    try {
      const connection = await createDbConnection(config);
      db = connection;
      console.log(`[DB] Connected in ${Date.now() - startTime}ms`);
      return connection;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[DB] Connection failed after ${Date.now() - startTime}ms: ${message}`);
      throw error;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

export async function closeDb(): Promise<void> {
  if (!db) {
    return;
  }

  await db.close();
  db = undefined;
  connectionPromise = null;
}

export async function createDbConnection(config: IDbConfig): Promise<Surreal> {
  const { host, namespace, database, username, password, token } = config;
  const embedded = isEmbeddedHost(host);
  const surreal = new Surreal({
    engines: {
      ...createRemoteEngines(),
      ...createNodeEngines(),
    },
  });

  await withTimeout(
    surreal.connect(host, {
      namespace,
      database,
      versionCheck: false,
    }),
    CONNECTION_TIMEOUT_MS,
    `connect to ${host}`,
  );

  if (embedded) {
    await surreal.query(INIT_DB_QUERY);
    return surreal;
  }

  if (token) {
    await withTimeout(surreal.authenticate(token), AUTH_TIMEOUT_MS, 'authenticate with token');
    return surreal;
  }

  if (username || password) {
    if (!username || !password) {
      throw new Error('Both username and password are required for credential-based database auth');
    }

    await withTimeout(
      surreal.signin({
        namespace,
        database,
        username,
        password,
      }),
      AUTH_TIMEOUT_MS,
      'signin with credentials',
    );
  }

  return surreal;
}
