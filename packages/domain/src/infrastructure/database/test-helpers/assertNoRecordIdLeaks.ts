import { RecordId } from 'surrealdb';

export function assertNoRecordIdLeaks(obj: unknown, path = 'root'): void {
  if (obj instanceof RecordId) {
    throw new Error(`RecordId leak detected at ${path}: ${obj.toString()}`);
  }

  if (Array.isArray(obj)) {
    for (const [index, value] of obj.entries()) {
      assertNoRecordIdLeaks(value, `${path}[${index}]`);
    }
    return;
  }

  if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      assertNoRecordIdLeaks(value, `${path}.${key}`);
    }
  }
}
