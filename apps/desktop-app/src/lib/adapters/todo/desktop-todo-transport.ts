import type { Todo } from 'domain/shared';
import type { TodoTransport } from './TodoTransport';
import type { DesktopWebviewRpc } from '../runtime/desktop-runtime';
import { normalizeId } from '../runtime/surreal-id-normalizer';

function normalizeTodo(todo: Todo): Todo {
	return { ...todo, id: normalizeId(todo.id) };
}

async function normalize(action: () => Promise<Todo[]>): Promise<Todo[]> {
	const todos = await action();
	return todos.map(normalizeTodo);
}

export function createDesktopTodoTransport(rpc: DesktopWebviewRpc): TodoTransport {
	return {
		list: () => normalize(() => rpc.request.listTodos()),
		create: (title: string) => normalize(() => rpc.request.createTodo({ title })),
		toggle: (id: string) => normalize(() => rpc.request.toggleTodo({ id })),
		remove: (id: string) => normalize(() => rpc.request.removeTodo({ id })),
	};
}
