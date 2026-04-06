import type { Todo } from '../../shared/todo/index.js';

export type CreateTodoRecord = Omit<Todo, 'id'>;

export interface ITodoRepository {
  list(): Promise<Todo[]>;
  findById(id: string): Promise<Todo | null>;
  create(todo: CreateTodoRecord): Promise<Todo>;
  update(todo: Todo): Promise<Todo>;
  remove(id: string): Promise<void>;
}
