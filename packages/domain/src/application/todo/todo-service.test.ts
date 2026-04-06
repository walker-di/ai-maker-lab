import { describe, expect, test } from 'bun:test';
import type { Todo } from '../../shared/todo/index.js';
import type { CreateTodoRecord, ITodoRepository } from './ITodoRepository.js';
import { TodoService } from './todo-service.js';

class InMemoryTodoRepository implements ITodoRepository {
  constructor(private todos: Todo[] = []) {}

  async list(): Promise<Todo[]> {
    return [...this.todos];
  }

  async findById(id: string): Promise<Todo | null> {
    return this.todos.find((todo) => todo.id === id) ?? null;
  }

  async create(todo: CreateTodoRecord): Promise<Todo> {
    const persistedTodo = {
      id: `todo-${this.todos.length + 1}`,
      ...todo,
    };

    this.todos = [...this.todos, persistedTodo];
    return persistedTodo;
  }

  async update(todo: Todo): Promise<Todo> {
    this.todos = this.todos.map((entry) => (entry.id === todo.id ? todo : entry));
    return todo;
  }

  async remove(id: string): Promise<void> {
    this.todos = this.todos.filter((todo) => todo.id !== id);
  }
}

describe('TodoService', () => {
  test('creates and returns persisted todos', async () => {
    const service = new TodoService(new InMemoryTodoRepository());

    const todos = await service.createTodo('  ship desktop app  ');

    expect(todos).toHaveLength(1);
    expect(todos[0]?.id).toBe('todo-1');
    expect(todos[0]?.title).toBe('ship desktop app');
    expect(todos[0]?.completed).toBe(false);
  });

  test('toggles an existing todo', async () => {
    const service = new TodoService(
      new InMemoryTodoRepository([
        {
          id: 'todo-1',
          title: 'write docs',
          completed: false,
        },
      ]),
    );

    const todos = await service.toggleTodo('todo-1');

    expect(todos[0]?.completed).toBe(true);
  });

  test('throws when toggling a missing todo', async () => {
    const service = new TodoService(new InMemoryTodoRepository());

    await expect(service.toggleTodo('missing-todo')).rejects.toThrow('Todo not found: missing-todo');
  });

  test('removes an existing todo', async () => {
    const service = new TodoService(
      new InMemoryTodoRepository([
        {
          id: 'todo-1',
          title: 'one',
          completed: false,
        },
        {
          id: 'todo-2',
          title: 'two',
          completed: false,
        },
      ]),
    );

    const todos = await service.removeTodo('todo-1');

    expect(todos.map((todo) => todo.id)).toEqual(['todo-2']);
  });
});
