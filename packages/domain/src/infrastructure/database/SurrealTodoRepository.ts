import type { IDbClient } from '../../core/interfaces/IDbClient.js';
import type { CreateTodoRecord, ITodoRepository } from '../../application/todo/index.js';
import { createRecordId } from './record-id.js';
import type { Todo } from '../../shared/todo/index.js';

const TODO_TABLE = 'todo';

type TodoRecord = {
  id: string;
  title: string;
  completed: boolean;
};

function toTodoRecord(todo: Todo): Omit<TodoRecord, 'id'> {
  return {
    title: todo.title,
    completed: todo.completed,
  };
}

function toTodo(record: TodoRecord): Todo {
  return {
    id: record.id,
    title: record.title,
    completed: record.completed,
  };
}

export class SurrealTodoRepository implements ITodoRepository {
  constructor(private readonly db: IDbClient) {}

  async list(): Promise<Todo[]> {
    const [records = []] = await this.db.query<TodoRecord[]>(
      `SELECT * FROM ${TODO_TABLE};`,
    );
    return records.map(toTodo);
  }

  async findById(id: string): Promise<Todo | null> {
    const records = await this.db.select<TodoRecord>(createRecordId(TODO_TABLE, id));
    const record = records[0];
    return record ? toTodo(record) : null;
  }

  async create(todo: CreateTodoRecord): Promise<Todo> {
    const [records = []] = await this.db.query<TodoRecord[]>(
      `CREATE ${TODO_TABLE} CONTENT { title: $title, completed: $completed };`,
      {
        title: todo.title,
        completed: todo.completed,
      },
    );

    const createdRecord = records[0];

    if (!createdRecord) {
      throw new Error('Todo create failed.');
    }

    return toTodo(createdRecord);
  }

  async update(todo: Todo): Promise<Todo> {
    const records = await this.db.update<TodoRecord, Omit<TodoRecord, 'id'>>(
      createRecordId(TODO_TABLE, todo.id),
      toTodoRecord(todo),
    );

    return toTodo(records[0] ?? todo);
  }

  async remove(id: string): Promise<void> {
    await this.db.delete<TodoRecord>(createRecordId(TODO_TABLE, id));
  }
}
