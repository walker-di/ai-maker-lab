import type { Todo } from 'domain/shared';

export type TodoRuntimeMode = 'desktop' | 'web';

export interface TodoTransport {
  list(): Promise<Todo[]>;
  create(title: string): Promise<Todo[]>;
  toggle(id: string): Promise<Todo[]>;
  remove(id: string): Promise<Todo[]>;
}
