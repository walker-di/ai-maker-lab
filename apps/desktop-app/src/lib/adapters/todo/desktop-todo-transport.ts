import { Electroview } from 'electrobun/view';
import type { Todo } from 'domain/shared';
import type { TodoTransport } from './TodoTransport';
import type { TodoRpcSchema } from './electrobun-todo-rpc';

let desktopTodoTransport: TodoTransport | undefined;
let desktopElectroview: Electroview<any> | undefined;

type TodoIdLike = {
  id?: unknown;
  tb?: unknown;
  toString?: () => string;
};

function normalizeTodoId(value: unknown): string {
  if (typeof value === 'string') {
    const bracketedMatch = value.match(/^[^:]+:⟨(.+)⟩$/);
    if (bracketedMatch) {
      return bracketedMatch[1];
    }

    const plainMatch = value.match(/^[^:]+:(.+)$/);
    return plainMatch?.[1] ?? value;
  }

  if (typeof value === 'object' && value !== null) {
    const recordId = value as TodoIdLike;

    if (typeof recordId.id !== 'undefined') {
      return normalizeTodoId(recordId.id);
    }

    if (typeof recordId.toString === 'function') {
      const stringValue = recordId.toString();
      const match = stringValue.match(/^[^:]+:⟨(.+)⟩$/);
      return match?.[1] ?? stringValue;
    }
  }

  return String(value);
}

function normalizeTodo(todo: Todo): Todo {
  return {
    ...todo,
    id: normalizeTodoId(todo.id),
  };
}

async function normalizeResponse(action: () => Promise<Todo[]>): Promise<Todo[]> {
  const todos = await action();
  return todos.map(normalizeTodo);
}

export function createDesktopTodoTransport(): TodoTransport {
  if (desktopTodoTransport) {
    return desktopTodoTransport;
  }

  const rpc = Electroview.defineRPC<TodoRpcSchema>({
    handlers: {},
  });

  desktopElectroview = new Electroview({ rpc });

  desktopTodoTransport = {
    list() {
      return normalizeResponse(() => rpc.request.listTodos());
    },

    create(title: string) {
      return normalizeResponse(() => rpc.request.createTodo({ title }));
    },

    toggle(id: string) {
      return normalizeResponse(() => rpc.request.toggleTodo({ id }));
    },

    remove(id: string) {
      return normalizeResponse(() => rpc.request.removeTodo({ id }));
    },
  };

  return desktopTodoTransport;
}
