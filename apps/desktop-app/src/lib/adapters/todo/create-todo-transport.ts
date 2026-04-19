import type { TodoTransport, TodoRuntimeMode } from './TodoTransport';
import { createWebTodoTransport } from './web-todo-transport';

type ElectrobunWindow = Window & {
	__electrobun?: unknown;
	__electrobunWebviewId?: number;
	__electrobunRpcSocketPort?: number;
};

function hasElectrobunBridge(): boolean {
	if (typeof window === 'undefined') return false;
	const electrobunWindow = window as ElectrobunWindow;
	return (
		typeof electrobunWindow.__electrobun !== 'undefined' ||
		typeof electrobunWindow.__electrobunWebviewId === 'number' ||
		typeof electrobunWindow.__electrobunRpcSocketPort === 'number'
	);
}

export function resolveTodoRuntimeMode(): TodoRuntimeMode {
	return hasElectrobunBridge() ? 'desktop' : 'web';
}

async function loadDesktopTodoTransport(): Promise<TodoTransport> {
	const { getDesktopRuntime } = await import('../runtime/desktop-runtime');
	return getDesktopRuntime().todoTransport;
}

export function createTodoTransport(
	mode: TodoRuntimeMode = resolveTodoRuntimeMode(),
): TodoTransport {
	if (mode === 'web') return createWebTodoTransport();

	let cached: TodoTransport | undefined;
	const get = async () => (cached ??= await loadDesktopTodoTransport());

	return {
		list: async () => (await get()).list(),
		create: async (title) => (await get()).create(title),
		toggle: async (id) => (await get()).toggle(id),
		remove: async (id) => (await get()).remove(id),
	};
}
