import { createTodoTransport } from '$lib/adapters/todo/create-todo-transport';
import { createTodoPageModel } from './todo-page.svelte.ts';

export function createTodoPage() {
  const model = createTodoPageModel({
    transport: createTodoTransport(),
  });

  void model.loadInitial();

  return model;
}
