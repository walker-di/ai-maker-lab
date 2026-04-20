import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { TodoService } from './application/index.js';
import { MapCatalogService } from './application/platformer/index.js';
import {
  getDb,
  SurrealDbAdapter,
  SurrealTodoRepository,
  SurrealUserMapRepository,
  SurrealPlayerProgressRepository,
  JsonBuiltInWorldRepository,
} from './infrastructure/index.js';

const app = new Hono();

function getDefaultEmbeddedHost(): string {
  const dbPath = fileURLToPath(new URL('../../../data/surrealdb/domain.db', import.meta.url));
  mkdirSync(dirname(dbPath), { recursive: true });
  return `surrealkv://${dbPath}`;
}

const surreal = await getDb({
  host: process.env.SURREAL_HOST ?? getDefaultEmbeddedHost(),
  namespace: process.env.SURREAL_NS ?? 'app',
  database: process.env.SURREAL_DB ?? 'desktop',
  username: process.env.SURREAL_USER,
  password: process.env.SURREAL_PASS,
  token: process.env.SURREAL_TOKEN,
});
const todoService = new TodoService(
  new SurrealTodoRepository(new SurrealDbAdapter(surreal)),
);

const mapCatalogService = new MapCatalogService(
  new JsonBuiltInWorldRepository(),
  new SurrealUserMapRepository(new SurrealDbAdapter(surreal)),
  new SurrealPlayerProgressRepository(new SurrealDbAdapter(surreal)),
);

function getErrorStatus(error: unknown): 400 | 404 | 500 {
  if (!(error instanceof Error)) {
    return 500;
  }

  if (error.message.includes('not found')) {
    return 404;
  }

  if (error.message.includes('cannot be empty')) {
    return 400;
  }

  return 500;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

app.get('/', (c) => {
  return c.text('Hello Hono!');
});

app.use('/api/*', cors());

app.get('/api/todos', async (c) => {
  return c.json(await todoService.listTodos());
});

app.post('/api/todos', async (c) => {
  try {
    const { title } = await c.req.json<{ title: string }>();
    return c.json(await todoService.createTodo(title));
  } catch (error) {
    return c.json({ error: getErrorMessage(error) }, getErrorStatus(error));
  }
});

app.post('/api/todos/:id/toggle', async (c) => {
  try {
    return c.json(await todoService.toggleTodo(c.req.param('id')));
  } catch (error) {
    return c.json({ error: getErrorMessage(error) }, getErrorStatus(error));
  }
});

app.delete('/api/todos/:id', async (c) => {
  try {
    return c.json(await todoService.removeTodo(c.req.param('id')));
  } catch (error) {
    return c.json({ error: getErrorMessage(error) }, getErrorStatus(error));
  }
});

app.get('/api/platformer/maps', async (c) => {
  try {
    const source = c.req.query('source') as 'builtin' | 'user' | 'all' | undefined;
    const playerId = c.req.query('playerId') ?? undefined;
    return c.json(await mapCatalogService.listMaps({ source, playerId }));
  } catch (error) {
    return c.json({ error: getErrorMessage(error) }, getErrorStatus(error));
  }
});

app.get('/api/platformer/maps/:id{.+}', async (c) => {
  try {
    const id = decodeURIComponent(c.req.param('id'));
    const map = await mapCatalogService.getMap(id);
    if (!map) return c.json({ error: 'not found' }, 404);
    return c.json(map);
  } catch (error) {
    return c.json({ error: getErrorMessage(error) }, getErrorStatus(error));
  }
});

app.post('/api/platformer/maps', async (c) => {
  try {
    const body = await c.req.json<{
      id?: string;
      metadata: import('./shared/platformer/index.js').MapMetadata;
      definition: import('./shared/platformer/index.js').MapDefinition;
      builtInId?: string;
    }>();
    return c.json(await mapCatalogService.saveUserMap(body));
  } catch (error) {
    return c.json({ error: getErrorMessage(error) }, getErrorStatus(error));
  }
});

app.delete('/api/platformer/maps/:id{.+}', async (c) => {
  try {
    const id = decodeURIComponent(c.req.param('id'));
    await mapCatalogService.deleteUserMap(id);
    return c.json({ ok: true });
  } catch (error) {
    return c.json({ error: getErrorMessage(error) }, getErrorStatus(error));
  }
});

app.post('/api/platformer/maps/duplicate', async (c) => {
  try {
    const body = await c.req.json<{ builtInId: string; metadata?: Partial<import('./shared/platformer/index.js').MapMetadata> }>();
    return c.json(await mapCatalogService.duplicateBuiltIn(body.builtInId, body.metadata ?? {}));
  } catch (error) {
    return c.json({ error: getErrorMessage(error) }, getErrorStatus(error));
  }
});

app.post('/api/platformer/runs', async (c) => {
  try {
    const body = await c.req.json<import('./application/platformer/index.js').RecordRunResultInput>();
    return c.json(await mapCatalogService.recordRunResult(body));
  } catch (error) {
    return c.json({ error: getErrorMessage(error) }, getErrorStatus(error));
  }
});

app.get('/api/platformer/players/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const profile = await mapCatalogService.loadPlayerProfile(id);
    if (!profile) return c.json({ error: 'not found' }, 404);
    return c.json(profile);
  } catch (error) {
    return c.json({ error: getErrorMessage(error) }, getErrorStatus(error));
  }
});

export default app;
