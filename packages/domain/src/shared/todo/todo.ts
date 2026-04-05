export interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export interface CreateTodoInput {
  id: string;
  title: string;
}

export function normalizeTodoTitle(title: string): string {
  return title.trim();
}

export function createTodo({ id, title }: CreateTodoInput): Todo {
  const normalizedTitle = normalizeTodoTitle(title);

  if (!normalizedTitle) {
    throw new Error('Todo title cannot be empty.');
  }

  return {
    id,
    title: normalizedTitle,
    completed: false
  };
}

export function addTodo(todos: readonly Todo[], input: CreateTodoInput): Todo[] {
  return [...todos, createTodo(input)];
}

export function toggleTodo(todo: Todo): Todo {
  return {
    ...todo,
    completed: !todo.completed
  };
}

export function removeTodo(todos: readonly Todo[], id: string): Todo[] {
  return todos.filter((todo) => todo.id !== id);
}
