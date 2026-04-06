import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { TodoService } from './application/index.js';
import { getDb, SurrealDbAdapter, SurrealTodoRepository } from './infrastructure/index.js';

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

export default app;
