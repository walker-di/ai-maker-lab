import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ApplicationMenu, BrowserView, BrowserWindow, Utils } from 'electrobun/bun';
import { TodoService, AgentCatalogService, ChatService, ModelHandler } from 'domain/application';
import {
	getDb,
	SurrealDbAdapter,
	SurrealTodoRepository,
	buildProviderRegistry,
	loadSystemAgentDefinitions,
	findSystemAgentById,
	SurrealUserAgentRepository,
	SurrealChatThreadRepository,
	SurrealChatMessageRepository,
	SurrealChatRunRepository,
} from 'domain/infrastructure';
import { resolveMainViewUrl } from '../lib/adapters/runtime/main-view-url';
import type { TodoRpcSchema } from '../lib/adapters/todo/electrobun-todo-rpc';
import type { ChatRpcSchema } from '../lib/adapters/chat/electrobun-chat-rpc';

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

const dbAdapter = new SurrealDbAdapter(surreal);
const systemSource = { loadAll: loadSystemAgentDefinitions, findById: findSystemAgentById };
const catalogService = new AgentCatalogService(systemSource, new SurrealUserAgentRepository(dbAdapter));
const registry = buildProviderRegistry();
const modelHandler = new ModelHandler(registry);
const chatService = new ChatService(
	new SurrealChatThreadRepository(dbAdapter),
	new SurrealChatMessageRepository(dbAdapter),
	new SurrealChatRunRepository(dbAdapter),
	catalogService,
	modelHandler,
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

const chatRpc = BrowserView.defineRPC<ChatRpcSchema>({
	handlers: {
		requests: {
			async listAgents() {
				return toPlain(await catalogService.listAgents());
			},
			async listThreads() {
				return toPlain(await chatService.listThreads());
			},
			async createThread(params) {
				return toPlain(await chatService.createThread(params));
			},
			async getThread({ threadId }) {
				return toPlain(await chatService.getThread(threadId));
			},
			async getMessages({ threadId }) {
				return toPlain(await chatService.getMessages(threadId));
			},
			async sendMessage({ threadId, text, parentMessageId }) {
				const result = await chatService.sendMessage(threadId, { text, parentMessageId });

				const fullText = await result.streamResult.text;
				const usage = await result.streamResult.usage;
				const finishReason = await result.streamResult.finishReason;

				return toPlain({
					userMessage: result.userMessage,
					run: result.run,
					routerDecision: result.routerDecision,
					response: { text: fullText, usage, finishReason },
				});
			}
		}
	}
});

const mainWindow = new BrowserWindow({
	title: 'AI Maker Lab',
	url: await resolveMainViewUrl(),
	rpc: [todoRpc, chatRpc],
	frame: {
		width: 1200,
		height: 800,
		x: 100,
		y: 100
	}
});

console.log(`Desktop app started: ${mainWindow.title}`);
