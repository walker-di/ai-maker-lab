import { addTodo, removeTodo, toggleTodo, type Todo } from 'domain/shared';

export function createTodoPageModel(initialTodos: readonly Todo[] = []) {
  let todos = $state([...initialTodos]);
  let hasTodos = $derived(todos.length > 0);

  return {
    get todos() {
      return todos;
    },

    get hasTodos() {
      return hasTodos;
    },

    add(title: string) {
      todos = addTodo(todos, {
        id: crypto.randomUUID(),
        title
      });
    },

    toggle(id: string) {
      todos = todos.map((todo) => (todo.id === id ? toggleTodo(todo) : todo));
    },

    remove(id: string) {
      todos = removeTodo(todos, id);
    }
  };
}
