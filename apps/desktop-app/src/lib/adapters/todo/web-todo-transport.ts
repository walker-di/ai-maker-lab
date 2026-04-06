import type { Todo } from 'domain/shared';
import type { TodoTransport } from './TodoTransport';

type TodoApiError = {
  error?: string;
};

async function parseResponse(response: Response): Promise<Todo[]> {
  if (response.ok) {
    return (await response.json()) as Todo[];
  }

  const payload = (await response.json().catch(() => ({}))) as TodoApiError;
  throw new Error(payload.error ?? `Todo request failed with status ${response.status}`);
}

export function createWebTodoTransport(): TodoTransport {
  const baseUrl = '/api/todos';

  return {
    async list() {
      return parseResponse(await fetch(baseUrl));
    },

    async create(title: string) {
      return parseResponse(
        await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({ title }),
        }),
      );
    },

    async toggle(id: string) {
      return parseResponse(
        await fetch(`${baseUrl}/${id}/toggle`, {
          method: 'POST',
        }),
      );
    },

    async remove(id: string) {
      return parseResponse(
        await fetch(`${baseUrl}/${id}`, {
          method: 'DELETE',
        }),
      );
    },
  };
}
