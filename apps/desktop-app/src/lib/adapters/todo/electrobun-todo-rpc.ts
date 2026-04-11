import type { Todo } from 'domain/shared';

export type TodoRpcSchema = {
  bun: {
    requests: {
      listTodos: { params: undefined; response: Todo[] };
      createTodo: { params: { title: string }; response: Todo[] };
      toggleTodo: { params: { id: string }; response: Todo[] };
      removeTodo: { params: { id: string }; response: Todo[] };
    };
    messages: {};
  };
  webview: {
    requests: {};
    messages: {};
  };
};
