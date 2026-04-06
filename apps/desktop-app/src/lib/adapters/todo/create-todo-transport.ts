import type { TodoTransport, TodoRuntimeMode } from './TodoTransport';
import { createWebTodoTransport } from './web-todo-transport';

type ElectrobunWindow = Window & {
  __electrobun?: unknown;
  __electrobunWebviewId?: number;
  __electrobunRpcSocketPort?: number;
};

function hasElectrobunBridge(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

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

export function createTodoTransport(mode: TodoRuntimeMode = resolveTodoRuntimeMode()): TodoTransport {
  if (mode === 'web') {
    return createWebTodoTransport();
  }

  return {
    async list() {
      const { createDesktopTodoTransport } = await import('./desktop-todo-transport');
      return createDesktopTodoTransport().list();
    },

    async create(title: string) {
      const { createDesktopTodoTransport } = await import('./desktop-todo-transport');
      return createDesktopTodoTransport().create(title);
    },

    async toggle(id: string) {
      const { createDesktopTodoTransport } = await import('./desktop-todo-transport');
      return createDesktopTodoTransport().toggle(id);
    },

    async remove(id: string) {
      const { createDesktopTodoTransport } = await import('./desktop-todo-transport');
      return createDesktopTodoTransport().remove(id);
    },
  };
}
