import type { Todo } from 'domain/shared';
import type { TodoTransport } from '$lib/adapters/todo/TodoTransport';

type CreateTodoPageModelInput = {
  transport: TodoTransport;
};

export function createTodoPageModel({
  transport,
}: CreateTodoPageModelInput) {
  let todos = $state<Todo[]>([]);
  let hasTodos = $derived(todos.length > 0);
  let errorMessage = $state<string | null>(null);
  let isLoading = $state(false);
  let hasLoaded = $state(false);

  async function apply(action: () => Promise<Todo[]>) {
    try {
      errorMessage = null;
      isLoading = true;
      const result = await action();
      const seen = new Set<string>();
      todos = result.filter((t) => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Todo request failed.';
      console.error(error);
    } finally {
      isLoading = false;
      hasLoaded = true;
    }
  }

  return {
    get todos() {
      return todos;
    },

    get hasTodos() {
      return hasTodos;
    },

    get isLoading() {
      return isLoading;
    },

    get hasLoaded() {
      return hasLoaded;
    },

    get errorMessage() {
      return errorMessage;
    },

    async loadInitial() {
      await apply(() => transport.list());
    },

    async add(title: string) {
      await apply(() => transport.create(title));
    },

    async toggle(id: string) {
      await apply(() => transport.toggle(id));
    },

    async remove(id: string) {
      await apply(() => transport.remove(id));
    },
  };
}
