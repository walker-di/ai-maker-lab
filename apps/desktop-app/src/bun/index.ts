import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ApplicationMenu, BrowserView, BrowserWindow, Utils } from 'electrobun/bun';
import { TodoService } from 'domain/application';
import { getDb, SurrealDbAdapter, SurrealTodoRepository } from 'domain/infrastructure';
import { resolveMainViewUrl } from '../lib/adapters/runtime/main-view-url';
import type { TodoRpcSchema } from '../lib/adapters/todo/electrobun-todo-rpc';

ApplicationMenu.setApplicationMenu([
	{
		submenu: [{ label: 'Quit', role: 'quit' }]
	},
	{
		label: 'Edit',
		submenu: [
			{ role: 'undo' },
			{ role: 'redo' },
			{ type: 'separator' },
			{ role: 'cut' },
			{ role: 'copy' },
			{ role: 'paste' },
			{ role: 'pasteAndMatchStyle' },
			{ role: 'delete' },
			{ role: 'selectAll' }
		]
	}
]);

const desktopDbPath = join(Utils.paths.userData, 'surrealdb', 'desktop.db');
mkdirSync(dirname(desktopDbPath), { recursive: true });

const surreal = await getDb({
	host: `surrealkv://${desktopDbPath}`,
	namespace: 'app',
	database: 'desktop'
});
const todoService = new TodoService(
	new SurrealTodoRepository(new SurrealDbAdapter(surreal))
);

function toPlain<T>(data: T): T {
	return JSON.parse(JSON.stringify(data));
}

const todoRpc = BrowserView.defineRPC<TodoRpcSchema>({
	handlers: {
		requests: {
			async listTodos() {
				const todos = await todoService.listTodos();
				return toPlain(todos);
			},
			async createTodo({ title }) {
				const todos = await todoService.createTodo(title);
				return toPlain(todos);
			},
			async toggleTodo({ id }) {
				const todos = await todoService.toggleTodo(id);
				return toPlain(todos);
			},
			async removeTodo({ id }) {
				const todos = await todoService.removeTodo(id);
				return toPlain(todos);
			}
		}
	}
});

const mainWindow = new BrowserWindow({
	title: 'AI Maker Lab',
	url: await resolveMainViewUrl(),
	rpc: todoRpc,
	frame: {
		width: 1200,
		height: 800,
		x: 100,
		y: 100
	}
});

console.log(`Desktop app started: ${mainWindow.title}`);
