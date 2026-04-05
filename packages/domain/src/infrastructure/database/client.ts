import { Surreal } from "surrealdb";
import { INIT_DB_QUERY } from "./init-db.query.js";

// 📌 Connection timeout constants
const CONNECTION_TIMEOUT_MS = 30000; // 30s for initial connection
const SIGNIN_TIMEOUT_MS = 10000; // 10s for signin operations

/**
 * Wraps a promise with a timeout to fail fast instead of waiting indefinitely
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`⏱️ [DB] ${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
  );
  return Promise.race([promise, timeout]);
}

async function loadEngine() {
  try {
    // Dynamically import @surrealdb/node as it's an optional dependency
    // Use a dynamic module name to avoid bundlers from eagerly including native binaries
    const moduleName = '@surrealdb/node';
    const mod: any = await import(/* @vite-ignore */ moduleName);
    const { surrealdbNodeEngines } = mod || {};
    if (typeof surrealdbNodeEngines !== 'function') {
      throw new Error('surrealdbNodeEngines not available from @surrealdb/node');
    }
    return surrealdbNodeEngines();
  } catch (error) {
    throw new Error(
      "Failed to load SurrealDB Node.js engines. " +
      "Please install @surrealdb/node: npm install --save @surrealdb/node. " +
      `Original error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
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
let isConnecting = false;
let connectionPromise: Promise<Surreal> | null = null;
let lastConnectionTime: number | undefined;

export async function getDb(config?: IDbConfig): Promise<Surreal> {
  // 📌 FIX: Removed expensive health check query that ran on EVERY request
  // The previous code ran "SELECT * FROM user LIMIT 1" on every getDb() call,
  // which caused 504 timeouts in Cloud Run due to network latency.
  // Now we trust the WebSocket connection exists and let actual queries fail if needed.
  if (db) {
    return db;
  }

  if (isConnecting && connectionPromise) {
    return connectionPromise;
  }

  if (!config) {
    throw new Error("Database config is required for initial connection");
  }

  isConnecting = true;
  console.log('🔌 [DB] Initiating database connection...');
  const startTime = Date.now();
  
  connectionPromise = (async () => {
    try {
      db = await createDbConnection(config);
      lastConnectionTime = Date.now();
      console.log(`✅ [DB] Connected successfully in ${Date.now() - startTime}ms`);
      return db;
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ [DB] Connection failed after ${Date.now() - startTime}ms:`, errorMessage);
      throw error;
    }
    finally {
      isConnecting = false;
      connectionPromise = null;
    }
  })();
  return connectionPromise;
}

export async function closeDb(): Promise<void> {
  if (!db) return;
  await db.close();
  db = undefined;
}

export const createDbConnection = async (conf: IDbConfig) => {
  const { host, namespace, database, username, password } = conf;
  const isEmbedded = host.startsWith("mem://") || host.startsWith("surrealkv://");
  
  console.log(`🔌 [DB] Creating connection to ${isEmbedded ? 'embedded' : 'remote'} database...`);
  
  const db = new Surreal(isEmbedded ? { engines: await loadEngine() } : undefined);
  
  // 📌 FIX: Wrap connect with timeout to fail fast instead of waiting 300s
  await withTimeout(
    db.connect(host, {
      namespace: namespace,
      database: database,
      versionCheck: false, // 📌 Disable version check to avoid "Failed to retrieve remote version" errors
    }),
    CONNECTION_TIMEOUT_MS,
    `connect to ${host}`
  );
  
  if (isEmbedded) {
    await db.query(INIT_DB_QUERY);
    console.log('✅ [DB] Embedded database initialized');
    return db;
  }
  
  if (conf.token) {
    // 📌 FIX: Wrap authenticate with timeout
    await withTimeout(
      db.authenticate(conf.token),
      SIGNIN_TIMEOUT_MS,
      'authenticate with token'
    );
    console.log('✅ [DB] Authenticated with token');
    return db;
  }
  
  if (!username || !password) {
    throw new Error("Username and password are required for non-embedded databases");
  }
  
  // 📌 FIX: Wrap signin with timeout
  await withTimeout(
    db.signin({
      username,
      password,
      namespace,
      database
    }),
    SIGNIN_TIMEOUT_MS,
    'signin with credentials'
  );
  
  console.log('✅ [DB] Signed in successfully');
  return db;
};
