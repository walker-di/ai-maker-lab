import { normalizeTodoTitle, toggleTodo, type Todo } from '../../shared/todo/index.js';
import type { ITodoRepository } from './ITodoRepository.js';

export class TodoService {
  constructor(private readonly repository: ITodoRepository) {}

  async listTodos(): Promise<Todo[]> {
    return this.repository.list();
  }

  async createTodo(title: string): Promise<Todo[]> {
    const normalizedTitle = normalizeTodoTitle(title);

    if (!normalizedTitle) {
      throw new Error('Todo title cannot be empty.');
    }

    await this.repository.create({
      title: normalizedTitle,
      completed: false,
    });
    return this.repository.list();
  }

  async toggleTodo(id: string): Promise<Todo[]> {
    const existingTodo = await this.repository.findById(id);

    if (!existingTodo) {
      throw new Error(`Todo not found: ${id}`);
    }

    await this.repository.update(toggleTodo(existingTodo));
    return this.repository.list();
  }

  async removeTodo(id: string): Promise<Todo[]> {
    await this.repository.remove(id);
    return this.repository.list();
  }
}
